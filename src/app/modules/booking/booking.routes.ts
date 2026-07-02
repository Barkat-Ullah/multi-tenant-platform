import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { bookingController } from './booking.controller';
import { bookingValidation } from './booking.validation';
import { UserRoleEnum } from '@prisma/client';

const router = express.Router();

// driver creates a booking
router.post(
  '/',
  auth(UserRoleEnum.USER),
  validateRequest(bookingValidation.createSchema),
  bookingController.createBooking,
);

// verify after payment redirect — called by frontend
router.get(
  '/payment/verify-stripe',
  auth(UserRoleEnum.USER),
  bookingController.verifyStripePayment,
);
router.post(
  '/payment/verify-paypal',
  auth(UserRoleEnum.USER),
  bookingController.verifyPaypalPayment,
);

// admin/superadmin — list all bookings with filters
router.get(
  '/',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  bookingController.getBookingList,
);

// admin/superadmin/clinic — calendar view with bookings + organizer requests
router.get(
  '/calendar',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN, UserRoleEnum.CLINIC),
  bookingController.getBookingCalendarList,
);

// driver/clinic — see own bookings
router.get('/my', auth('ANY'), bookingController.getMyBooking);

// view single booking — owner/clinic/admin
router.get('/:id', auth('ANY'), bookingController.getBookingById);

// admin/clinic — generic update
router.put(
  '/:id',
  auth('ANY'),
  validateRequest(bookingValidation.updateSchema),
  bookingController.updateBooking,
);

// clinic confirms a pending booking
router.patch(
  '/confirm/:id',
  auth(UserRoleEnum.CLINIC),
  bookingController.confirmBooking,
);

// driver reschedules their booking
router.patch(
  '/reschedule/:id',
  auth(
    UserRoleEnum.USER,
    UserRoleEnum.CLINIC,
    UserRoleEnum.ADMIN,
    UserRoleEnum.SUPERADMIN,
  ),
  validateRequest(bookingValidation.rescheduleSchema),
  bookingController.rescheduleBooking,
);

// driver/clinic/admin cancels a booking
router.patch(
  '/cancel/:id',
  auth('ANY'),
  validateRequest(bookingValidation.cancelSchema),
  bookingController.cancelBooking,
);

// admin — hard delete
router.delete(
  '/:id',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  bookingController.deleteBooking,
);

export const bookingRoutes = router;
