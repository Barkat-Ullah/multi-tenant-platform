import httpStatus from 'http-status';
import { bookingService } from './booking.service';
import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import pick from '../../utils/pickValidFields';

const createBooking = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.createBooking(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Booking created successfully',
    data: result,
  });
});

const verifyStripePayment = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.verifyStripePayment(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment verification checked',
    data: result,
  });
});

const verifyPaypalPayment = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.verifyPaypalPayment(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Payment verification checked',
    data: result,
  });
});

const bookingFilterableFields = [
  'searchTerm',
  'id',
  'createdAt',
  'status',
  'clinicId',
  'driverId',
  'locationId',
];

const getBookingList = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, bookingFilterableFields);
  const result = await bookingService.getBookingListForAdminAndSuperAdmin(
    options,
    filters,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const getBookingById = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.getBookingById(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking details retrieved successfully',
    data: result,
  });
});

const getMyBooking = catchAsync(async (req: Request, res: Response) => {
  const options = pick(req.query, ['limit', 'page', 'sortBy', 'sortOrder']);
  const filters = pick(req.query, bookingFilterableFields);
  const result = await bookingService.getMyBooking(req, options, filters);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'My booking list retrieved successfully',
    data: result.data,
    meta: result.meta,
  });
});

const updateBooking = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.updateBooking(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking updated successfully',
    data: result,
  });
});

const cancelBooking = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.cancelBooking(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking cancelled successfully',
    data: result,
  });
});

const rescheduleBooking = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.rescheduleBooking(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking rescheduled successfully',
    data: result,
  });
});

const confirmBooking = catchAsync(async (req: Request, res: Response) => {
  const result = await bookingService.confirmBooking(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking confirmed successfully',
    data: result,
  });
});

const deleteBooking = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await bookingService.deleteBooking(id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking deleted successfully',
    data: result,
  });
});

export const bookingController = {
  //
  createBooking,
  verifyPaypalPayment,
  verifyStripePayment,
  getBookingList,
  getBookingById,
  getMyBooking,
  updateBooking,
  cancelBooking,
  rescheduleBooking,
  confirmBooking,
  deleteBooking,
};
