import express from 'express';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';
import { cacheController } from './cache.controller';

const router = express.Router();

// POST /cache/clear - admin only: invalidate all Redis model caches
router.post(
  '/clear',
  auth(UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN),
  cacheController.clearAllCache,
);

export const cacheRoutes = router;
