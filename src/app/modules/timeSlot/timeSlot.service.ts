import { Request } from 'express';
import prisma from '../../utils/prisma';
import ApiError from '../../errors/AppError';
import httpStatus from 'http-status';
import { SlotStatus, UserRoleEnum } from '@prisma/client';
import { availabilitySelect, timeSlotSelect } from './timeSlot.select';
import { cacheOr, CacheKeys, TTL, CacheInvalidator } from '../../../lib/redis';

// -------------------------------------------------------
// helper — "09:00" → "09:00 AM" / "13:00" → "01:00 PM"
// -------------------------------------------------------
const formatAMPM = (time: string): string => {
  const [hourStr, minute] = time.split(':');
  let hour = parseInt(hourStr);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
};

// -------------------------------------------------------
// helper — generate 30min slots between openTime and closeTime
// -------------------------------------------------------
const generateSlots = (
  openTime: string,
  closeTime: string,
  duration: number,
) => {
  const slots: { startTime: string; endTime: string; nextDay: boolean }[] = [];

  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);

  const openTotal = openH * 60 + openM;
  let closeTotal = closeH * 60 + closeM;

  // if endTime <= startTime it means overnight — add 24hrs to closeTotal
  const isOvernight = closeTotal <= openTotal;
  if (isOvernight) {
    closeTotal += 24 * 60;
  }

  let current = openTotal;

  while (current + duration <= closeTotal) {
    const startMins = current % (24 * 60);
    const endMins = (current + duration) % (24 * 60);

    const startH = Math.floor(startMins / 60);
    const startM = startMins % 60;
    const endH = Math.floor(endMins / 60);
    const endM = endMins % 60;

    const startTime = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`;
    const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    // nextDay flag so service knows which date to assign
    slots.push({
      startTime,
      endTime,
      nextDay: current >= 24 * 60,
    });

    current += duration;
  }

  return slots;
};

// -------------------------------------------------------
// create availability + auto-generate 30min slots
// -------------------------------------------------------
const createAvailabilityWithSlots = async (req: Request) => {
  const userRole = req.user.role;
  const {
    slotDate,
    startTime,
    endTime,
    capacity,
    clinicId: bodyClinicId,
  } = req.body;

  // Admin/SuperAdmin must provide a clinicId; otherwise use the authenticated clinic's id
  const isAdmin = [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN].includes(
    userRole,
  );
  const clinicId = isAdmin ? bodyClinicId : req.user.id;

  if (isAdmin && !bodyClinicId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'clinicId is required when admin creates availability',
    );
  }

  // validate time
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const isOvernight = sh * 60 + sm >= eh * 60 + em;

  const slotDateObj = new Date(slotDate);
  const nextDayObj = new Date(slotDateObj);
  nextDayObj.setDate(nextDayObj.getDate() + 1);

  // get clinic's offDays from profile
  const clinic = await prisma.user.findUnique({
    where: { id: clinicId },
    select: { offDays: true },
  });

  if (!clinic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Clinic not found');
  }

  // // check if selected date is an off day
  // const dayName = slotDateObj
  //   .toLocaleDateString('en-US', { weekday: 'short' })
  //   .toLowerCase();

  // if (clinic.offDays.includes(dayName)) {
  //   throw new ApiError(
  //     httpStatus.BAD_REQUEST,
  //     `Cannot create availability on off day (${dayName}). Your off days are: ${clinic.offDays.join(', ')}`,
  //   );
  // }

  const availability = await prisma.clinicAvailability.upsert({
    where: { clinicId_slotDate: { clinicId, slotDate: slotDateObj } },
    update: { isActive: true, updatedAt: new Date() },
    create: { clinicId, slotDate: slotDateObj, isActive: true },
    select: availabilitySelect,
  });
  //hard coded slot generate time 30 min
  const slots = generateSlots(startTime, endTime, 30);

  await prisma.timeSlot.deleteMany({
    where: { availabilityId: availability.id },
  });

  const createdSlots = await Promise.all(
    slots.map(slot =>
      prisma.timeSlot.create({
        data: {
          availabilityId: availability.id,
          clinicId,
          date: slot.nextDay ? nextDayObj : slotDateObj,
          startTime: slot.startTime,
          endTime: slot.endTime,
          duration: 30,
          capacity: capacity ?? 100,
          booked: 0,
          isBooked: false,
          status: SlotStatus.Active,
        },
        select: timeSlotSelect,
      }),
    ),
  );

  await CacheInvalidator.onRelatedChange('timeSlot');

  return {
    availability,
    isOvernight,
    slotsCreated: createdSlots.length,
    slots: createdSlots.map(s => ({
      id: s.id,
      date: s.date.toISOString().split('T')[0],
      startTime: formatAMPM(s.startTime),
      endTime: formatAMPM(s.endTime),
      status: s.status,
    })),
  };
};

// -------------------------------------------------------
// get availability by month — calendar view
// -------------------------------------------------------
const getAvailabilityByMonth = async (req: Request) => {
  const clinicId = req.user.id;
  const { month } = req.query;

  if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Invalid month format. Use YYYY-MM',
    );
  }

  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr);
  const monthIndex = parseInt(monthStr) - 1;

  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 1));

  const cacheKey = await CacheKeys.list('timeSlot', { clinicId, month, scope: 'availability' });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const [clinic, availabilities] = await Promise.all([
      prisma.user.findUnique({
        where: { id: clinicId },
        select: { offDays: true },
      }),
      prisma.clinicAvailability.findMany({
        where: {
          clinicId,
          slotDate: { gte: monthStart, lt: monthEnd },
          isActive: true,
        },
        select: { slotDate: true, isActive: true },
        orderBy: { slotDate: 'asc' },
      }),
    ]);

    const offDays = clinic?.offDays ?? [];

    const availMap = new Map(
      availabilities.map(a => [a.slotDate.toISOString().split('T')[0], a]),
    );

    const allDates: string[] = [];
    const cursor = new Date(monthStart);
    while (cursor < monthEnd) {
      allDates.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }

    const data = allDates.map(date => {
      const dayName = new Date(date)
        .toLocaleDateString('en-US', { weekday: 'short' })
        .toLowerCase();

      const isOffDay = offDays.includes(dayName);
      const existing = availMap.get(date);

      return {
        date,
        isActive: existing?.isActive ?? false,
        status: isOffDay
          ? 'off'
          : existing?.isActive
            ? 'available'
            : 'unavailable',
      };
    });

    return { month, offDays, daysInMonth: data.length, data };
  });

  return cached ?? { month, offDays: [], daysInMonth: 0, data: [] };
};

// -------------------------------------------------------
// get slots by date — time slot picker for driver
// -------------------------------------------------------
const getSlotsByDate = async (req: Request) => {
  const { serviceId, clinicId, date } = req.query as {
    serviceId: string;
    clinicId: string;
    date: string;
  };

  if (!clinicId || !date) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'clinicId and date are required',
    );
  }

  const dateObj = new Date(date);
  const dayName = dateObj
    .toLocaleDateString('en-US', { weekday: 'short' })
    .toLowerCase();

  const cacheKey = await CacheKeys.list('timeSlot', { clinicId, date, serviceId, scope: 'slots' });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const clinic = await prisma.user.findUnique({
      where: { id: clinicId },
      select: { id: true, offDays: true, fullName: true },
    });

    if (!clinic) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Clinic not found');
    }

    if (clinic.offDays.includes(dayName)) {
      return {
        date,
        isAvailable: false,
        reason: `Clinic is closed on ${dayName}`,
        offDays: clinic.offDays,
        slots: [],
      };
    }

    const availability = await prisma.clinicAvailability.findUnique({
      where: { clinicId_slotDate: { clinicId, slotDate: dateObj } },
      include: {
        timeSlots: {
          where: { status: SlotStatus.Active },
          orderBy: { startTime: 'asc' },
          select: timeSlotSelect,
        },
      },
    });

    if (!availability || !availability.isActive) {
      return {
        date,
        isAvailable: false,
        reason: 'No availability set for this date',
        offDays: clinic.offDays,
        slots: [],
      };
    }

    return {
      date,
      serviceId: serviceId ?? null,
      clinicId: clinic.id,
      isAvailable: true,
      totalSlots: availability.timeSlots.length,
      slots: availability.timeSlots.map(s => ({
        id: s.id,
        startTime: formatAMPM(s.startTime),
        endTime: formatAMPM(s.endTime),
        capacity: s.capacity,
        booked: s.booked,
        isBooked: s.isBooked,
        status: s.status,
      })),
    };
  });

  return cached ?? {
    date,
    isAvailable: false,
    reason: 'No availability found',
    offDays: [],
    slots: [],
  };
};

// -------------------------------------------------------
// add single custom slot
// -------------------------------------------------------
const addSingleSlot = async (req: Request) => {
  const clinicId = req.user.id;
  const { date, startTime, endTime } = req.body;

  const dateObj = new Date(date);

  const availability = await prisma.clinicAvailability.findUnique({
    where: { clinicId_slotDate: { clinicId, slotDate: dateObj } },
    include: {
      timeSlots: {
        select: { startTime: true, endTime: true, status: true },
      },
    },
  });

  if (!availability) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'No availability found for this date. Create availability first.',
    );
  }

  // check conflict
  const conflict = availability.timeSlots.find(
    s => s.startTime === startTime || s.endTime === endTime,
  );
  if (conflict) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Slot conflict with existing slot ${formatAMPM(conflict.startTime)} - ${formatAMPM(conflict.endTime)}`,
    );
  }

  const slot = await prisma.timeSlot.create({
    data: {
      availabilityId: availability.id,
      clinicId,
      date: dateObj,
      startTime,
      endTime,
      duration: 30,
      capacity: 1,
      booked: 0,
      isBooked: false,
      status: SlotStatus.Active,
    },
    select: timeSlotSelect,
  });

  await CacheInvalidator.onRelatedChange('timeSlot');

  return {
    id: slot.id,
    startTime: formatAMPM(slot.startTime),
    endTime: formatAMPM(slot.endTime),
    status: slot.status,
  };
};

