import { Prisma } from '@prisma/client';

// Optimized select objects to prevent N+1 queries
// All relations are explicitly selected in single queries

// User mini profile - used across multiple selects
const userMiniSelect = {
  id: true,
  fullName: true,
  email: true,
  image: true,
} satisfies Prisma.UserSelect;

// Ticket message select for customer view (excludes internal notes)
export const ticketMessageCustomerSelect = {
  id: true,
  message: true,
  attachments: true,
  isInternalNote: true,
  createdAt: true,
  sender: {
    select: userMiniSelect,
  },
} satisfies Prisma.TicketMessageSelect;

// Ticket message select for staff view (includes all)
export const ticketMessageStaffSelect = {
  id: true,
  message: true,
  attachments: true,
  isInternalNote: true,
  createdAt: true,
  sender: {
    select: userMiniSelect,
  },
} satisfies Prisma.TicketMessageSelect;

// Status log select
export const ticketStatusLogSelect = {
  id: true,
  fromStatus: true,
  toStatus: true,
  note: true,
  createdAt: true,
  changedBy: {
    select: userMiniSelect,
  },
} satisfies Prisma.TicketStatusLogSelect;

// Related booking select (minimal data)
const relatedBookingSelect = {
  id: true,
  scheduledAt: true,
  status: true,
  clinic: {
    select: userMiniSelect,
  },
  driver: {
    select: userMiniSelect,
  },
  service: {
    select: {
      id: true,
      title: true,
    },
  },
} satisfies Prisma.BookingSelect;

// Full ticket select for customer view (excludes internal notes)
export const ticketSelect = {
  id: true,
  ticketNumber: true,
  subject: true,
  description: true,
  category: true,
  priority: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  firstResponseAt: true,
  resolvedAt: true,
  closedAt: true,
  satisfactionRating: true,
  satisfactionFeedback: true,
  createdById: true,
  assignedToId: true,
  createdBy: {
    select: userMiniSelect,
  },
  assignedTo: {
    select: userMiniSelect,
  },
  relatedBooking: {
    select: relatedBookingSelect,
  },
  messages: {
    select: ticketMessageCustomerSelect,
    orderBy: { createdAt: 'asc' },
  },
  statusLogs: {
    select: ticketStatusLogSelect,
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.SupportTicketSelect;

// Ticket list item select (minimal for listing)
export const ticketListItemSelect = {
  id: true,
  ticketNumber: true,
  subject: true,
  category: true,
  priority: true,
  status: true,
  createdAt: true,
  firstResponseAt: true,
  resolvedAt: true,
  closedAt: true,
  satisfactionRating: true,
  createdBy: {
    select: userMiniSelect,
  },
  assignedTo: {
    select: userMiniSelect,
  },
  // Last message preview for listing
  messages: {
    take: 1,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      message: true,
      isInternalNote: true,
      createdAt: true,
    },
  },
  _count: {
    select: { messages: true },
  },
} satisfies Prisma.SupportTicketSelect;

// Analytics ticket select (aggregated data)
export const ticketAnalyticsSelect = {
  id: true,
  status: true,
  category: true,
  priority: true,
  createdAt: true,
  resolvedAt: true,
  closedAt: true,
  assignedTo: {
    select: {
      id: true,
      fullName: true,
    },
  },
} satisfies Prisma.SupportTicketSelect;