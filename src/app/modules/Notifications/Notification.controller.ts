import { NextFunction, Request, RequestHandler, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { notificationServices } from '../Notifications/Notification.service';
import pick from '../../utils/pickValidFields';

const sseNotifyController: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  notificationServices.sseNotify(req, res, next);
};


const sendNotification = catchAsync(async (req: any, res: any) => {
  const notification = await notificationServices.sendSingleNotification(req);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'notification sent successfully',
    data: notification,
  });
});

const sendNotifications = catchAsync(async (req: any, res: any) => {
  const notifications = await notificationServices.sendNotifications(req);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'notifications sent successfully',
    data: notifications,
  });
});



const getMyNotification = catchAsync(async (req, res) => {
  const userMail = req.user.id;
  const result = await notificationServices.getMyNotifications(userMail);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Notifications fetched successfully',
    data: result.notifications,
  });
});
const getNotifications = catchAsync(async (req: any, res: any) => {
  const options = pick(req.query, ['page', 'limit']);
  const result = await notificationServices.getNotificationsFromDB(
    req,
    options,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notifications fetched successfully',
    meta: result.meta,
    data: result.data,
  });
});


const getSingleNotificationById = catchAsync(async (req: any, res: any) => {
  const notificationId = req.params.notificationId;
  const notification = await notificationServices.getSingleNotificationFromDB(
    req,
    notificationId,
  );

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Notification retrieved successfully',
    data: notification,
  });
});

export const notificationController = {
  sseNotifyController,
  sendNotification,
  sendNotifications,
  getNotifications,
  getSingleNotificationById,
  getMyNotification,
};
