import { Prisma } from '@prisma/client';

/**
 * ✏️  MANUALLY EDITABLE SELECT
 *
 * • Scalar fields  → set to `true` (included) or `false` / remove line (excluded)
 * • Relation fields → uncomment and customize the nested select as needed
 *
 * This file is generated ONCE. The generator will never overwrite it.
 */
export const medicalRecordSelect = {
  id: true,
  clinicId: true,
  bookingId: true,
  driverId: true,
  result: true,
  files: true,
  notes: true,
  expiryDate: true,
  createdAt: true,
  updatedAt: true,
  clinic: { select: { email: true } }, // ← uncomment to include relation
  // booking: { select: { id: true } }, // ← uncomment to include relation
  // driver: { select: { id: true } }, // ← uncomment to include relation
} satisfies Prisma.MedicalRecordSelect;
