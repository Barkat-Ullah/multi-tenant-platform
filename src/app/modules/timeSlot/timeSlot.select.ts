import { Prisma } from '@prisma/client';

export const availabilitySelect = {
  id: true,
  clinicId: true,
  slotDate: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClinicAvailabilitySelect;

export const timeSlotSelect = {
  id: true,
  availabilityId: true,
  clinicId: true,
  date: true,
  duration: true,
  startTime: true,
  endTime: true,
  capacity: true,
  booked: true,
  isBooked: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TimeSlotSelect;