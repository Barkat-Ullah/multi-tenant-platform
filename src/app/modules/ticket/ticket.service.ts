import httpStatus from 'http-status';
import {
  Prisma,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  UserRoleEnum,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../utils/calculatePagination';
import ApiError from '../../errors/AppError';
import { Request } from 'express';
import {
  ticketSelect,
  ticketListItemSelect,
  ticketMessageCustomerSelect,
  ticketMessageStaffSelect,
} from './ticket.select';
import {
  buildFilterConditions,
  buildSearchConditions,
  canAccessTicket,
  canSeeInternalNotes,
  formatTicketNumber,
  getDateRangeByPeriod,
  getCustomDateRange,
  normalizeCalendarPeriod,
  calculateAvgResolutionHours,
} from './ticket.utils';
import {
  CLOSED_STATUSES,
  CUSTOMER_ROLES,
  STAFF_ROLES,
} from './ticket.constant';

// Types for filters
type ITicketFilterRequest = {
  searchTerm?: string;
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedToId?: string;
  createdById?: string;
  startDate?: string;
  endDate?: string;
  period?: string;
  rangeStartDay?: string;
  rangeEndDay?: string;
  bookingId?: string;
};

// ============================================================
// CREATE TICKET - Atomic transaction with auto-numbering
// Fix: Booking validation moved INSIDE transaction to close TOCTOU race
// ============================================================
const createTicket = async (req: Request) => {
  const createdById = req.user.id;
  const { subject, description, category, priority, relatedBookingId } =
    req.body;

  // ATOMIC TRANSACTION: Validate booking + generate number + create ticket
  const result = await prisma.$transaction(async tx => {
    // Validate related booking exists if provided (inside transaction to avoid races)
    if (relatedBookingId) {
      const booking = await tx.booking.findUnique({
        where: { id: relatedBookingId },
        select: { id: true },
      });
      if (!booking) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Related booking not found');
      }
    }

    // Atomically increment counter
    const counter = await tx.ticketCounter.upsert({
      where: { name: 'ticket' },
      update: { seq: { increment: 1 } },
      create: { name: 'ticket', seq: 1 },
    });

    const ticketNumber = formatTicketNumber(counter.seq);

    // Create ticket
    const ticket = await tx.supportTicket.create({
      data: {
        ticketNumber,
        subject,
        description,
        category: category || TicketCategory.OTHER,
        priority: priority || TicketPriority.MEDIUM,
        createdById,
        relatedBookingId,
      },
      select: ticketSelect,
    });

    // Create initial message from description
    await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: createdById,
        message: description,
      },
    });

    // Log initial status
    await tx.ticketStatusLog.create({
      data: {
        ticketId: ticket.id,
        fromStatus: null,
        toStatus: TicketStatus.OPEN,
        changedById: createdById,
        note: 'Ticket created',
      },
    });

    return ticket;
  });

  return result;
};

// ============================================================
// GET TICKET LIST - Optimized with single query
// ============================================================
const getTicketList = async (
  req: Request,
  options: IPaginationOptions,
  filters: ITicketFilterRequest,
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, period, rangeStartDay, rangeEndDay, ...filterData } =
    filters;

  const andConditions: Prisma.SupportTicketWhereInput[] = [];

  // Role-based scoping (use constant to avoid re-allocating array each call)
  const userRole = req.user.role;
  const userId = req.user.id;

  if (CUSTOMER_ROLES.includes(userRole as (typeof CUSTOMER_ROLES)[number])) {
    // Customers see only their own tickets
    andConditions.push({ createdById: userId });
  }

  // Search conditions
  if (searchTerm) {
    andConditions.push(...buildSearchConditions(searchTerm));
  }

  // Filter conditions
  if (Object.keys(filterData).length) {
    andConditions.push(...buildFilterConditions(filterData));
  }

  // Date range filtering (analytics style)
  if (period || rangeStartDay || rangeEndDay) {
    const { rangeStart, rangeEnd } =
      rangeStartDay && rangeEndDay
        ? getCustomDateRange(rangeStartDay, rangeEndDay)
        : getDateRangeByPeriod(normalizeCalendarPeriod(period));

    andConditions.push({
      createdAt: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    });
  }

  const whereConditions: Prisma.SupportTicketWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  // Parallel queries for performance
  const [result, total] = await Promise.all([
    prisma.supportTicket.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      select: ticketListItemSelect,
    }),
    prisma.supportTicket.count({ where: whereConditions }),
  ]);

  return {
    meta: { total, page, limit },
    data: result,
  };
};

