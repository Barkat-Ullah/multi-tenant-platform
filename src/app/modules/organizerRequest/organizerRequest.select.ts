import { Prisma } from '@prisma/client';

/**
 * ✏️  MANUALLY EDITABLE SELECT
 *
 * • Scalar fields  → set to `true` (included) or `false` / remove line (excluded)
 * • Relation fields → uncomment and customize the nested select as needed
 *
 * This file is generated ONCE. The generator will never overwrite it.
 */
export const organizerRequestSelect = {
  id: true,
  userId: true,
  serviceId: true,
  clinicId: true,
  companyName: true,
  email: true,
  phone: true,
  location: true,
  totalDriver: true,
  status: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  // organizer: { select: { id: true } }, // ← uncomment to include relation
  // clinic: { select: { id: true } }, // ← uncomment to include relation
  // service: { select: { id: true } }, // ← uncomment to include relation
  // drivers: { select: { id: true } }, // ← uncomment to include relation
  // medicalRecords: { select: { id: true } }, // ← uncomment to include relation
} satisfies Prisma.OrganizerRequestSelect;