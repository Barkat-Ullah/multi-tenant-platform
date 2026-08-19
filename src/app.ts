import { Application } from 'express';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import router from './app/routes';
import express, { Request, Response } from 'express';
import {
  apiLimiter,
  uploadLimiter,
  documentUpload,
  notFound,
  serverHealth,
  setupMiddlewares,
} from './shared';
import { fileUploader } from './app/utils/fileUploader';
import auth from './app/middlewares/auth';
//
import { sendPaymentSuccessMails } from './app/modules/booking/booking.helper';
import prisma from './app/utils/prisma';
import { bookingSelect } from './app/modules/booking/booking.select';
import { BookingStatus } from '@prisma/client';
import { stripe } from './app/utils/stripe';
import { CacheInvalidator } from './lib/redis';
import { isRedisHealthy } from './lib/redis';

const app: Application = express();

setupMiddlewares(app);

app.use('/api/v1', apiLimiter, router);

// Upload route (after main routes, before error handler)
app.post(
  '/api/v1/upload-document',
  auth(),
  uploadLimiter,
  fileUploader.upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'pdf', maxCount: 1 },
    { name: 'files', maxCount: 1 },
  ]),
  documentUpload,
);

// Root route (Better: JSON response with icon)
app.get('/', (req: Request, res: Response) => {
  res.send({
    Message: 'The server is running. . .',
  });
});

app.get('/payment/cancel', (req: Request, res: Response) => {
  res.status(200).json({
    success: false,
    message: 'Payment was cancelled. No charge was made.',
  });
});

app.get('/health', serverHealth);

// 404 handler (before global error)
app.use(notFound);

// Global error handler (last)
app.use(globalErrorHandler);

export default app;