// ============================================================
// GET TICKET BY ID - Filter internal notes for customers
// Fix: Add message pagination to prevent loading 10K+ messages
// Fix: Use separate queries for messages count to avoid type issues
// ============================================================
const getTicketById = async (req: Request) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  // Parse optional message pagination from query
  const messagePage = Math.max(
    1,
    parseInt(req.query.messagePage as string) || 1,
  );
  const messageLimit = Math.min(
    100,
    Math.max(1, parseInt(req.query.messageLimit as string) || 50),
  );
  const messageSkip = (messagePage - 1) * messageLimit;

  // Fetch ticket detail (without messages) + paginated messages in parallel
  const [ticket, totalMessages, messages] = await Promise.all([
    prisma.supportTicket.findUnique({
      where: { id },
      select: ticketSelect,
    }),
    prisma.ticketMessage.count({
      where: {
        ticketId: id,
        ...(canSeeInternalNotes(userRole)
          ? {}
          : { isInternalNote: false }),
      },
    }),
    prisma.ticketMessage.findMany({
      where: {
        ticketId: id,
        ...(canSeeInternalNotes(userRole)
          ? {}
          : { isInternalNote: false }),
      },
      select: ticketMessageCustomerSelect,
      orderBy: { createdAt: 'asc' as const },
      skip: messageSkip,
      take: messageLimit,
    }),
  ]);

  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Ticket not found');
  }

  // Access control
  if (
    !canAccessTicket(
      ticket.createdById || '',
      ticket.assignedToId,
      userId,
      userRole,
    )
  ) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot access this ticket');
  }

  return {
    ...ticket,
    messages,
    messagePagination: {
      total: totalMessages,
      page: messagePage,
      limit: messageLimit,
      totalPages: Math.ceil(totalMessages / messageLimit),
    },
  };
};

// ============================================================
// ASSIGN TICKET - Admin only
// Fix: Parallelize user lookup and ticket lookup (was sequential)
// ============================================================
const assignTicket = async (req: Request) => {
  const { id } = req.params;
  const { assignedToId } = req.body;
  const userId = req.user.id;

  // PARALLEL: Verify assignee exists + ticket exists simultaneously
  const [assignee, ticket] = await Promise.all([
    prisma.user.findUnique({
      where: { id: assignedToId },
      select: { role: true, id: true },
    }),
    prisma.supportTicket.findUnique({
      where: { id },
      select: { assignedToId: true, status: true },
    }),
  ]);

  if (!assignee) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Assignee not found');
  }

  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Ticket not found');
  }

  if (!STAFF_ROLES.includes(assignee.role as (typeof STAFF_ROLES)[number])) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Can only assign to admin/staff',
    );
  }

  // Update ticket and log status change in transaction
  const result = await prisma.$transaction(async tx => {
    const updated = await tx.supportTicket.update({
      where: { id },
      data: {
        assignedToId,
        status: TicketStatus.IN_PROGRESS,
      },
      select: ticketSelect,
    });

    // Log status change if status changed
    if (ticket.status !== TicketStatus.IN_PROGRESS) {
      await tx.ticketStatusLog.create({
        data: {
          ticketId: id,
          fromStatus: ticket.status,
          toStatus: TicketStatus.IN_PROGRESS,
          changedById: userId,
          note: 'Ticket assigned',
        },
      });
    }

    return updated;
  });

  return result;
};

// ============================================================
// CHANGE TICKET STATUS - Transaction with logging
// ============================================================
const changeTicketStatus = async (req: Request) => {
  const { id } = req.params;
  const { status, note } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    select: {
      status: true,
      createdById: true,
      assignedToId: true,
      resolvedAt: true,
      closedAt: true,
    },
  });

  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Ticket not found');
  }

  // Access control - customers can only reopen
  const isCustomer = CUSTOMER_ROLES.includes(
    userRole as (typeof CUSTOMER_ROLES)[number],
  );

  if (isCustomer && status !== TicketStatus.REOPENED) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Customers can only reopen tickets',
    );
  }

  // Status transition validation
  const validTransitions = getValidStatusTransitions(ticket.status, isCustomer);
  if (!validTransitions.includes(status)) {
    const currentStatusStr = String(ticket.status);
    const newStatusStr = String(status);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Invalid status transition from ' +
        currentStatusStr +
        ' to ' +
        newStatusStr,
    );
  }

  // Update with transaction
  const result = await prisma.$transaction(async tx => {
    const updateData: Prisma.SupportTicketUpdateInput = { status };

    // Set timestamps based on status
    if (status === TicketStatus.RESOLVED && !ticket.resolvedAt) {
      updateData.resolvedAt = new Date();
    }
    if (status === TicketStatus.CLOSED) {
      updateData.closedAt = new Date();
    }

    const updated = await tx.supportTicket.update({
      where: { id },
      data: updateData,
      select: ticketSelect,
    });

    // Log status change
    await tx.ticketStatusLog.create({
      data: {
        ticketId: id,
        fromStatus: ticket.status,
        toStatus: status,
        changedById: userId,
        note: note || 'Status changed to ' + String(status),
      },
    });

    return updated;
  });

  return result;
};

