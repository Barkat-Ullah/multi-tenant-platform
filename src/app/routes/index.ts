import express from 'express';
import { notificationsRoute } from '../modules/Notifications/Notification.routes';
import { paymentRoutes } from '../modules/Payment/payment.routes';
import { AuthRouters } from '../modules/Auth/Auth.routes';
import { UserRouters } from '../modules/User/user.routes';
import { serviceRoutes } from "../modules/service/service.routes";
import { locationRoutes } from "../modules/location/location.routes";
import { clinicAvailabilityRoutes } from '../modules/timeSlot/timeSlot.routes';
import { bookingRoutes } from "../modules/booking/booking.routes";
import { methodRoutes } from '../modules/paymethod/paymethod.route';
import { medicalRecordRoutes } from "../modules/medicalRecord/medicalRecord.routes";
import { organizerRequestRoutes } from "../modules/organizerRequest/organizerRequest.routes";

const router = express.Router();

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRouters,
  },
  {
    path: '/user',
    route: UserRouters,
  },
  {
    path: '/notifications',
    route: notificationsRoute,
  },
  {
    path: '/payments',
    route: paymentRoutes,
  },
  {
    path: "/services",
    route: serviceRoutes,
  },

  {
    path: "/locations",
    route: locationRoutes,
  },

  {
    path: "/timeslots",
    route: clinicAvailabilityRoutes,
  },
  {
    path: "/bookings",
    route: bookingRoutes,
  },
  {
    path: "/method",
    route: methodRoutes,
  },

  {
    path: "/medical-records",
    route: medicalRecordRoutes,
  },

  {
    path: "/organizer-requests",
    route: organizerRequestRoutes,
  },
];

moduleRoutes.forEach(route => router.use(route.path, route.route));

export default router;
