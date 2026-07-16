import httpStatus from 'http-status';
import {
  Prisma,
  BookingStatus,
  PayType,
  SlotStatus,
  UserRoleEnum,
} from '@prisma/client';
import prisma from '../../utils/prisma';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../utils/calculatePagination';
import ApiError from '../../errors/AppError';
import { Request } from 'express';
import { bookingSelect } from './booking.select';
import { buildFilterConditions } from './booking.utils';
import { stripe } from '../../utils/stripe';
import config from '../../../config';
import { buildFilterConditions as buildOrganizerRequestFilterConditions } from '../organizerRequest/organizerRequest.utils';
import {
  createPaypalOrder,
  getPaypalAccessToken,
  PAYPAL_BASE,
} from './payment.constant';
import {
  getAdminAndSuperAdminEmails,
  sendPaymentSuccessMails,
} from './booking.helper';
import emailSender, {
  bookingCreatedAdminEmail,
  bookingCreatedClinicEmail,
  bookingCreatedDriverEmail,
} from '../../utils/sendMail';

type IBookingFilterRequest = {
  searchTerm?: string;
  id?: string;
  createdAt?: string;
  status?: string;
  clinicId?: string;
  driverId?: string;
  locationId?: string;
  period?: string; // daily, weekly, monthly (current day, week, month)
  rangeStartDay?: string; // ISO date string
  rangeEndDay?: string; // ISO date string
};

type CalendarPeriod = 'daily' | 'weekly' | 'monthly';

const getDateRangeByPeriod = (period: CalendarPeriod) => {
  const now = new Date();

  if (period === 'daily') {
    return {
      rangeStart: new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          0,
          0,
          0,
          0,
        ),
      ),
      rangeEnd: new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          23,
          59,
          59,
          999,
        ),
      ),
    };
  }

  if (period === 'weekly') {
    const utcDay = now.getUTCDay();
    const diffToMonday = utcDay === 0 ? 6 : utcDay - 1;

    const rangeStart = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - diffToMonday,
        0,
        0,
        0,
        0,
      ),
    );

    return {
      rangeStart,
      rangeEnd: new Date(
        Date.UTC(
          rangeStart.getUTCFullYear(),
          rangeStart.getUTCMonth(),
          rangeStart.getUTCDate() + 6,
          23,
          59,
          59,
          999,
        ),
      ),
    };
  }

  return {
    rangeStart: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    ),
    rangeEnd: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
    ),
  };
};

