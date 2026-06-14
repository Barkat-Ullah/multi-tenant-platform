import httpStatus from 'http-status';
import { paymentService } from './payment.service';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import pick from '../../utils/pickValidFields';

// create Payment
const createPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.createPayment(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Payment created successfully',
    data: result,
  });
});

// get all Payment
const paymentFilterableFields = [
  'searchTerm',
  'id',
  'createdAt',
  'status',
];
const getPaymentList = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, paymentFilterableFields);
  const result = await paymentService.getPaymentList(options, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

// get Payment by id
const getPaymentById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await paymentService.getPaymentById(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment details retrieved successfully',
    data: result,
  });
});

// get my Payment
const getMyPayment = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, paymentFilterableFields);
  const result = await paymentService.getMyPayment(req, options, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My Payment list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

// update Payment
const updatePayment = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.updatePayment(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment updated successfully',
    data: result,
  });
});

// toggle status Payment
const toggleStatusPayment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await paymentService.toggleStatusPayment(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment status toggled successfully',
    data: result,
  });
});

// soft delete Payment
const softDeletePayment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await paymentService.softDeletePayment(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment soft deleted successfully',
    data: result,
  });
});

// hard delete Payment
const deletePayment = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await paymentService.deletePayment(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment deleted successfully',
    data: result,
  });
});

export const paymentController = {
  createPayment,
  getPaymentList,
  getPaymentById,
  getMyPayment,
  updatePayment,
  toggleStatusPayment,
  softDeletePayment,
  deletePayment,
};