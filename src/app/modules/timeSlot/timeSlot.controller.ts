import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';
import { clinicAvailabilityService } from './timeSlot.service';

const createAvailabilityWithSlots = catchAsync(
  async (req: Request, res: Response) => {
    const result =
      await clinicAvailabilityService.createAvailabilityWithSlots(req);
    sendResponse(res, {
      statusCode: httpStatus.CREATED,
      success: true,
      message: 'Availability and slots created successfully',
      data: result,
    });
  },
);

const getAvailabilityByMonth = catchAsync(
  async (req: Request, res: Response) => {
    const result = await clinicAvailabilityService.getAvailabilityByMonth(req);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Monthly availability retrieved successfully',
      data: result,
    });
  },
);

const getSlotsByDate = catchAsync(async (req: Request, res: Response) => {
  const result = await clinicAvailabilityService.getSlotsByDate(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Slots retrieved successfully',
    data: result,
  });
});

const addSingleSlot = catchAsync(async (req: Request, res: Response) => {
  const result = await clinicAvailabilityService.addSingleSlot(req);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Slot added successfully',
    data: result,
  });
});

const toggleSlotStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await clinicAvailabilityService.toggleSlotStatus(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Slot status toggled successfully',
    data: result,
  });
});

const getMyAvailability = catchAsync(async (req: Request, res: Response) => {
  const result = await clinicAvailabilityService.getMyAvailability(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Availability list retrieved successfully',
    data: result,
  });
});

const deleteAvailability = catchAsync(async (req: Request, res: Response) => {
  await clinicAvailabilityService.deleteAvailability(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Availability deleted successfully',
    data: null,
  });
});

const updateOffDays = catchAsync(async (req: Request, res: Response) => {
  const result = await clinicAvailabilityService.updateOffDays(req);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Up date off days',
    data: result,
  });
});

export const clinicAvailabilityController = {
  createAvailabilityWithSlots,
  getAvailabilityByMonth,
  getSlotsByDate,
  addSingleSlot,
  toggleSlotStatus,
  getMyAvailability,
  deleteAvailability,
  updateOffDays,
};