// NEW: parse custom range from query params, validate as full UTC days
const getCustomDateRange = (rangeStartDay: string, rangeEndDay: string) => {
  const start = new Date(rangeStartDay);
  const end = new Date(rangeEndDay);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Invalid rangeStartDay or rangeEndDay format. Use YYYY-MM-DD.',
    );
  }

  if (start > end) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'rangeStartDay cannot be after rangeEndDay',
    );
  }

  const rangeStart = new Date(
    Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  const rangeEnd = new Date(
    Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  return { rangeStart, rangeEnd };
};

const normalizeCalendarPeriod = (period?: string): CalendarPeriod => {
  const normalized = period?.toLowerCase();

  if (
    normalized === 'daily' ||
    normalized === 'weekly' ||
    normalized === 'monthly'
  ) {
    return normalized;
  }

  return 'weekly';
};

const organizerRequestSelect = {
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
  createdAt: true,
  updatedAt: true,
  service: {
    select: {
      id: true,
      title: true,
    },
  },
  clinic: {
    select: {
      id: true,
      fullName: true,
    },
  },
  organizer: {
    select: {
      id: true,
      fullName: true,
    },
  },
} satisfies Prisma.OrganizerRequestSelect;

const bookingSearchAbleFields = [
  'driver.fullName',
  'driver.email',
  'clinic.fullName',
];

// -------------------------------------------------------
// CREATE BOOKING
// -------------------------------------------------------
const createBooking = async (req: Request) => {
  const userRole = req.user.role;
  const { serviceId, clinicId, timeSlotId, scheduledAt, paymentType, price } =
    req.body;

  const adminId = req.user.id;

  // Allow ADMIN/SUPER_ADMIN to book on behalf of a client
  const isAdmin = [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN].includes(
    userRole,
  );

  if (userRole !== UserRoleEnum.USER && !isAdmin) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'Only drivers and admins can create bookings',
    );
  }

  // When admin books, they must provide a clientId; otherwise use the authenticated user
  const driverId = isAdmin ? adminId : req.user.id;

  const admins = await getAdminAndSuperAdminEmails();

  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: { email: true, fullName: true },
  });

  if (!driver) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Client not found');
  }

  const clinic = await prisma.user.findFirst({
    where: { id: clinicId, role: UserRoleEnum.CLINIC, isDeleted: false },
    select: {
      id: true,
      fullName: true,
      location: {
        select: {
          id: true,
        },
      },
    },
  });
  if (!clinic) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Clinic not found');
  }

  const timeSlot = await prisma.timeSlot.findUnique({
    where: { id: timeSlotId },
  });
  if (!timeSlot) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Time slot not found');
  }
  if (timeSlot.clinicId !== clinicId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Time slot does not belong to this clinic',
    );
  }
  if (timeSlot.status === SlotStatus.Inactive) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This time slot is inactive');
  }

  if (timeSlot.booked >= timeSlot.capacity) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'This time slot is fully booked',
    );
  }

  const existingBooking = await prisma.booking.findFirst({
    where: {
      driverId,
      timeSlotId,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
    },
  });
  if (existingBooking) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'You already have a booking for this slot',
    );
  }

  let payMethod = await prisma.payMethod.findFirst({
    where: { type: paymentType, isActive: true },
  });
  if (!payMethod) {
    payMethod = await prisma.payMethod.create({
      data: { type: paymentType, isActive: true },
    });
  }

  // -------------------------------------------------------
  // DB TRANSACTION
  // -------------------------------------------------------
  const { booking, payment } = await prisma.$transaction(
    async tx => {
      // ATOMIC RE-CHECK: Race condition handler
      const slotUpdate = await tx.timeSlot.updateMany({
        where: { id: timeSlotId, booked: { lt: timeSlot.capacity } },
        data: { booked: { increment: 1 }, isBooked: true },
      });

      if (slotUpdate.count === 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'This time slot is fully booked',
        );
      }

      const booking = await tx.booking.create({
        data: {
          driverId,
          clinicId,
          timeSlotId,
          serviceId,
          scheduledAt: new Date(scheduledAt),
          status: BookingStatus.PENDING,
          paymethodId: payMethod!.id,
          bookedBy: userRole,
        },
        select: bookingSelect,
      });

      const payment = await tx.payment.create({
        data: {
          userId: driverId,
          bookingId: booking.id,
          amount: price,
          currency: 'usd',
          status: 'PENDING',
          paymentMethodType: paymentType,
        },
      });

      if (clinic.location?.id) {
        await tx.location.update({
          where: { id: clinic.location.id },
          data: { totalBookings: { increment: 1 } },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: driverId,
          action: 'BOOKING_CREATED',
          targetModel: 'Booking',
          targetId: booking.id,
          metadata: { clinicId, timeSlotId, paymentType, price },
        },
      });

      await tx.notification.create({
        data: {
          receiverId: driverId,
          title: 'Booking Created',
          body: 'Your appointment has been booked. Complete payment to confirm.',
          type: 'BookingCreated',
          referenceId: booking.id,
        },
      });

      await tx.notification.create({
        data: {
          receiverId: clinicId,
          senderId: driverId,
          title: 'New Booking Received',
          body: `A driver has booked a slot on ${new Date(scheduledAt).toDateString()}.`,
          type: 'BookingCreated',
          referenceId: booking.id,
        },
      });

      return { booking, payment };
    },
    {
      timeout: 15000,
    },
  );

  // -------------------------------------------------------
  // Send booking created emails (Awaited sequentially/parallelly to secure Vercel execution)
  // -------------------------------------------------------
  const bookingDateStr = new Date(scheduledAt).toDateString();
  const mailPromises: Promise<any>[] = [];

  if (driver?.email) {
    mailPromises.push(
      emailSender(
        driver.email,
        bookingCreatedDriverEmail(
          driver.fullName,
          clinic.fullName,
          booking.id,
          bookingDateStr,
          `${timeSlot.startTime} - ${timeSlot.endTime}`,
        ),
        'Booking Created – Complete Payment to Confirm',
      ).catch(err => console.error('Driver booking mail failed:', err)),
    );
  }

  const clinicUser = await prisma.user.findUnique({
    where: { id: clinicId },
    select: { email: true, fullName: true },
  });

  if (clinicUser?.email) {
    mailPromises.push(
      emailSender(
        clinicUser.email,
        bookingCreatedClinicEmail(
          clinicUser.fullName,
          booking.id,
          bookingDateStr,
          `${timeSlot.startTime} - ${timeSlot.endTime}`,
        ),
        'New Booking Received',
      ).catch(err => console.error('Clinic booking mail failed:', err)),
    );
  }

  for (const admin of admins) {
    mailPromises.push(
      emailSender(
        admin.email,
        bookingCreatedAdminEmail(
          admin.fullName,
          driver?.fullName ?? 'N/A',
          clinic.fullName,
          booking.id,
          bookingDateStr,
        ),
        'New Booking Created',
      ).catch(err => console.error('Admin booking mail failed:', err)),
    );
  }

  if (mailPromises.length > 0) {
    await Promise.all(mailPromises);
  }

  // -------------------------------------------------------
  // GENERATE PAYMENT LINK
  // -------------------------------------------------------
  let paymentUrl: string;

  try {
    if (paymentType === PayType.Stripe) {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Medical appointment - ${clinic.fullName}`,
              },
              unit_amount: Math.round(price * 100),
            },
            quantity: 1,
          },
        ],
        metadata: {
          bookingId: booking.id,
          paymentId: payment.id,
        },
        success_url: `${config.base_url_client}/payment/success?bookingId=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.base_url_client}/payment/cancel?bookingId=${booking.id}`,
      });

      await prisma.payment.update({
        where: { id: payment.id },
        data: { stripeSessionId: session.id },
      });

      paymentUrl = session.url!;
    } else {
      const order = await createPaypalOrder(price, booking.id);

      await prisma.payment.update({
        where: { id: payment.id },
        data: { paypalOrderId: order.orderId },
      });

      paymentUrl = order.approveUrl!;
    }
  } catch (paymentError) {
    console.error('Payment Session Creation Failed:', paymentError);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Booking created successfully, but failed to generate payment gateway link. Please retry payment from your dashboard.',
    );
  }

  return {
    booking,
    payment: {
      id: payment.id,
      amount: payment.amount,
      status: payment.status,
      paymentType,
    },
    paymentUrl,
  };
};

// -------------------------------------------------------
// VERIFY STRIPE PAYMENT
// -------------------------------------------------------
const verifyStripePayment = async (req: Request) => {
  const { sessionId } = req.query as { sessionId: string };

  if (!sessionId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'sessionId is required');
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status !== 'paid') {
    return { status: 'pending', message: 'Payment not completed yet' };
  }

  const { bookingId, paymentId } = session.metadata as {
    bookingId: string;
    paymentId: string;
  };

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });

  if (payment?.status === 'SUCCESS') {
    return {
      status: 'success',
      message: 'Payment already confirmed',
      bookingId,
    };
  }

  const booking = await prisma.$transaction(
    async tx => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCESS',
          stripePaymentId: session.payment_intent as string,
        },
      });

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CONFIRMED },
        select: bookingSelect,
      });

      await tx.notification.create({
        data: {
          receiverId: (updated as any).driverId || payment?.userId,
          title: 'Payment Successful',
          body: 'Your payment was received and your booking is confirmed.',
          type: 'Payment',
          referenceId: bookingId,
        },
      });

      return updated;
    },
    { timeout: 15000 },
  );

  const stripeBooking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { driverId: true },
  });

  if (stripeBooking) {
    await sendPaymentSuccessMails(
      bookingId,
      stripeBooking.driverId,
      session.amount_total ? session.amount_total / 100 : 0,
      'Stripe',
    ).catch(err => console.error('Stripe payment mail error:', err));
  }

  return { status: 'success', booking };
};

// -------------------------------------------------------
// VERIFY PAYPAL PAYMENT
// -------------------------------------------------------
const verifyPaypalPayment = async (req: Request) => {
  const { orderId } = req.body;

  if (!orderId) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'orderId is required');
  }

  const accessToken = await getPaypalAccessToken();

  const res = await fetch(
    `${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const data = await res.json();

  if (data.status !== 'COMPLETED') {
    return { status: 'pending', message: 'Payment not completed yet' };
  }

  const payment = await prisma.payment.findUnique({
    where: { paypalOrderId: orderId },
  });

  if (!payment || !payment.bookingId) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      'Valid payment/booking record not found',
    );
  }

  if (payment.status === 'SUCCESS') {
    return {
      status: 'success',
      message: 'Payment already confirmed',
      bookingId: payment.bookingId,
    };
  }

  const booking = await prisma.$transaction(
    async tx => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESS' },
      });

      const updated = await tx.booking.update({
        where: { id: payment.bookingId as string }, // FIXED: removed risky non-null assertion (!)
        data: { status: BookingStatus.CONFIRMED },
        select: bookingSelect,
      });

      await tx.notification.create({
        data: {
          receiverId: payment.userId,
          title: 'Payment Successful',
          body: 'Your payment was received and your booking is confirmed.',
          type: 'Payment',
          referenceId: payment.bookingId,
        },
      });

      return updated;
    },
    { timeout: 15000 },
  );

  await sendPaymentSuccessMails(
    payment.bookingId,
    payment.userId,
    payment.amount,
    'PayPal',
  ).catch(err => console.error('PayPal payment mail error:', err));

  return { status: 'success', booking };
};

