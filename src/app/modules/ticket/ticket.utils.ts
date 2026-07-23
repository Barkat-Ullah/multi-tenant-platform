import { Prisma } from '@prisma/client';
import { STAFF_ROLES } from './ticket.constant';
import {
  getDateRangeByPeriod,
  getCustomDateRange,
  normalizeCalendarPeriod,
} from '../../utils/dateRange';

// Re-export for backward compatibility
export { getDateRangeByPeriod, getCustomDateRange, normalizeCalendarPeriod };

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
