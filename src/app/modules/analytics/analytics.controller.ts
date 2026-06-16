import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';
import { analyticsService } from './analytics.service';

const getAdminAnalytics = catchAsync(async (req: Request, res: Response) => {
  const period = (req.query.period as 'daily' | 'weekly' | 'monthly') ?? 'monthly';
  const result = await analyticsService.getAdminAnalytics(period);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Admin analytics retrieved successfully',
    data: result,
  });
});

const getDriverAnalytics = catchAsync(async (req: Request, res: Response) => {
  const result = await analyticsService.getDriverAnalytics(req.user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Driver analytics retrieved successfully',
    data: result,
  });
});

const getOrganizerAnalytics = catchAsync(
  async (req: Request, res: Response) => {
    const result = await analyticsService.getOrganizerAnalytics(req.user.id);
    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Organizer analytics retrieved successfully',
      data: result,
    });
  },
);

const getClinicAnalytics = catchAsync(async (req: Request, res: Response) => {
  const result = await analyticsService.getClinicAnalytics(req.user.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Clinic analytics retrieved successfully',
    data: result,
  });
});

export const analyticsController = {
  getAdminAnalytics,
  getDriverAnalytics,
  getOrganizerAnalytics,
  getClinicAnalytics,
};