// -------------------------------------------------------
// get all Booking — ADMIN / SUPERADMIN with filters
// -------------------------------------------------------
const getBookingListForAdminAndSuperAdmin = async (
  options: IPaginationOptions,
  filters: IBookingFilterRequest,
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.BookingWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: [
        { driver: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
        { driver: { email: { equals: searchTerm, mode: 'insensitive' } } },
        { clinic: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
      ],
    });
  }

  if (Object.keys(filterData).length) {
    andConditions.push(...buildFilterConditions(filterData));
  }

  const whereConditions: Prisma.BookingWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const [result, total, confirmed, pending, cancelled] = await Promise.all([
    prisma.booking.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      select: bookingSelect,
    }),
    prisma.booking.count({ where: whereConditions }),
    prisma.booking.count({ where: { status: BookingStatus.CONFIRMED } }),
    prisma.booking.count({ where: { status: BookingStatus.PENDING } }),
    prisma.booking.count({ where: { status: BookingStatus.CANCELLED } }),
  ]);

  return {
    meta: { total, page, limit, confirmed, pending, cancelled },
    data: result,
  };
};

// -------------------------------------------------------

// -------------------------------------------------------
const getBookingListCallenderForAdminAndSuperAdminClinic = async (
  req: Request,
  options: IPaginationOptions,
  filters: IBookingFilterRequest,
) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, period, rangeStartDay, rangeEndDay, ...filterData } =
    filters;

  const { rangeStart, rangeEnd } =
    rangeStartDay && rangeEndDay
      ? getCustomDateRange(rangeStartDay, rangeEndDay)
      : getDateRangeByPeriod(normalizeCalendarPeriod(period));

  const calendarPeriod = normalizeCalendarPeriod(period);

  const organizerRequestFilterData = {
    id: filterData.id,
    createdAt: filterData.createdAt,
    status: filterData.status,
    clinicId: filterData.clinicId,
  };

  const bookingAndConditions: Prisma.BookingWhereInput[] = [
    {
      scheduledAt: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
  ];
  const organizerRequestAndConditions: Prisma.OrganizerRequestWhereInput[] = [
    {
      createdAt: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
  ];

  if (userRole === UserRoleEnum.CLINIC) {
    bookingAndConditions.push({ clinicId: userId });
    organizerRequestAndConditions.push({ clinicId: userId });
  }

  if (searchTerm) {
    bookingAndConditions.push({
      OR: [
        { driver: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
        { driver: { email: { equals: searchTerm, mode: 'insensitive' } } },
        { clinic: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
      ],
    });

    organizerRequestAndConditions.push({
      OR: [
        { companyName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
        { location: { contains: searchTerm, mode: 'insensitive' } },
      ],
    });
  }

  if (Object.keys(filterData).length) {
    bookingAndConditions.push(...buildFilterConditions(filterData));
    organizerRequestAndConditions.push(
      ...buildOrganizerRequestFilterConditions(organizerRequestFilterData),
    );
  }

  const bookingWhereConditions: Prisma.BookingWhereInput = {
    AND: bookingAndConditions,
  };
  const organizerRequestWhereConditions: Prisma.OrganizerRequestWhereInput = {
    AND: organizerRequestAndConditions,
  };

  const [bookings, bookingTotal, organizerRequests, organizerRequestTotal] =
    await Promise.all([
      prisma.booking.findMany({
        where: bookingWhereConditions,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          driverId: true,
          clinicId: true,
          serviceId: true,
          scheduledAt: true,
          status: true,
          createdAt: true,
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
          driver: { select: { id: true, fullName: true, email: true } },
          service: { select: { id: true, title: true } },
          clinic: { select: { id: true, fullName: true } },
        },
      }),

      prisma.booking.count({ where: bookingWhereConditions }),
      prisma.organizerRequest.findMany({
        where: organizerRequestWhereConditions,
        orderBy: { createdAt: 'desc' },
        select: organizerRequestSelect,
      }),
      prisma.organizerRequest.count({ where: organizerRequestWhereConditions }),
    ]);

  return {
    meta: {
      total: bookingTotal + organizerRequestTotal,
      bookingTotal,
      organizerRequestTotal,
      page,
      limit,
      period: period || calendarPeriod,
      rangeStartDay: rangeStartDay || rangeStart,
      rangeEndDay: rangeEndDay || rangeEnd,
    },
    data: {
      events: [
        ...bookings.map(booking => ({
          type: 'booking' as const,
          id: booking.id,
          title: booking.service?.title ?? booking.clinic.fullName,
          start: booking.scheduledAt,
          status: booking.status,
          clinicId: booking.clinicId,
          driverId: booking.driverId,
          // booking has a real timeSlot with start/end time
          timeSlot: booking.timeSlot
            ? {
                id: booking.timeSlot.id,
                date: booking.timeSlot.date,
                startTime: booking.timeSlot.startTime,
                endTime: booking.timeSlot.endTime,
                duration: booking.timeSlot.duration,
                status: booking.timeSlot.status,
              }
            : null,
          payload: booking,
        })),
        ...organizerRequests.map(request => ({
          type: 'organizerRequest' as const,
          id: request.id,
          title: request.companyName,
          start: request.createdAt,
          status: request.status,
          clinicId: request.clinicId,
          organizerId: request.userId,
          // organizerRequest has no timeSlot — always null
          timeSlot: null,
          payload: request,
        })),
      ],
    },
  };
};

// -------------------------------------------------------
// get Booking by id
// -------------------------------------------------------
const getBookingById = async (req: Request) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  const result = await prisma.booking.findUnique({
    where: { id },
    select: bookingSelect,
  });

  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  // restrict access — only owner driver, the clinic, or admin can view
  const isOwner = result.driverId === userId;
  const isClinic = result.clinicId === userId;
  const isAdmin = [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN].includes(
    userRole,
  );

  if (!isOwner && !isClinic && !isAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot access this booking');
  }

  return result;
};

// -------------------------------------------------------
// get my Booking — driver or clinic sees their own
// -------------------------------------------------------
const getMyBooking = async (
  req: Request,
  options: IPaginationOptions,
  filters: IBookingFilterRequest,
) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.BookingWhereInput[] = [];

  // scope by role
  if (userRole === UserRoleEnum.CLINIC) {
    andConditions.push({ clinicId: userId });
  } else {
    andConditions.push({ driverId: userId });
  }

  if (searchTerm) {
    andConditions.push({
      OR: [
        { driver: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
        { clinic: { fullName: { contains: searchTerm, mode: 'insensitive' } } },
      ],
    });
  }

  if (Object.keys(filterData).length) {
    andConditions.push(...buildFilterConditions(filterData));
  }

  const whereConditions: Prisma.BookingWhereInput = { AND: andConditions };

  const [result, total] = await Promise.all([
    prisma.booking.findMany({
      skip,
      take: limit,
      where: whereConditions,
      orderBy: { createdAt: 'desc' },
      select: bookingSelect,
    }),
    prisma.booking.count({ where: whereConditions }),
  ]);

  return { meta: { total, page, limit }, data: result };
};

// -------------------------------------------------------
// update Booking — generic field update (admin/clinic)
// -------------------------------------------------------
const updateBooking = async (req: Request) => {
  const { id } = req.params;
  const data = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  const FINISHED_STATUSES: BookingStatus[] = [
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
  ];

  const existingBooking = await prisma.booking.findUnique({ where: { id } });
  if (!existingBooking) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  // only clinic owning this booking or admin can update
  const isClinic = existingBooking.clinicId === userId;
  const isAdmin = [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN].includes(
    userRole,
  );

  if (!isClinic && !isAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot update this booking');
  }

  if (FINISHED_STATUSES.includes(existingBooking.status)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Cannot update a finished booking',
    );
  }

  const result = await prisma.booking.update({
    where: { id },
    data: {
      timeSlotId: data.timeSlotId ?? existingBooking.timeSlotId,
      scheduledAt: data.scheduledAt ?? existingBooking.scheduledAt,
      status: data.status ?? existingBooking.status,
    },
    select: bookingSelect,
  });

  // audit
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: 'BOOKING_UPDATED' as any,
      targetModel: 'Booking',
      targetId: id,
      metadata: { updatedFields: Object.keys(data) },
    },
  });

  return result;
};

