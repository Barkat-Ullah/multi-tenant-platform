import prisma from '../../utils/prisma';
import { UserRoleEnum, BookingStatus, PaymentStatus } from '@prisma/client';

type Period = 'daily' | 'weekly' | 'monthly';

// -------------------------------------------------------
// helper — returns UTC start/end Date for daily/weekly/monthly
// -------------------------------------------------------
const getDateRangeByPeriod = (period: Period) => {
  const now = new Date();

  if (period === 'daily') {
    const start = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0,
    ));
    const end = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23, 59, 59, 999,
    ));
    return { rangeStart: start, rangeEnd: end };
  }

  if (period === 'weekly') {
    const utcDay = now.getUTCDay(); // 0 = Sun ... 6 = Sat
    const diffToMonday = utcDay === 0 ? 6 : utcDay - 1;

    const start = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - diffToMonday,
      0, 0, 0, 0,
    ));

    const end = new Date(Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate() + 6,
      23, 59, 59, 999,
    ));

    return { rangeStart: start, rangeEnd: end };
  }

  // monthly (default)
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

  return { rangeStart: start, rangeEnd: end };
};

// -------------------------------------------------------
// helper — UTC today start/end
// -------------------------------------------------------
const getUTCTodayRange = () => {
  const now = new Date();
  const todayStart = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0,
  ));
  const todayEnd = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999,
  ));
  return { todayStart, todayEnd };
};

// -------------------------------------------------------
// helper — UTC current month start/end
// -------------------------------------------------------
const getUTCMonthRange = () => {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { monthStart, monthEnd };
};

// -------------------------------------------------------
// helper — yearly trend for the chart (UTC months)
// -------------------------------------------------------
const getYearlyTrend = async () => {
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));

  const bookingsThisYear = await prisma.booking.findMany({
    where: { createdAt: { gte: yearStart } },
    select: { createdAt: true },
  });
  const paymentsThisYear = await prisma.payment.findMany({
    where: { status: PaymentStatus.SUCCESS, createdAt: { gte: yearStart } },
    select: { createdAt: true, amount: true },
  });

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return monthNames.map((month, idx) => {
    const bookingCount = bookingsThisYear.filter(
      b => b.createdAt.getUTCMonth() === idx,
    ).length;
    const revenue = paymentsThisYear
      .filter(p => p.createdAt.getUTCMonth() === idx)
      .reduce((sum, p) => sum + p.amount, 0);
    return { month, bookings: bookingCount, revenue };
  });
};

// -------------------------------------------------------
// ADMIN / SUPERADMIN
// -------------------------------------------------------
const getAdminAnalytics = async (period: Period = 'monthly') => {
  const { rangeStart, rangeEnd } = getDateRangeByPeriod(period);

  const [
    periodBookings,
    pendingBookings,
    periodRevenue,
    activeLocations,
    recentBookings,
    topServices,
  ] = await Promise.all([
    prisma.booking.count({
      where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
    }),
    prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
    prisma.payment.aggregate({
      where: {
        status: PaymentStatus.SUCCESS,
        createdAt: { gte: rangeStart, lte: rangeEnd },
      },
      _sum: { amount: true },
    }),
    prisma.location.count({ where: { isDeleted: false } }),
    prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        driver: { select: { fullName: true } },
        service: { select: { title: true } },
      },
    }),
    prisma.booking.groupBy({
      by: ['serviceId'],
      where: { serviceId: { not: null } },
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 5,
    }),
  ]);

  const serviceIds = topServices.map(s => s.serviceId).filter(Boolean) as string[];
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, title: true },
  });
  const serviceMap = Object.fromEntries(services.map(s => [s.id, s.title]));

  const trend = await getYearlyTrend();

  return {
    period,
    rangeStart,
    rangeEnd,
    overview: {
      bookings: periodBookings,
      pendingBookings,
      revenue: periodRevenue._sum.amount ?? 0,
      activeLocations,
    },
    trend,
    recentBookings: recentBookings.map(b => ({
      id: b.id,
      driverName: b.driver.fullName,
      service: b.service?.title ?? 'N/A',
      scheduledAt: b.scheduledAt,
      status: b.status,
    })),
    topServices: topServices.map(s => ({
      serviceId: s.serviceId,
      title: serviceMap[s.serviceId!] ?? 'Unknown',
      count: s._count.serviceId,
    })),
  };
};

