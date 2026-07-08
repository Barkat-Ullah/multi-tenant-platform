import express from 'express';
import catchAsync from '../../utils/catchAsync';
import auth from '../../middlewares/auth';
import prisma from '../../utils/prisma';
import authOptional from '../../middlewares/authOptional';

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
    res.status(201).json(result);
  }),
);
router.get(
  '/',
  authOptional(),
  catchAsync(async (req, res) => {
    const result = await prisma.terms.findFirst();
    res.status(201).json(result);
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
    res.status(200).json(result);
  }),
);

export const termsRouter = router;
