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
    const { title, description } = req.body;
    const result = await prisma.faq.create({
      data: {
        title,
        description,
      },
    });
    res.status(201).json(result);
  }),
);
router.get(
  '/',
  authOptional(),
  catchAsync(async (req, res) => {
    const result = await prisma.faq.findMany();
    res.status(201).json(result);
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
    res.status(200).json(result);
  }),
);

export const faqRouter = router;
