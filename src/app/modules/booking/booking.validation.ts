import { z } from 'zod';
import { PayType, BookingStatus } from '@prisma/client';

const createSchema = z.object({
  clinicId: z.string({ required_error: 'clinicId is required' }),
  timeSlotId: z.string({ required_error: 'timeSlotId is required' }),
  scheduledAt: z.coerce.date({ required_error: 'scheduledAt is required' }),
  paymentType: z.nativeEnum(PayType, {
    required_error: 'paymentType is required (Stripe or Paypal)',
  }),
  price: z.number({ required_error: 'price is required' }).positive(),
});

const updateSchema = z.object({
  timeSlotId: z.string().optional(),
  scheduledAt: z.coerce.date().optional(),
  status: z.nativeEnum(BookingStatus).optional(),
});

const rescheduleSchema = z.object({
  newTimeSlotId: z.string({ required_error: 'newTimeSlotId is required' }),
  newScheduledAt: z.coerce.date({ required_error: 'newScheduledAt is required' }),
});

const cancelSchema = z.object({
  reason: z.string().optional(),
});

export const bookingValidation = {
  createSchema,
  updateSchema,
  rescheduleSchema,
  cancelSchema,
};