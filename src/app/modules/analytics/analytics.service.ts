import prisma from '../../utils/prisma';
import { UserRoleEnum, BookingStatus, PaymentStatus } from '@prisma/client';
import { getDateRangeByPeriod, CalendarPeriod } from '../../utils/dateRange';
import { cacheOr, CacheKeys, TTL } from '../../../lib/redis';

// -------------------------------------------------------
// helper — UTC today start/end
// -------------------------------------------------------
const getUTCTodayRange = () => {
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const todayEnd = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return { todayStart, todayEnd };
};

// -------------------------------------------------------
// helper — UTC current month start/end
// -------------------------------------------------------
const getUTCMonthRange = () => {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const monthEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  return { monthStart, monthEnd };
};

// -------------------------------------------------------
// helper — yearly trend for the chart (UTC months)
// -------------------------------------------------------
const getYearlyTrend = async () => {
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));

  // Only fetch IDs/dates — not full records — to minimize memory usage
  const [bookingMonths, paymentData] = await Promise.all([
    prisma.booking.findMany({
      where: { createdAt: { gte: yearStart } },
      select: { createdAt: true },
    }),
    prisma.payment.findMany({
      where: { status: PaymentStatus.SUCCESS, createdAt: { gte: yearStart } },
      select: { createdAt: true, amount: true },
    }),
  ]);

  // Pre-compute monthly counts in a single pass (O(n) instead of O(n*12))
  const monthBookings = new Array(12).fill(0);
  const monthRevenue = new Array(12).fill(0);

  for (const b of bookingMonths) {
    monthBookings[b.createdAt.getUTCMonth()]++;
  }
  for (const p of paymentData) {
    monthRevenue[p.createdAt.getUTCMonth()] += p.amount;
  }

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  return monthNames.map((month, idx) => ({
    month,
    bookings: monthBookings[idx],
    revenue: Math.round(monthRevenue[idx] * 100) / 100,
  }));
};

// -------------------------------------------------------
// ADMIN / SUPERADMIN
// -------------------------------------------------------
const getAdminAnalytics = async (period: CalendarPeriod = 'monthly') => {
  const { rangeStart, rangeEnd } = getDateRangeByPeriod(period);

  const cacheKey = await CacheKeys.list('analytics', { period, scope: 'admin' });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const [
      periodBookings,
      pendingBookings,
      periodRevenue,
      activeLocations,
      recentBookings,
      recentMedicalRecords,
      totalServices,
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
      prisma.medicalRecord.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          result: true,
          files: true,
          createdAt: true,
          driver: { select: { id: true, fullName: true } },
          clinic: { select: { id: true, fullName: true } },
          booking: {
            select: {
              id: true,
              scheduledAt: true,
              status: true,
              service: { select: { id: true, title: true } },
            },
          },
          organizerRequest: {
            select: {
              id: true,
              companyName: true,
              service: { select: { id: true, title: true } },
            },
          },
        },
      }),
      prisma.service.count({ where: { isDeleted: false } }),
      prisma.booking.groupBy({
        by: ['serviceId'],
        where: { serviceId: { not: null } },
        _count: { serviceId: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 3,
      }),
    ]);

    const serviceIds = topServices
      .map(s => s.serviceId)
      .filter(Boolean) as string[];
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
        totalServices,
      },
      trend,
      recentBookings: recentBookings.map(b => ({
        id: b.id,
        driverName: b.driver.fullName,
        service: b.service?.title ?? 'N/A',
        scheduledAt: b.scheduledAt,
        status: b.status,
      })),
      recentMedicalRecords: recentMedicalRecords.map(record => ({
        id: record.id,
        result: record.result,
        files: record.files,
        createdAt: record.createdAt,
        driverName: record.driver.fullName,
        clinicName: record.clinic.fullName,
        bookingId: record.booking?.id ?? null,
        service:
          record.booking?.service?.title ??
          record.organizerRequest?.service?.title ??
          'N/A',
        organizerRequestId: record.organizerRequest?.id ?? null,
        companyName: record.organizerRequest?.companyName ?? null,
      })),
      topServices: topServices.map(s => ({
        serviceId: s.serviceId,
        title: serviceMap[s.serviceId!] ?? 'Unknown',
        count: s._count.serviceId,
      })),
    };
  });

  return cached ?? {
    period,
    rangeStart,
    rangeEnd,
    overview: { bookings: 0, pendingBookings: 0, revenue: 0, activeLocations: 0, totalServices: 0 },
    trend: [],
    recentBookings: [],
    recentMedicalRecords: [],
    topServices: [],
  };
};

