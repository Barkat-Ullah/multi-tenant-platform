import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { prisma } from '../../utils/prisma';
import { getMessaging } from './firebaseAdmin';
import { Request, RequestHandler } from 'express';
import { addSSEClient, removeSSEClient } from './sse';
import { IPaginationOptions } from '../../interface/pagination.type';
import { paginationHelper } from '../../utils/calculatePagination';
import { cacheOr, CacheKeys, TTL, CacheInvalidator } from '../../../lib/redis';

type SendNotificationParams = {
  userId: string;
  senderId: string;
  title: string;
  body: string;
};

const sseNotify: RequestHandler = (req, res, _next) => {
  const userId = (req as any).user.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`event: connected\ndata: {"message":"SSE connected"}\n\n`);

  addSSEClient(userId, res);

  req.on('close', () => {
    removeSSEClient(userId, res);
    console.log(`SSE disconnected: ${userId}`);
  });
};

export const sendSingleNotificationUtils = async ({
  userId,
  senderId,
  title,
  body,
}: SendNotificationParams) => {
  if (!title || !body) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Title and body are required');
  }

  // Save in DB first — in-app notifications should always work
  await prisma.notification.create({
    data: { receiverId: userId, senderId, title, body },
  });

  await CacheInvalidator.onRelatedChange('notification');

  // Attempt FCM push — non-fatal if token missing or invalid
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (user?.fcmToken) {
      const message = {
        notification: { title, body },
        token: user.fcmToken,
      };
      return await getMessaging().send(message);
    }
  } catch (error: any) {
    console.error('FCM push failed (DB notification already saved):', error.message);
  }

  return null;
};

// Send notification to a single user
const sendSingleNotification = async (req: any) => {
  try {
    const { userId } = req.params;
    const { title, body } = req.body;

    if (!title || !body) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Title and body are required');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.fcmToken) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found with FCM token');
    }

    const message = {
      notification: {
        title,
        body,
      },
      token: user.fcmToken,
    };

    await prisma.notification.create({
      data: {
        receiverId: userId,
        senderId: req.user.id,
        title,
        body,
      },
    });

    await CacheInvalidator.onRelatedChange('notification');

    const response = await getMessaging().send(message);
    return response;
  } catch (error: any) {
    console.error('Error sending notification:', error);
    if (error.code === 'messaging/invalid-registration-token') {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid FCM registration token');
    } else if (error.code === 'messaging/registration-token-not-registered') {
      throw new AppError(httpStatus.NOT_FOUND, 'FCM token is no longer registered');
    } else {
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, error.message || 'Failed to send notification');
    }
  }
};

// Send notifications to all users with valid FCM tokens
const sendNotifications = async (req: Request) => {
  try {
    const { title, body } = req.body;

    if (!title || !body) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Title and body are required');
    }

    const users = await prisma.user.findMany({
      where: {
        fcmToken: {
          not: null,
        },
      },
      select: {
        id: true,
        fcmToken: true,
      },
    });

    if (!users || users.length === 0) {
      throw new AppError(httpStatus.NOT_FOUND, 'No users found with FCM tokens');
    }

    const fcmTokens = users.map(user => user.fcmToken);

    const message = {
      notification: {
        title,
        body,
      },
      tokens: fcmTokens,
    };

    const response = await getMessaging().sendEachForMulticast(message as any);

    const successIndices = response.responses
      .map((res: any, idx: number) => (res.success ? idx : null))
      .filter((_: any, idx: number) => idx !== null) as number[];

    const successfulUsers = successIndices.map(idx => users[idx]);

    const notificationData = successfulUsers.map(user => ({
      receiverId: user.id,
      senderId: req.user.id,
      title,
      body,
    }));

    await prisma.notification.createMany({
      data: notificationData,
    });

    // Invalidate notification cache (bulk creation)
    await CacheInvalidator.onRelatedChange('notification');

    const failedTokens = response.responses
      .map((res: any, idx: number) => (!res.success ? fcmTokens[idx] : null))
      .filter((token: string | null): token is string => token !== null);

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      failedTokens,
    };
  } catch (error: any) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, error.message || 'Failed to send notifications');
  }
};

// Fetch notifications for the current user

const getNotificationsFromDB = async (
  req: any,
  options: IPaginationOptions,
) => {
  const userId = req.user.id;

  if (!userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  const { page, limit, skip } = paginationHelper.calculatePagination(options);

  const cacheKey = await CacheKeys.myList('notification', userId, { page, limit });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { receiverId: userId },
        include: {
          sender: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({
        where: { receiverId: userId },
      }),
    ]);

    return {
      meta: {
        total,
        page,
        limit,
      },
      data: notifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        body: notification.body,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        sender: {
          id: notification?.sender?.id,
        },
      })),
    };
  });

  return cached ?? { meta: { total: 0, page, limit }, data: [] };
};

// Fetch a single notification and mark it as read
const getSingleNotificationFromDB = async (
  req: any,
  notificationId: string,
) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required');
    }

    if (!notificationId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Notification ID is required');
    }

    // Mark the notification as read (throws if record not found)
    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Invalidate notification cache (marked as read)
    await CacheInvalidator.onRelatedChange('notification');

    // Return the updated notification
    return {
      id: updatedNotification.id,
      title: updatedNotification.title,
      body: updatedNotification.body,
      isRead: updatedNotification.isRead,
      createdAt: updatedNotification.createdAt,
      sender: {
        id: updatedNotification?.sender?.id,
        email: updatedNotification?.sender?.email,
      },
    };
  } catch (error: any) {
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, error.message || 'Failed to fetch notification');
  }
};

const getMyNotifications = async (userId: string) => {
  if (!userId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User ID is required');
  }

  const cacheKey = await CacheKeys.myList('notification', userId, { limit: 100, scope: 'my' });
  const cached = await cacheOr(cacheKey, TTL.SHORT, async () => {
    const notifications = await prisma.notification.findMany({
      where: { receiverId: userId },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
      select: {
        id: true,
        title: true,
        body: true,
        isRead: true,
        createdAt: true,
        sender: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return { notifications };
  });

  return cached ?? { notifications: [] };
};

export const notificationServices = {
  sendSingleNotification,
  sendNotifications,
  getNotificationsFromDB,
  getSingleNotificationFromDB,
  getMyNotifications,
  sseNotify,
};