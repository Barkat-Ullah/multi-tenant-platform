import { Prisma } from '@prisma/client';
import { AnalyticsPeriod, STAFF_ROLES } from './ticket.constant';

// UTC-based date range helpers (reusable across services)
export const getDateRangeByPeriod = (period: AnalyticsPeriod) => {
  const now = new Date();

  if (period === 'daily') {
    return {
      rangeStart: new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          0,
          0,
          0,
          0,
        ),
      ),
      rangeEnd: new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      ),
    };
  }

  if (period === 'weekly') {
    const utcDay = now.getUTCDay();
    const diffToMonday = utcDay === 0 ? 6 : utcDay - 1;

    const rangeStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - diffToMonday,
        0,
        0,
        0,
        0,
      ),
    );

    return {
      rangeStart,
      rangeEnd: new Date(
        Date.UTC(
          rangeStart.getUTCFullYear(),
          rangeStart.getUTCMonth(),
          rangeStart.getUTCDate() + 6,
          23,
          59,
          59,
          999,
        ),
      ),
    };
  }

  // monthly
  return {
    rangeStart: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    ),
    rangeEnd: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    ),
  };
};

// Custom date range parser
export const getCustomDateRange = (
  rangeStartDay: string,
  rangeEndDay: string,
) => {
  const start = new Date(rangeStartDay);
  const end = new Date(rangeEndDay);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error(
      'Invalid rangeStartDay or rangeEndDay format. Use YYYY-MM-DD.',
    );
  }

  if (start > end) {
    throw new Error('rangeStartDay cannot be after rangeEndDay');
  }

  const rangeStart = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  const rangeEnd = new Date(
    Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  return { rangeStart, rangeEnd };
};

// Normalize calendar period
export const normalizeCalendarPeriod = (period?: string): AnalyticsPeriod => {
  const normalized = period?.toLowerCase();

  if (
    normalized === 'daily' ||
    normalized === 'weekly' ||
    normalized === 'monthly'
  ) {
    return normalized;
  }

  return 'weekly';
};

// Build filter conditions for tickets - optimized for single query
export const buildFilterConditions = (
  filterData: Record<string, any>,
): Prisma.SupportTicketWhereInput[] => {
  const andConditions: Prisma.SupportTicketWhereInput[] = [];

  // Direct field filters (optimized - no N+1)
  if (filterData.status) {
    andConditions.push({ status: filterData.status });
  }

  if (filterData.category) {
    andConditions.push({ category: filterData.category });
  }

  if (filterData.priority) {
    andConditions.push({ priority: filterData.priority });
  }

  if (filterData.assignedToId) {
    andConditions.push({ assignedToId: filterData.assignedToId });
  }

  if (filterData.createdById) {
    andConditions.push({ createdById: filterData.createdById });
  }

  // Date range filter
  if (filterData.startDate || filterData.endDate) {
    andConditions.push({
      createdAt: {
        gte: filterData.startDate ? new Date(filterData.startDate) : undefined,
        lte: filterData.endDate ? new Date(filterData.endDate) : undefined,
      },
    });
  }

  // Booking relation filter
  if (filterData.bookingId) {
    andConditions.push({ relatedBookingId: filterData.bookingId });
  }

  return andConditions;
};

// Build search conditions - supports cross-entity search across creator fields
// Uses a single OR condition for efficient query execution
export const buildSearchConditions = (
  searchTerm?: string,
): Prisma.SupportTicketWhereInput[] => {
  if (!searchTerm) return [];

  return [
    {
      OR: [
        { subject: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        // Cross-entity search via creator relation
        { ticketNumber: { contains: searchTerm, mode: 'insensitive' } },
        {
          createdBy: {
            fullName: { contains: searchTerm, mode: 'insensitive' },
          },
        },
        {
          createdBy: {
            email: { contains: searchTerm, mode: 'insensitive' },
          },
        },
      ],
    },
  ];
};

// Check if user can access ticket (reusable guard)
// Optimized: uses const STAFF_ROLES from constant to avoid array re-allocation
export const canAccessTicket = (
  ticketCreatedById: string,
  ticketAssignedToId: string | null | undefined,
  userId: string,
  userRole: string,
) => {
  if (STAFF_ROLES.includes(userRole as (typeof STAFF_ROLES)[number])) return true;

  return ticketCreatedById === userId;
};

// Check if user can see internal notes
export const canSeeInternalNotes = (userRole: string): boolean => {
  return STAFF_ROLES.includes(userRole as (typeof STAFF_ROLES)[number]);
};

// Generate ticket number (prefixed with zero-padded sequence)
export const formatTicketNumber = (seq: number): string => {
  return `TKT-${String(seq).padStart(7, '0')}`;
};

// Calculate average resolution time in hours
export const calculateAvgResolutionHours = (
  tickets: { createdAt: Date; resolvedAt: Date | null }[],
): number => {
  const resolved = tickets.filter(t => t.resolvedAt);

  if (resolved.length === 0) return 0;

  const totalMs = resolved.reduce(
    (sum, t) => sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()),
    0,
  );

  return Math.round((totalMs / (resolved.length * 3600 * 1000)) * 100) / 100;
};

// Alias for backwards compatibility
export const calculateAvgResolutionTime = calculateAvgResolutionHours;
