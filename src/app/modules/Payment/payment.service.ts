import httpStatus from 'http-status';
import { Prisma } from '@prisma/client';
import prisma from '../../utils/prisma';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../utils/calculatePagination';
import ApiError from '../../errors/AppError';
import { Request } from 'express';

// -------------------------------------------------------
// SELECT — auto-generated from Prisma model fields
// -------------------------------------------------------
const paymentSelect = {
  id: true,
  userId: true,
  amount: true,
  currency: true,
  status: true,
  paymentMethodType: true,
  cardBrand: true,
  cardLast4: true,
  cardExpMonth: true,
  cardExpYear: true,
  stripeSessionId: true,
  stripePaymentId: true,
  stripeCustomerId: true,
  createdAt: true,
  updatedAt: true,
};

// -------------------------------------------------------
// create Payment
// -------------------------------------------------------
const createPayment = async (req: Request) => {
  console.log('')
};

// -------------------------------------------------------
// get all Payment
// -------------------------------------------------------
type IPaymentFilterRequest = {
  searchTerm?: string;
  id?: string;
  createdAt?: string;
  status?: string;
};

const paymentSearchAbleFields = ['fullName', 'email'];

const getPaymentList = async (
  options: IPaginationOptions,
  filters: IPaymentFilterRequest,
) => {
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.PaymentWhereInput[] = [];

  if (searchTerm) {
    andConditions.push({
      OR: paymentSearchAbleFields.map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' },
      })),
    });
  }

  if (Object.keys(filterData).length) {
    Object.keys(filterData).forEach(key => {
      const value = (filterData as any)[key];
      if (value === '' || value === null || value === undefined) return;

      if (key === 'createdAt' && value) {
        const parts = (value as string).split('-');
        if (parts.length === 2) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const start = new Date(year, month, 1, 0, 0, 0, 0);
          const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
          andConditions.push({
            createdAt: { gte: start.toISOString(), lte: end.toISOString() },
          });
        } else {
          const start = new Date(value);
          start.setHours(0, 0, 0, 0);
          const end = new Date(value);
          end.setHours(23, 59, 59, 999);
          andConditions.push({
            createdAt: { gte: start.toISOString(), lte: end.toISOString() },
          });
        }
        return;
      }

      if (key.includes('.')) {
        const [relation, field] = key.split('.');
        andConditions.push({ [relation]: { some: { [field]: value } } });
        return;
      }

      andConditions.push({ [key]: value });
    });
  }

  const whereConditions: Prisma.PaymentWhereInput =
    andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.payment.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: { createdAt: 'desc' },
    select: paymentSelect,
  });

  const total = await prisma.payment.count({ where: whereConditions });

  return { meta: { total, page, limit }, data: result };
};

// -------------------------------------------------------
// get Payment by id
// -------------------------------------------------------
const getPaymentById = async (id: string) => {
  const result = await prisma.payment.findUnique({
    where: { id },
    select: paymentSelect,
  });
  if (!result) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
  }
  return result;
};

