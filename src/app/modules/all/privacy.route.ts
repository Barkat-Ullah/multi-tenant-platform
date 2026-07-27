import express from 'express';
import catchAsync from '../../utils/catchAsync';
import auth from '../../middlewares/auth';
import prisma from '../../utils/prisma';
import authOptional from '../../middlewares/authOptional';
import { CacheInvalidator, cacheOr, CacheKeys, TTL } from '../../../lib/redis';

const router = express.Router();

router.post(
  '/',
  auth(),
  catchAsync(async (req, res) => {
    const { text } = req.body;
    const result = await prisma.privacy.create({
      data: {
        text,
      },
    });
    // Invalidate list caches so subsequent GET picks up the new record
    await CacheInvalidator.onRecordCreate('privacy');
    res.status(201).json(result);
  }),
);
router.get(
  '/',
  authOptional(),
  catchAsync(async (req, res) => {
    const cacheKey = await CacheKeys.single('privacy', 'first');
    const result = await cacheOr(cacheKey, TTL.DAY, () =>
      prisma.privacy.findFirst(),
    );
    res.status(200).json(result);
  }),
);
router.put(
  '/:id',
  auth(),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    const result = await prisma.privacy.update({
      where: { id },
      data: {
        text,
      },
    });
    await CacheInvalidator.onRecordUpdate('privacy', id);
    res.status(200).json(result);
  }),
);

export const privacyRouter = router;