// -------------------------------------------------------
// DRIVER
// -------------------------------------------------------
const getDriverAnalytics = async (driverId: string) => {
  const { todayStart, todayEnd } = getUTCTodayRange();

  const cacheKey = await CacheKeys.myList('analytics', driverId, { scope: 'driver' });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
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
  });

  return cached ?? {
    overview: { totalAppointment: 0, todayAppointment: 0, completed: 0, pending: 0 },
    appointments: [],
  };
};

// -------------------------------------------------------
// ORGANIZER (corporate)
// -------------------------------------------------------
const getOrganizerAnalytics = async (organizerId: string) => {
  const now = new Date();

  const expiryWindowEnd = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 30,
      23,
      59,
      59,
      999,
    ),
  );

  const cacheKey = await CacheKeys.myList('analytics', organizerId, { scope: 'organizer' });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const [
      totalDrivers,
      upcomingBookings,
      expiringDriversCount,
      totalOrganizerRequests,
      recentOrganizerRequests,
    ] =
      await Promise.all([
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
        prisma.organizerRequest.count({
          where: { userId: organizerId, isDeleted: false },
        }),
        prisma.organizerRequest.findMany({
          where: { userId: organizerId, isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            companyName: true,
            email: true,
            phone: true,
            location: true,
            totalDriver: true,
            status: true,
            createdAt: true,
            clinic: { select: { id: true, fullName: true } },
            service: { select: { id: true, title: true } },
          },
        }),
      ]);

    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    const bookingsThisYear = await prisma.booking.findMany({
      where: { driver: { organizerId }, createdAt: { gte: yearStart } },
      select: { createdAt: true },
    });

    const monthBookings = new Array(12).fill(0);
    for (const b of bookingsThisYear) {
      monthBookings[b.createdAt.getUTCMonth()]++;
    }

    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const bookingHistory = monthNames.map((month, idx) => ({
      month,
      bookings: monthBookings[idx],
    }));

    return {
      overview: {
        totalDrivers,
        upcomingBookings,
        expiringTimeMonths: 12,
        expiringDriversCount,
        totalOrganizerRequests,
      },
      bookingHistory,
      recentOrganizerRequests: recentOrganizerRequests.map(request => ({
        id: request.id,
        companyName: request.companyName,
        service: request.service.title,
        clinicName: request.clinic?.fullName ?? 'N/A',
        status: request.status,
        createdAt: request.createdAt,
        totalDriver: request.totalDriver,
        location: request.location,
      })),
    };
  });

  return cached ?? {
    overview: { totalDrivers: 0, upcomingBookings: 0, expiringTimeMonths: 12, expiringDriversCount: 0, totalOrganizerRequests: 0 },
    bookingHistory: [],
    recentOrganizerRequests: [],
  };
};

// -------------------------------------------------------
// CLINIC
// -------------------------------------------------------
const getClinicAnalytics = async (clinicId: string) => {
  const { monthStart, monthEnd } = getUTCMonthRange();
  const { todayStart, todayEnd } = getUTCTodayRange();

  const cacheKey = await CacheKeys.myList('analytics', clinicId, { scope: 'clinic' });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
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
  });

  return cached ?? {
    overview: { appointmentsThisMonth: 0, todaysAppointment: 0, completed: 0, pending: 0 },
    todaysAppointments: [],
  };
};

export const analyticsService = {
  getAdminAnalytics,
  getDriverAnalytics,
  getOrganizerAnalytics,
  getClinicAnalytics,
};