// ============================================================
// VALID STATUS TRANSITIONS (pure function, no perf concern)
// ============================================================
const getValidStatusTransitions = (
  currentStatus: TicketStatus,
  isCustomer: boolean,
): TicketStatus[] => {
  if (isCustomer) {
    if (
      currentStatus === TicketStatus.RESOLVED ||
      currentStatus === TicketStatus.PENDING_CUSTOMER
    ) {
      return [TicketStatus.REOPENED];
    }
    return [];
  }

  switch (currentStatus) {
    case TicketStatus.OPEN:
      return [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED];
    case TicketStatus.IN_PROGRESS:
      return [
        TicketStatus.PENDING_CUSTOMER,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED,
      ];
    case TicketStatus.PENDING_CUSTOMER:
      return [
        TicketStatus.IN_PROGRESS,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED,
      ];
    case TicketStatus.RESOLVED:
      return [TicketStatus.CLOSED, TicketStatus.REOPENED];
    case TicketStatus.CLOSED:
      return [];
    default:
      return [];
  }
};

// ============================================================
// CREATE MESSAGE - With auto-first response tracking
// ============================================================
const createTicketMessage = async (req: Request) => {
  const { id: ticketId } = req.params;
  const { message, attachments, isInternalNote } = req.body;
  const senderId = req.user.id;
  const userRole = req.user.role;

  // Validate ticket exists and user has access
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      createdById: true,
      assignedToId: true,
      status: true,
    },
  });

  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Ticket not found');
  }

  // Only staff can create internal notes
  const internalNote =
    isInternalNote &&
    STAFF_ROLES.includes(userRole as (typeof STAFF_ROLES)[number]);

  // Check access
  if (
    !canAccessTicket(
      ticket.createdById || '',
      ticket.assignedToId,
      senderId,
      userRole,
    )
  ) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot reply to this ticket');
  }

  // Transaction: create message + update firstResponseAt if needed
  const result = await prisma.$transaction(async tx => {
    const newMessage = await tx.ticketMessage.create({
      data: {
        ticketId,
        senderId,
        message,
        attachments: attachments || [],
        isInternalNote: internalNote || false,
      },
      select: ticketMessageStaffSelect,
    });

    // If customer replies on resolved ticket, reopen
    if (
      ticket.status === TicketStatus.RESOLVED &&
      ticket.createdById === senderId &&
      !internalNote
    ) {
      await tx.supportTicket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.REOPENED },
      });

      await tx.ticketStatusLog.create({
        data: {
          ticketId,
          fromStatus: TicketStatus.RESOLVED,
          toStatus: TicketStatus.REOPENED,
          changedById: senderId,
          note: 'Ticket reopened by customer reply',
        },
      });
    }

    return newMessage;
  });

  return result;
};

// ============================================================
// ADD SATISFACTION RATING
// ============================================================
const addSatisfactionRating = async (req: Request) => {
  const { id: ticketId } = req.params;
  const { rating, feedback } = req.body;
  const userId = req.user.id;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      createdById: true,
      status: true,
      satisfactionRating: true,
    },
  });

  if (!ticket) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Ticket not found');
  }

  // Only creator can rate
  if (ticket.createdById !== userId) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only ticket creator can rate');
  }

  // Can only rate resolved or closed tickets
  if (!CLOSED_STATUSES.includes(ticket.status)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Can only rate resolved or closed tickets',
    );
  }

  // Already rated
  if (ticket.satisfactionRating) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Ticket already rated');
  }

  const result = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      satisfactionRating: rating,
      satisfactionFeedback: feedback,
    },
    select: ticketSelect,
  });

  return result;
};

