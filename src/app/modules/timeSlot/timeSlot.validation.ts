import { z } from 'zod';
import { SlotStatus } from '@prisma/client';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // "09:00" — "23:59"

const createAvailabilitySchema = z.object({
  slotDate: z.coerce.date({ required_error: 'slotDate is required' }),
  startTime: z
    .string({ required_error: 'startTime is required' })
    .regex(timeRegex, 'startTime must be in HH:MM format e.g. 09:00'),
  endTime: z
    .string({ required_error: 'endTime is required' })
    .regex(timeRegex, 'endTime must be in HH:MM format e.g. 17:00'),
  offDays: z
    .array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
    .optional()
    .default([]),
  capacity: z.number().int().min(1).optional().default(1),
});

const addSingleSlotSchema = z.object({
  date: z.coerce.date({ required_error: 'date is required' }),
  startTime: z
    .string({ required_error: 'startTime is required' })
    .regex(timeRegex, 'startTime must be in HH:MM format e.g. 09:00'),
  endTime: z
    .string({ required_error: 'endTime is required' })
    .regex(timeRegex, 'endTime must be in HH:MM format e.g. 17:00'),
});

export const clinicAvailabilityValidation = {
  createAvailabilitySchema,
  addSingleSlotSchema,
};