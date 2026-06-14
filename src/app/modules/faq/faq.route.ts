import express from 'express';
import catchAsync from '../../utils/catchAsync';
import auth from '../../middlewares/auth';
import prisma from '../../utils/prisma';

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
    res.send(201).json(result);
  }),
);
router.get(
  '/',
  catchAsync(async (req, res) => {
    const result = await prisma.faq.findMany();
    res.send(201).json(result);
  }),
);

export const faqRouter = router;
