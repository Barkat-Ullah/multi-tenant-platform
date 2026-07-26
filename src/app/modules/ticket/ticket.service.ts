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
  handleTicketAttachmentUploads,
  STAFF_ROLES,
} from './ticket.constant';
import {
  ticketCreatedUserEmail,
  ticketCreatedAdminEmail,
} from '../../utils/sendMail';
import { mailQueue } from '../../helpers/queue';
import { cacheOr, CacheKeys, TTL, CacheInvalidator } from '../../../lib/redis';

// Types for filters
type ITicketFilterRequest = {
  searchTerm?: string;
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
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
  const userRole = req.user.role;
  const {
    subject,
    description,
    category,
    priority,
    relatedBookingId,
    createdById: bodyCreatedById,
  } = req.body;

  // Admin/SuperAdmin can create a ticket on behalf of another user
  const isAdmin = [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN].includes(
    userRole,
  );
  const ticketOwnerId =
    isAdmin && bodyCreatedById ? bodyCreatedById : req.user.id;

  // If admin provides a createdById, validate that user exists
  if (isAdmin && bodyCreatedById) {
    const targetUser = await prisma.user.findUnique({
      where: { id: bodyCreatedById },
      select: { id: true },
    });
    if (!targetUser) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        'User not found for createdById',
      );
    }
  }

  // ATOMIC TRANSACTION: Validate booking + generate number + create ticket + notify admins
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
        createdById: ticketOwnerId,
        relatedBookingId,
      },
      select: ticketSelect,
    });

    // Create initial message from description
    await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: ticketOwnerId,
        message: description,
      },
    });

    // Log initial status
    await tx.ticketStatusLog.create({
      data: {
        ticketId: ticket.id,
        fromStatus: null,
        toStatus: TicketStatus.OPEN,
        changedById: ticketOwnerId,
        note: 'Ticket created',
      },
    });

    // Get all admins for in-app notification
    const admins = await tx.user.findMany({
      where: {
        role: { in: [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN] },
        isDeleted: false,
      },
      select: { id: true },
    });

    // Create in-app notification for each admin
    for (const admin of admins) {
      await tx.notification.create({
        data: {
          receiverId: admin.id,
          senderId: ticketOwnerId,
          title: 'New Support Ticket',
          body: `Ticket ${ticketNumber}: ${subject.substring(0, 100)}`,
          type: 'Message',
          referenceId: ticket.id,
        },
      });
    }

    return { ticket, admins };
  });

  await CacheInvalidator.onRecordCreate('supportTicket');

  // ============================================================
  // QUEUE EMAILS via BullMQ (non-blocking)
  // ============================================================

  // Email to ticket creator
  const creator = await prisma.user.findUnique({
    where: { id: ticketOwnerId },
    select: { email: true, fullName: true },
  });

  if (creator?.email) {
    mailQueue
      .add('send-email', {
        type: 'ticket-created-user',
        to: creator.email,
        html: ticketCreatedUserEmail(
          creator.fullName,
          result.ticket.ticketNumber,
          subject,
        ),
        subject: `Support Ticket Created: ${result.ticket.ticketNumber}`,
      })
      .catch(err => console.error('Ticket creator email queue failed:', err));
  }

  // Email to each admin
  const admins = result.admins?.length
    ? await prisma.user.findMany({
        where: {
          id: { in: result.admins.map(a => a.id) },
        },
        select: { email: true, fullName: true },
      })
    : [];

  const creatorName = creator?.fullName ?? 'A user';
  for (const admin of admins) {
    if (admin.email) {
      mailQueue
        .add('send-email', {
          type: 'ticket-created-admin',
          to: admin.email,
          html: ticketCreatedAdminEmail(
            admin.fullName,
            creatorName,
            result.ticket.ticketNumber,
            subject,
          ),
          subject: `New Support Ticket: ${result.ticket.ticketNumber}`,
        })
        .catch(err => console.error('Admin ticket email queue failed:', err));
    }
  }

  return result.ticket;
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

  const userRole = req.user.role;
  const userId = req.user.id;
  // console.log(userId);

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

  const cacheKey = await CacheKeys.list('supportTicket', {
    page,
    limit,
    searchTerm,
    ...filterData,
    userId,
    userRole,
  });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
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
    return { meta: { total, page, limit }, data: result };
  });

  return cached ?? { meta: { total: 0, page, limit }, data: [] };
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

  // Fetch ticket detail first — skip message queries if ticket missing
  const cacheKey = await CacheKeys.single('supportTicket', id);
  const ticketData = await cacheOr(cacheKey, TTL.MEDIUM, () =>
    prisma.supportTicket.findUnique({ where: { id }, select: ticketSelect }),
  );

  if (!ticketData) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Ticket not found');
  }

  // Access control (must check before caching messages for this user)
  if (!canAccessTicket(ticketData.createdById || '', userId, userRole)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot access this ticket');
  }

  // Cache messages per ticket + pagination + role (staff sees internal notes, customer doesn't)
  const messageWhere = {
    ticketId: id,
    ...(canSeeInternalNotes(userRole) ? {} : { isInternalNote: false }),
  };
  const messageCacheKey = await CacheKeys.list('ticketMessage', {
    ticketId: id,
    page: messagePage,
    limit: messageLimit,
    userRole,
  });
  const cachedMessages = await cacheOr(messageCacheKey, TTL.SHORT, async () => {
    const [count, msgs] = await Promise.all([
      prisma.ticketMessage.count({ where: messageWhere }),
      prisma.ticketMessage.findMany({
        where: messageWhere,
        select: ticketMessageCustomerSelect,
        orderBy: { createdAt: 'asc' as const },
        skip: messageSkip,
        take: messageLimit,
      }),
    ]);
    return { total: count, messages: msgs };
  });

  const totalMessages = cachedMessages?.total ?? 0;
  const messages = cachedMessages?.messages ?? [];

  return {
    ...ticketData,
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

  await CacheInvalidator.onRecordUpdate('supportTicket', id);

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
  const { message, isInternalNote } = req.body;

  // Default message to empty string if not provided (allows attachment-only messages)
  const messageText = message || '';

  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  const uploadedAttachments = await handleTicketAttachmentUploads(files);

  const senderId = req.user.id;
  const userRole = req.user.role;

  // Validate ticket exists and user has access
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      createdById: true,
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
  if (!canAccessTicket(ticket.createdById || '', senderId, userRole)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot reply to this ticket');
  }

  // Transaction: create message + update firstResponseAt if needed
  const result = await prisma.$transaction(async tx => {
    const newMessage = await tx.ticketMessage.create({
      data: {
        ticketId,
        senderId,
        message: messageText,
        attachments: uploadedAttachments,
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

  // Invalidate ticket cache (message added, possibly status changed)
  await Promise.all([
    CacheInvalidator.onRecordUpdate('supportTicket', ticketId),
    CacheInvalidator.onRecordCreate('ticketMessage'),
  ]);

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

  await CacheInvalidator.onRecordUpdate('supportTicket', ticketId);
  return result;
};

// ============================================================
// GET ANALYTICS - Using database-side aggregation for performance
// ============================================================
const getTicketAnalytics = async (req: Request) => {
  const { period, rangeStartDay, rangeEndDay } =
    req.query as ITicketFilterRequest;
  const { rangeStart, rangeEnd } =
    rangeStartDay && rangeEndDay
      ? getCustomDateRange(rangeStartDay, rangeEndDay)
      : getDateRangeByPeriod(normalizeCalendarPeriod(period));

  const cacheKey = await CacheKeys.list('supportTicket', {
    analytics: true,
    period: period || 'weekly',
    rangeStartDay: rangeStartDay || '',
    rangeEndDay: rangeEndDay || '',
  });

  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const dateFilter = { createdAt: { gte: rangeStart, lte: rangeEnd } };

    // Parallel queries for all analytics
    const [
      statusCounts,
      categoryCounts,
      priorityCounts,
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
      avgResolutionTimeHours: avgResolutionTime,
      avgCSAT,
    };
  });

  return (
    cached ?? {
      period: period || 'weekly',
      dateRange: { rangeStart, rangeEnd },
      statusDistribution: {},
      categoryDistribution: {},
      priorityDistribution: {},
      avgResolutionTimeHours: 0,
      avgCSAT: 0,
    }
  );
};

// ============================================================
// EXPORT
// ============================================================
export const ticketService = {
  createTicket,
  getTicketList,
  getTicketById,
  changeTicketStatus,
  createTicketMessage,
  addSatisfactionRating,
  getTicketAnalytics,
};
