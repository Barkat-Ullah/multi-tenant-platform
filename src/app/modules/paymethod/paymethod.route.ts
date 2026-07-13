import auth from '../../middlewares/auth';
import express from 'express';
import catchAsync from '../../utils/catchAsync';
import prisma from '../../utils/prisma';
import ApiError from '../../errors/AppError';
import { PayType, UserRoleEnum } from '@prisma/client';
import authOptional from '../../middlewares/authOptional';

const router = express.Router();

export async function seedMethod() {
  const methods = [
    {
      type: PayType.Stripe,
    },
    {
      type: PayType.Paypal,
    },
  ];
  for (const method of methods) {
    const existing = await prisma.payMethod.findFirst({
      where: {
        type: method.type,
      },
    });
    if (existing) {
      // console.log('Already exists method');
      continue;
    }

    await prisma.payMethod.create({ data: method });
    console.log('Method created');
  }
}

router.get(
  '/',
  authOptional(),
  catchAsync(async (req, res) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const whereCondition =
      userRole === UserRoleEnum.USER ? { isActive: true } : {};

    const result = await prisma.payMethod.findMany({
      where: whereCondition,
      select: {
        id: true,
        type: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.status(200).json({
      success: true,
      message: 'Payment method type retrieved successfully',
      data: result,
    });
  }),
);

router.get(
  '/:id',
  authOptional(),
  catchAsync(async (req, res) => {
    const result = await prisma.payMethod.findUnique({
      where: {
        id: req.params.id,
        isActive: true,
      },
      select: {
        id: true,
        type: true,
        isActive: true,
        createdAt: true,
      },
    });
    res.status(200).json({
      success: true,
      message: 'Payment method type retrieved successfully',
      data: result,
    });
  }),
);

router.put(
  '/:id',
  auth(),
  catchAsync(async (req, res) => {
    const { id } = req.params;
    const existing = await prisma.payMethod.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ApiError(404, 'Payment method not found');
    }

    const currentStatus = existing.isActive ?? false;

    const updatedPayMethod = await prisma.payMethod.update({
      where: { id },
      data: {
        isActive: !currentStatus,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Payment method status updated successfully',
      data: updatedPayMethod,
    });
  }),
);

export const methodRoutes = router;
