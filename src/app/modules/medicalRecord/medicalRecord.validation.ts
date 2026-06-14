import { z } from 'zod';

const createSchema = z.object({
  bookingId: z.string().optional(),
  organizerRequestId: z.string().optional(),
  driverId: z.string().optional(),
  notes: z.string().optional(),
  result: z.enum(['Pending', 'Submitted']).optional(),
  expiryDate: z.coerce.date().optional(),
});

const updateSchema = z.object({
  result: z.enum(['Pending', 'Submitted']).optional(),
  notes: z.string().optional(),
  expiryDate: z.coerce.date().optional(),
});
export const medicalRecordValidation = {
  createSchema,
  updateSchema,
};