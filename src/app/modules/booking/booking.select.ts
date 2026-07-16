import { Prisma } from '@prisma/client';

export const bookingSelect = {
  id: true,
  serviceId: true,
  driverId: true,
  clinicId: true,
  timeSlotId: true,
  paymethodId: true,
  scheduledAt: true,
  status: true,
  createdAt: true,
  bookedBy: true,
  driver: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      licenseNo: true,
      medicalStatus: true,
    },
  },
  clinic: {
    select: {
      id: true,
      fullName: true,
      clinicGmcNumber: true,
      location: {
        select: { id: true, locationName: true },
      },
    },
  },
  timeSlot: {
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      duration: true,
      status: true,
    },
  },
  service: {
    select: { id: true, title: true, description: true },
  },
  method: {
    select: { id: true, type: true, isActive: true },
  },
  payment: {
    select: { id: true, status: true, amount: true },
  },
  medicalRecord: {
    select: { id: true, result: true },
  },
} satisfies Prisma.BookingSelect;