// -------------------------------------------------------
// get my Payment
// -------------------------------------------------------
const getMyPayment = async (
  req: Request,
  options: IPaginationOptions,
  filters: IPaymentFilterRequest,
) => {
  const userId = req.user.id;
  const { page, limit, skip } = paginationHelper.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions: Prisma.PaymentWhereInput[] = [{ userId }];

  if (searchTerm) {
    andConditions.push({
      OR: paymentSearchAbleFields.map(field => ({
        [field]: { contains: searchTerm, mode: 'insensitive' },
      })),
    });
  }

  if (Object.keys(filterData).length) {
    Object.keys(filterData).forEach(key => {
      const value = (filterData as any)[key];
      if (value === '' || value === null || value === undefined) return;

      if (key === 'createdAt' && value) {
        const parts = (value as string).split('-');
        if (parts.length === 2) {
          const year = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1;
          const start = new Date(year, month, 1, 0, 0, 0, 0);
          const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
          andConditions.push({
            createdAt: { gte: start.toISOString(), lte: end.toISOString() },
          });
        } else {
          const start = new Date(value);
          start.setHours(0, 0, 0, 0);
          const end = new Date(value);
          end.setHours(23, 59, 59, 999);
          andConditions.push({
            createdAt: { gte: start.toISOString(), lte: end.toISOString() },
          });
        }
        return;
      }

      if (key.includes('.')) {
        const [relation, field] = key.split('.');
        andConditions.push({ [relation]: { some: { [field]: value } } });
        return;
      }

      andConditions.push({ [key]: value });
    });
  }

  const whereConditions: Prisma.PaymentWhereInput = { AND: andConditions };

  const result = await prisma.payment.findMany({
    skip,
    take: limit,
    where: whereConditions,
    orderBy: { createdAt: 'desc' },
    select: paymentSelect,
  });

  const total = await prisma.payment.count({ where: whereConditions });

  return { meta: { total, page, limit }, data: result };
};

// -------------------------------------------------------
// update Payment
// -------------------------------------------------------
const updatePayment = async (req: Request) => {
  const { id } = req.params;
  const data = req.body;

  const existingPayment = await prisma.payment.findUnique({ where: { id } });
  if (!existingPayment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
  }

  const result = await prisma.payment.update({
    where: { id },
    data: {
      amount: data.amount ?? (existingPayment as any).amount,
      currency: data.currency ?? (existingPayment as any).currency,
      status: data.status ?? (existingPayment as any).status,
      paymentMethodType:
        data.paymentMethodType ?? (existingPayment as any).paymentMethodType,
      cardBrand: data.cardBrand ?? (existingPayment as any).cardBrand,
      cardLast4: data.cardLast4 ?? (existingPayment as any).cardLast4,
      cardExpMonth: data.cardExpMonth ?? (existingPayment as any).cardExpMonth,
      cardExpYear: data.cardExpYear ?? (existingPayment as any).cardExpYear,
      stripeSessionId:
        data.stripeSessionId ?? (existingPayment as any).stripeSessionId,
      stripePaymentId:
        data.stripePaymentId ?? (existingPayment as any).stripePaymentId,
      stripeCustomerId:
        data.stripeCustomerId ?? (existingPayment as any).stripeCustomerId,
    },
    select: paymentSelect,
  });

  return result;
};

// -------------------------------------------------------
// toggle status Payment
// -------------------------------------------------------
const toggleStatusPayment = async (id: string) => {
  const existingPayment = await prisma.payment.findUnique({ where: { id } });
  if (!existingPayment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
  }

  // TODO: define your status enum toggle logic below
  // Example for enum: { ACTIVE -> INACTIVE, INACTIVE -> ACTIVE }
  const currentStatus = (existingPayment as any).status;
  // const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
  const result = await prisma.payment.update({
    where: { id },
    data: { status: currentStatus /* replace with newStatus */ },
    select: paymentSelect,
  });

  return result;
};

// -------------------------------------------------------
// soft delete Payment
// -------------------------------------------------------
const softDeletePayment = async (id: string) => {
  const existingPayment = await prisma.payment.findUnique({ where: { id } });
  if (!existingPayment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
  }
  if ((existingPayment as any).isDeleted) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Payment is already deleted');
  }
  const result = await prisma.payment.update({
    where: { id },
    // data: { isDeleted: true },
    data: {},
    select: paymentSelect,
  });
  return result;
};

// -------------------------------------------------------
// hard delete Payment
// -------------------------------------------------------
const deletePayment = async (id: string) => {
  const existingPayment = await prisma.payment.findUnique({ where: { id } });
  if (!existingPayment) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
  }
  const result = await prisma.payment.delete({ where: { id } });
  return result;
};

export const paymentService = {
  createPayment,
  getPaymentList,
  getPaymentById,
  getMyPayment,
  updatePayment,
  toggleStatusPayment,
  softDeletePayment,
  deletePayment,
};