// -------------------------------------------------------
// toggle slot Active <-> Inactive
// -------------------------------------------------------
const toggleSlotStatus = async (req: Request) => {
  const { id } = req.params;
  const userRole = req.user.role;
  const userId = req.user.id;

  const isAdmin = [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN].includes(
    userRole,
  );

  const slot = await prisma.timeSlot.findUnique({
    where: { id },
    include: {
      clinicAvailable: { select: { clinicId: true } },
    },
  });

  if (!slot) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Slot not found');
  }

  // Admin/SuperAdmin can toggle any slot; clinic can only toggle their own
  if (!isAdmin && slot.clinicAvailable.clinicId !== userId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'This slot does not belong to you',
    );
  }

  if (slot.isBooked && slot.status === SlotStatus.Active) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot deactivate a booked slot',
    );
  }

  const newStatus =
    slot.status === SlotStatus.Active ? SlotStatus.Inactive : SlotStatus.Active;

  const updated = await prisma.timeSlot.update({
    where: { id },
    data: { status: newStatus },
    select: timeSlotSelect,
  });

  await CacheInvalidator.onRelatedChange('timeSlot');

  return {
    id: updated.id,
    startTime: formatAMPM(updated.startTime),
    endTime: formatAMPM(updated.endTime),
    status: updated.status,
    isBooked: updated.isBooked,
  };
};

