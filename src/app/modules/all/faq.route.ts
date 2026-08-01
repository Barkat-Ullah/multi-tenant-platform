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
    const { title, description } = req.body;
    const result = await prisma.faq.create({
      data: {
        title,
        description,
      },
    });
    // Invalidate list caches so subsequent GET picks up the new record
    await CacheInvalidator.onRecordCreate('faq');
    res.status(201).json(result);
  }),
);
router.get(
  '/',
  authOptional(),
  cacheControl(cacheProfiles.static),
  catchAsync(async (req, res) => {
    const cacheKey = await CacheKeys.list('faq', { scope: 'all' });
    const result = await cacheOr(cacheKey, TTL.DAY, () =>
      prisma.faq.findMany(),
    );
    res.status(200).json(result);
  }),
);
router.put(
  '/:id',
  auth(),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;
    const result = await prisma.faq.update({
      where: { id },
      data: {
        title,
        description,
      },
    });
    await CacheInvalidator.onRecordUpdate('faq', id);
    res.status(200).json(result);
  }),
);

export const faqRouter = router;