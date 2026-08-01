import express from 'express';
import catchAsync from '../../utils/catchAsync';
import auth from '../../middlewares/auth';
import prisma from '../../utils/prisma';
import authOptional from '../../middlewares/authOptional';
import { CacheInvalidator, cacheOr, CacheKeys, TTL } from '../../../lib/redis';
import { cacheControl, cacheProfiles } from '../../middlewares/cacheControl';

const router = express.Router();

router.post(
  '/',
  auth(),
  catchAsync(async (req, res) => {
    const { text } = req.body;
    const result = await prisma.terms.create({
      data: {
        text,
      },
    });
    // Invalidate list caches so subsequent GET picks up the new record
    await CacheInvalidator.onRecordCreate('terms');
    res.status(201).json(result);
  }),
);
router.get(
  '/',
  authOptional(),
  cacheControl(cacheProfiles.static),
  catchAsync(async (req, res) => {
    const cacheKey = await CacheKeys.single('terms', 'first');
    const result = await cacheOr(cacheKey, TTL.DAY, () =>
      prisma.terms.findFirst(),
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
    const result = await prisma.terms.update({
      where: { id },
      data: {
        text,
      },
    });
    await CacheInvalidator.onRecordUpdate('terms', id);
    res.status(200).json(result);
  }),
);

export const termsRouter = router;