// -------------------------------------------------------
// cancel Booking — driver or clinic
// -------------------------------------------------------
const cancelBooking = async (req: Request) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  const FINISHED_STATUSES: BookingStatus[] = [
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
  ];

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      timeSlot: true,
      clinic: { select: { location: { select: { id: true } } } },
    },
  });

  if (!booking) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  const isOwner = booking.driverId === userId;
  const isClinic = booking.clinicId === userId;
  const isAdmin = [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN].includes(
    userRole,
  );

  if (!isOwner && !isClinic && !isAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You cannot cancel this booking');
  }

  if (FINISHED_STATUSES.includes(booking.status)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Booking is already ${booking.status.toLowerCase()}`,
    );
  }

  const result = await prisma.$transaction(async tx => {
    // release timeslot
    // if (booking.timeSlotId) {
    //   const slot = await tx.timeSlot.update({
    //     where: { id: booking.timeSlotId },
    //     data: { booked: { decrement: 1 } },
    //   });

    //   // if slot was full and now has space, mark available again
    //   if (slot.booked < slot.capacity) {
    //     await tx.timeSlot.update({
    //       where: { id: booking.timeSlotId },
    //       data: { isBooked: false },
    //     });
    //   }
    // }

    if (booking.timeSlotId) {
      await tx.timeSlot.update({
        where: { id: booking.timeSlotId },
        data: {
          booked: { decrement: 1 },
          isBooked: false,
        },
      });
    }

    const updated = await tx.booking.update({
      where: { id },
      data: { status: BookingStatus.CANCELLED },
      select: bookingSelect,
    });

    if (booking.clinic.location?.id)
      await tx.location.update({
        where: { id },
        data: { totalBookings: { decrement: 1 } },
      });

    // audit
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'BOOKING_CANCELLED' as any,
        targetModel: 'Booking',
        targetId: id,
        metadata: { reason: reason ?? null, cancelledBy: userRole },
      },
    });

    // notify the other party
    const notifyUserId = isOwner ? booking.clinicId : booking.driverId;
    await tx.notification.create({
      data: {
        receiverId: notifyUserId,
        senderId: userId,
        title: 'Booking Cancelled',
        body: reason
          ? `A booking has been cancelled. Reason: ${reason}`
          : 'A booking has been cancelled.',
        type: 'BookingCancelled',
        referenceId: id,
      },
    });

    return updated;
  });

  return result;
};

// -------------------------------------------------------
// reschedule Booking — driver, clinic, admin
// -------------------------------------------------------
const rescheduleBooking = async (req: Request) => {
  const { id } = req.params;
  const { newTimeSlotId, newScheduledAt } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { timeSlot: true },
  });

  if (!booking) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  const isAdmin = [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN].includes(
    userRole,
  );
  const isOwner = booking.driverId === userId;
  const isClinic = booking.clinicId === userId;

  // Admin/SuperAdmin can reschedule any booking; otherwise only the owner driver or clinic
  if (!isAdmin && !isOwner && !isClinic) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'You can only reschedule your own booking',
    );
  }

  const FINISHED_STATUSES: BookingStatus[] = [
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
  ];

  if (FINISHED_STATUSES.includes(booking.status)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot reschedule a ${booking.status.toLowerCase()} booking`,
    );
  }

  // validate new timeslot
  const newSlot = await prisma.timeSlot.findUnique({
    where: { id: newTimeSlotId },
  });
  if (!newSlot) {
    throw new ApiError(httpStatus.NOT_FOUND, 'New time slot not found');
  }
  if (newSlot.clinicId !== booking.clinicId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'New time slot must belong to the same clinic',
    );
  }
  if (newSlot.status === SlotStatus.Inactive) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'New time slot is inactive');
  }
  if (newSlot.booked >= newSlot.capacity) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'New time slot is fully booked');
  }
  if (newTimeSlotId === booking.timeSlotId) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'New time slot is the same as current one',
    );
  }

  const result = await prisma.$transaction(async tx => {
    // release old slot
    // if (booking.timeSlotId) {
    //   const oldSlot = await tx.timeSlot.update({
    //     where: { id: booking.timeSlotId },
    //     data: { booked: { decrement: 1 } },
    //   });
    //   if (oldSlot.booked < oldSlot.capacity) {
    //     await tx.timeSlot.update({
    //       where: { id: booking.timeSlotId },
    //       data: { isBooked: false },
    //     });
    //   }
    // }
    if (booking.timeSlotId) {
      await tx.timeSlot.update({
        where: { id: newTimeSlotId },
        data: {
          booked: { increment: 1 },
          isBooked: true,
        },
      });
    }

    // occupy new slot
    const updatedNewSlot = await tx.timeSlot.update({
      where: { id: newTimeSlotId },
      data: { booked: { increment: 1 } },
    });
    if (updatedNewSlot.booked >= updatedNewSlot.capacity) {
      await tx.timeSlot.update({
        where: { id: newTimeSlotId },
        data: { isBooked: true },
      });
    }

    // update booking
    const updated = await tx.booking.update({
      where: { id },
      data: {
        timeSlotId: newTimeSlotId,
        scheduledAt: new Date(newScheduledAt),
        status: BookingStatus.PENDING, // back to pending — clinic must reconfirm
      },
      select: bookingSelect,
    });

    // audit
    await tx.auditLog.create({
      data: {
        actorId: userId,
        action: 'BOOKING_RESCHEDULED' as any,
        targetModel: 'Booking',
        targetId: id,
        metadata: {
          oldTimeSlotId: booking.timeSlotId,
          newTimeSlotId,
          newScheduledAt,
        },
      },
    });

    // notify driver
    await tx.notification.create({
      data: {
        receiverId: booking.driverId,
        title: 'Booking Rescheduled',
        body: `Your booking has been rescheduled to ${new Date(newScheduledAt).toDateString()}. Waiting for clinic confirmation.`,
        type: 'BookingCreated',
        referenceId: id,
      },
    });

    // notify clinic
    await tx.notification.create({
      data: {
        receiverId: booking.clinicId,
        senderId: userId,
        title: 'Booking Rescheduled',
        body: `A driver has rescheduled their booking to ${new Date(newScheduledAt).toDateString()}.`,
        type: 'BookingCreated',
        referenceId: id,
      },
    });

    return updated;
  });

  return result;
};

