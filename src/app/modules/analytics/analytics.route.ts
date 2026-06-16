import { UserRoleEnum } from '@prisma/client';
import express from 'express';
import auth from '../../middlewares/auth';
import { analyticsController } from './analytics.controller';

const router = express.Router();

router.get(
  '/admin',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  analyticsController.getAdminAnalytics,
);

router.get(
  '/corporate',
  auth(UserRoleEnum.ORGINIZER),
  analyticsController.getOrganizerAnalytics,
);

router.get(
  '/driver',
  auth(UserRoleEnum.USER),
  analyticsController.getDriverAnalytics,
);

router.get(
  '/clinic',
  auth(UserRoleEnum.CLINIC),
  analyticsController.getClinicAnalytics,
);

export const analyticsRouter = router;
