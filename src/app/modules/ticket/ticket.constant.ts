// Ticket status and priority constants for performance
import { TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';

// Closed statuses for filtering - used in queries to avoid re-computation
export const CLOSED_STATUSES: TicketStatus[] = [
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
];

// Terminal statuses that prevent further modifications
export const TERMINAL_STATUSES: TicketStatus[] = [
  TicketStatus.CLOSED,
];

// Statuses where customer can reply (reopen)
export const REPLYABLE_STATUSES: TicketStatus[] = [
  TicketStatus.PENDING_CUSTOMER,
  TicketStatus.RESOLVED,
];

// Role-based access mapping (const assertions for type safety)
export const CUSTOMER_ROLES = ['USER', 'ORGINIZER', 'CLINIC'] as const;
export const STAFF_ROLES = ['ADMIN', 'SUPERADMIN'] as const;

// Pagination defaults
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

// Searchable fields for ticket search
// Note: Cross-entity search (createdBy.email, createdBy.fullName) uses
// Prisma relational syntax, which is handled in buildSearchConditions
export const ticketSearchableFields = [
  'subject',
  'description',
] as const;

// Analytics date range periods
export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly';

// Default ticket number prefix
export const TICKET_NUMBER_PREFIX = 'TKT';