// -------------------------------------------------------
// confirm Booking — clinic only
// -------------------------------------------------------
const confirmBooking = async (req: Request) => {
  const { id } = req.params;
  const clinicId = req.user.id;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.clinicId !== clinicId) {
    throw new ApiError(
      httpStatus.FORBIDDEN,
      'This booking does not belong to your clinic',
    );
  }

  if (booking.status !== BookingStatus.PENDING) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot confirm a ${booking.status.toLowerCase()} booking`,
    );
  }

  const result = await prisma.$transaction(async tx => {
    const updated = await tx.booking.update({
      where: { id },
      data: { status: BookingStatus.CONFIRMED },
      select: bookingSelect,
    });

    await tx.auditLog.create({
      data: {
        actorId: clinicId,
        action: 'BOOKING_CONFIRMED' as any,
        targetModel: 'Booking',
        targetId: id,
      },
    });

    await tx.notification.create({
      data: {
        receiverId: booking.driverId,
        senderId: clinicId,
        title: 'Booking Confirmed',
        body: 'Your appointment has been confirmed by the clinic.',
        type: 'BookingConfirmed',
        referenceId: id,
      },
    });

    return updated;
  });

  return result;
};

// -------------------------------------------------------
// hard delete Booking — admin only
// -------------------------------------------------------
const deleteBooking = async (id: string) => {
  const existingBooking = await prisma.booking.findUnique({ where: { id } });
  if (!existingBooking) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Booking not found');
  }
  const result = await prisma.booking.delete({ where: { id } });
  return result;
};

export const bookingService = {
  //payment
  createBooking,
  verifyPaypalPayment,
  verifyStripePayment,
  //
  getBookingListForAdminAndSuperAdmin,
  getBookingListCallenderForAdminAndSuperAdminClinic,
  getBookingById,
  getMyBooking,
  updateBooking,
  cancelBooking,
  rescheduleBooking,
  confirmBooking,
  deleteBooking,
};