// -------------------------------------------------------
// get my availability list — clinic dashboard
// -------------------------------------------------------
const getMyAvailability = async (req: Request) => {
  const clinicId = req.user.id;

  const availabilities = await prisma.clinicAvailability.findMany({
    where: { clinicId, isActive: true },
    orderBy: { slotDate: 'asc' },
    select: {
      ...availabilitySelect,
      timeSlots: {
        select: {
          id: true,
          startTime: true,
          endTime: true,
          capacity: true,
          booked: true,
          isBooked: true,
          status: true,
        },
        orderBy: { startTime: 'asc' },
      },
    },
  });

  return availabilities.map(a => ({
    ...a,
    timeSlots: a.timeSlots.map(s => ({
      ...s,
      startTime: formatAMPM(s.startTime),
      endTime: formatAMPM(s.endTime),
    })),
  }));
};

// -------------------------------------------------------
// delete availability + cascade deletes all its slots
// -------------------------------------------------------
const deleteAvailability = async (req: Request) => {
  const { id } = req.params;
  const clinicId = req.user.id;

  const availability = await prisma.clinicAvailability.findFirst({
    where: { id, clinicId },
  });

  if (!availability) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Availability not found');
  }

  await prisma.clinicAvailability.delete({ where: { id } });

  await CacheInvalidator.onRelatedChange('timeSlot');

  return null;
};

const updateOffDays = async (req: Request) => {
  const clinicId = req.user.id;
  const { offDays } = req.body; // ["sat","sun"]

  const updated = await prisma.user.update({
    where: { id: clinicId },
    data: { offDays },
    select: { id: true, fullName: true, offDays: true },
  });

  // Invalidate timeSlot caches (offDays affects availability queries)
  await CacheInvalidator.onRelatedChange('timeSlot');

  return updated;
};

// -------------------------------------------------------
// toggle availability active/inactive for a specific date (clinic/admin/superadmin)
// -------------------------------------------------------
const toggleAvailabilityDateStatus = async (req: Request) => {
  const userRole = req.user.role;
  const { date } = req.body;
  const { clinicId: bodyClinicId } = req.body;

  // Admin/SuperAdmin must provide a clinicId; clinic uses their own id
  const isAdmin = [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN].includes(
    userRole,
  );
  const clinicId = isAdmin ? bodyClinicId : req.user.id;

  if (isAdmin && !bodyClinicId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'clinicId is required when admin toggles availability',
    );
  }

  if (!date) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'date is required',
    );
  }

  const dateObj = new Date(date);

  const availability = await prisma.clinicAvailability.findUnique({
    where: { clinicId_slotDate: { clinicId, slotDate: dateObj } },
  });

  if (!availability) {
    throw new ApiError(httpStatus.NOT_FOUND, 'No availability found for this date');
  }

  const updated = await prisma.clinicAvailability.update({
    where: { clinicId_slotDate: { clinicId, slotDate: dateObj } },
    data: { isActive: !availability.isActive },
    select: {
      id: true,
      slotDate: true,
      isActive: true,
      clinicId: true,
    },
  });

  await CacheInvalidator.onRelatedChange('timeSlot');

  return {
    id: updated.id,
    date: updated.slotDate.toISOString().split('T')[0],
    isActive: updated.isActive,
    clinicId: updated.clinicId,
  };
};

export const clinicAvailabilityService = {
  createAvailabilityWithSlots,
  getAvailabilityByMonth,
  getSlotsByDate,
  addSingleSlot,
  toggleSlotStatus,
  getMyAvailability,
  deleteAvailability,
  updateOffDays,
  toggleAvailabilityDateStatus,
};