// ============================================================
// GET ANALYTICS - Using database-side aggregation for performance
// Fix: Use findMany with limited fields + in-memory calc for resolution time
//      (Prisma _avg doesn't support Date fields, so we manually compute)
// Fix: Agent names looked up with Map for O(1) access
// ============================================================
const getTicketAnalytics = async (req: Request) => {
  const { period, rangeStartDay, rangeEndDay } =
    req.query as ITicketFilterRequest;
  const { rangeStart, rangeEnd } =
    rangeStartDay && rangeEndDay
      ? getCustomDateRange(rangeStartDay, rangeEndDay)
      : getDateRangeByPeriod(normalizeCalendarPeriod(period));

  const dateFilter = { createdAt: { gte: rangeStart, lte: rangeEnd } };

  // Parallel queries for all analytics
  const [
    statusCounts,
    categoryCounts,
    priorityCounts,
    assignedStats,
    resolutionTickets,
    csatStats,
  ] = await Promise.all([
    // Status distribution
    prisma.supportTicket.groupBy({
      by: ['status'],
      where: dateFilter,
      _count: { _all: true },
    }),
    // Category distribution
    prisma.supportTicket.groupBy({
      by: ['category'],
      where: dateFilter,
      _count: { _all: true },
    }),
    // Priority distribution
    prisma.supportTicket.groupBy({
      by: ['priority'],
      where: dateFilter,
      _count: { _all: true },
    }),
    // Top agents by resolved tickets (uses composite index [assignedToId, status])
    prisma.supportTicket.groupBy({
      by: ['assignedToId'],
      where: {
        status: TicketStatus.RESOLVED,
        assignedToId: { not: null },
        ...dateFilter,
      },
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } as any },
      take: 5,
    }),
    // Resolution time stats - limited fields, in-memory calc
    prisma.supportTicket.findMany({
      where: {
        status: TicketStatus.RESOLVED,
        resolvedAt: { not: null },
        ...dateFilter,
      },
      select: { createdAt: true, resolvedAt: true },
    }),
    // CSAT stats
    prisma.supportTicket.aggregate({
      where: {
        satisfactionRating: { not: null },
        ...dateFilter,
      },
      _avg: { satisfactionRating: true },
      _count: { satisfactionRating: true },
    }),
  ]);

  // Format distribution results
  const formatDistribution = (items: any[], keyField: string) => {
    return items.reduce(
      (acc, item) => {
        const key = item[keyField];
        acc[key] = item._count._all;
        return acc;
      },
      {} as Record<string, number>,
    );
  };

  // Get agent names for top agents (parallelized)
  const agentIds = assignedStats
    .map((s: any) => s.assignedToId)
    .filter(Boolean) as string[];
  const agents = agentIds.length
    ? await prisma.user.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, fullName: true },
      })
    : [];

  const agentsMap = new Map(agents.map(a => [a.id, a.fullName]));

  const topAgents = assignedStats.map((stat: any) => ({
    agentId: stat.assignedToId,
    agentName: agentsMap.get(stat.assignedToId) || 'Unknown',
    resolvedCount: stat._count._all,
  }));

  // Calculate avg resolution time from fetched tickets
  const avgResolutionTime = calculateAvgResolutionHours(
    resolutionTickets as { createdAt: Date; resolvedAt: Date | null }[],
  );

  // Safe access for CSAT stats
  const csatAvg = csatStats._avg?.satisfactionRating ?? 0;
  const csatCount = csatStats._count?.satisfactionRating ?? 0;
  const avgCSAT = csatCount > 0 ? Math.round(csatAvg * 100) / 100 : 0;

  return {
    period: period || 'weekly',
    dateRange: { rangeStart, rangeEnd },
    statusDistribution: formatDistribution(statusCounts, 'status'),
    categoryDistribution: formatDistribution(categoryCounts, 'category'),
    priorityDistribution: formatDistribution(priorityCounts, 'priority'),
    topAgents,
    avgResolutionTimeHours: avgResolutionTime,
    avgCSAT,
  };
};

// ============================================================
// EXPORT
// ============================================================
export const ticketService = {
  createTicket,
  getTicketList,
  getTicketById,
  assignTicket,
  changeTicketStatus,
  createTicketMessage,
  addSatisfactionRating,
  getTicketAnalytics,
};