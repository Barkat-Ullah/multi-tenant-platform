import { z } from 'zod';
import { TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';

// Create ticket validation
const createSchema = z.object({
  subject: z.string({ required_error: 'Subject is required' }).min(5, 'Subject must be at least 5 characters').max(200, 'Subject must not exceed 200 characters'),
  description: z.string({ required_error: 'Description is required' }).min(10, 'Description must be at least 10 characters'),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  relatedBookingId: z.string().optional(),
});

// Update ticket validation (admin only)
const updateSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(200).optional(),
  description: z.string().min(10, 'Description must be at least 10 characters').optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
});

// Assign ticket validation - assignedToId is optional (defaults to self-assign)
const assignSchema = z.object({
  assignedToId: z.string().optional(),
});

// Status change validation
const statusChangeSchema = z.object({
  status: z.nativeEnum(TicketStatus, { required_error: 'Status is required' }),
  note: z.string().optional(),
});

// Create message validation (attachments come from file uploads, not JSON body)
const createMessageSchema = z.object({
  message: z.string({ required_error: 'Message is required' }).min(1, 'Message cannot be empty'),
  isInternalNote: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform(val => {
      if (typeof val === 'string') return val === 'true' || val === '1';
      return val;
    }),
});

// Satisfaction rating validation
const satisfactionSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(500, 'Feedback must not exceed 500 characters').optional(),
});

export const ticketValidation = {
  createSchema,
  updateSchema,
  assignSchema,
  statusChangeSchema,
  createMessageSchema,
  satisfactionSchema,
};