// -------------------------------------------------------
// DRIVER
// -------------------------------------------------------
const getDriverAnalytics = async (driverId: string) => {
  const { todayStart, todayEnd } = getUTCTodayRange();

  const [
    totalAppointment,
    todayAppointment,
    completed,
    pending,
    myAppointments,
  ] = await Promise.all([
    prisma.booking.count({ where: { driverId } }),
    prisma.booking.count({
      where: { driverId, scheduledAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.booking.count({
      where: { driverId, status: BookingStatus.COMPLETED },
    }),
    prisma.booking.count({
      where: { driverId, status: BookingStatus.PENDING },
    }),
    prisma.booking.findMany({
      where: { driverId },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        service: { select: { title: true } },
        clinic: {
          select: {
            fullName: true,
            location: { select: { locationName: true } },
          },
        },
      },
    }),
  ]);

  return {
    overview: { totalAppointment, todayAppointment, completed, pending },
    appointments: myAppointments.map(a => ({
      id: a.id,
      serviceTitle: a.service?.title ?? 'Medical Checkup',
      scheduledAt: a.scheduledAt,
      location: a.clinic.location?.locationName ?? 'N/A',
      clinicName: a.clinic.fullName,
      status: a.status,
    })),
  };
};

// -------------------------------------------------------
// ORGANIZER (corporate)
// -------------------------------------------------------
const getOrganizerAnalytics = async (organizerId: string) => {
  const now = new Date();

  const expiryWindowEnd = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30, 23, 59, 59, 999,
  ));

  const [totalDrivers, upcomingBookings, expiringDriversCount] = await Promise.all([
    prisma.user.count({
      where: { organizerId, role: UserRoleEnum.USER, isDeleted: false },
    }),
    prisma.booking.count({
      where: {
        driver: { organizerId },
        scheduledAt: { gte: now },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      },
    }),
    prisma.user.count({
      where: {
        organizerId,
        role: UserRoleEnum.USER,
        medicalExpiry: { gte: now, lte: expiryWindowEnd },
      },
    }),
  ]);

  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
  const bookingsThisYear = await prisma.booking.findMany({
    where: { driver: { organizerId }, createdAt: { gte: yearStart } },
    select: { createdAt: true },
  });

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const bookingHistory = monthNames.map((month, idx) => ({
    month,
    bookings: bookingsThisYear.filter(b => b.createdAt.getUTCMonth() === idx).length,
  }));

  return {
    overview: {
      totalDrivers,
      upcomingBookings,
      expiringTimeMonths: 12,
      expiringDriversCount,
    },
    bookingHistory,
  };
};

// -------------------------------------------------------
// CLINIC
// -------------------------------------------------------
const getClinicAnalytics = async (clinicId: string) => {
  const { monthStart, monthEnd } = getUTCMonthRange();
  const { todayStart, todayEnd } = getUTCTodayRange();

  const [
    appointmentsThisMonth,
    todaysAppointmentCount,
    completed,
    pending,
    todaysAppointments,
  ] = await Promise.all([
    prisma.booking.count({
      where: { clinicId, createdAt: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.booking.count({
      where: { clinicId, scheduledAt: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.booking.count({
      where: { clinicId, status: BookingStatus.COMPLETED },
    }),
    prisma.booking.count({
      where: { clinicId, status: BookingStatus.PENDING },
    }),
    prisma.booking.findMany({
      where: { clinicId, scheduledAt: { gte: todayStart, lte: todayEnd } },
      orderBy: { scheduledAt: 'asc' },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        driver: { select: { fullName: true, email: true } },
        service: { select: { title: true } },
      },
    }),
  ]);

  const clinic = await prisma.user.findUnique({
    where: { id: clinicId },
    select: { location: { select: { locationName: true } } },
  });

  return {
    overview: {
      appointmentsThisMonth,
      todaysAppointment: todaysAppointmentCount,
      completed,
      pending,
    },
    todaysAppointments: todaysAppointments.map(a => ({
      id: a.id,
      clientName: a.driver.fullName,
      clientEmail: a.driver.email,
      serviceType: a.service?.title ?? 'General Checkup',
      appointmentTime: a.scheduledAt,
      location: clinic?.location?.locationName ?? 'N/A',
      status: a.status,
    })),
  };
};

export const analyticsService = {
  getAdminAnalytics,
  getDriverAnalytics,
  getOrganizerAnalytics,
  getClinicAnalytics,
};