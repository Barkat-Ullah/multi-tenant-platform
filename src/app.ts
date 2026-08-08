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
import config from './config';
// import { StripeWebHook } from './app/utils/StripeUtils';

const app: Application = express();

setupMiddlewares(app);

app.use('/api/v1', apiLimiter, router);

// Stripe webhook (if needed, before error handler)
app.post(
  '/api/v1/stripe/webhook',
  express.raw({ type: 'application/json' }),
  // StripeWebHook,
);

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

app.get('/payment/success', async (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  const bookingId = req.query.bookingId as string;

  if (!sessionId) {
    return res.redirect(
      `${config.base_url_client}/payment/cancel?bookingId=${bookingId || ''}`,
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const { bookingId: metaBookingId, paymentId } = session.metadata as {
      bookingId: string;
      paymentId: string;
    };

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (payment?.status === 'SUCCESS') {
      return res.redirect(
        `${config.base_url_client}/payment/success?bookingId=${metaBookingId}`,
      );
    }

    const booking = await prisma.$transaction(async tx => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCESS',
          stripePaymentId: session.payment_intent as string,
        },
      });

      const updated = await tx.booking.update({
        where: { id: metaBookingId },
        data: { status: BookingStatus.CONFIRMED },
        select: bookingSelect,
      });

      const fullBooking = await tx.booking.findUnique({
        where: { id: metaBookingId },
      });

      await tx.notification.create({
        data: {
          receiverId: fullBooking!.driverId,
          title: 'Payment Successful',
          body: 'Your payment was received and your booking is confirmed.',
          type: 'Payment',
          referenceId: metaBookingId,
        },
      });

      return updated;
    });

    // Cross-model invalidation after payment confirmation
    await Promise.all([
      CacheInvalidator.onRecordUpdate('booking', metaBookingId),
      CacheInvalidator.onRecordUpdate('payment', paymentId),
      CacheInvalidator.onRelatedChange('notification'),
    ]);

    // send payment success mails
    const confirmedBooking = await prisma.booking.findUnique({
      where: { id: metaBookingId },
      select: { driverId: true },
    });

    if (confirmedBooking) {
      sendPaymentSuccessMails(
        metaBookingId,
        confirmedBooking.driverId,
        session.amount_total ? session.amount_total / 100 : 0,
        'Stripe',
      ).catch(err => console.error('Stripe payment mail error:', err));
    }
    return res.redirect(
      `${config.base_url_client}/payment/success?bookingId=${metaBookingId}`,
    );
  } catch (error) {
    console.error('Stripe success handler error:', error);
  }
});

app.get('/payment/cancel', (req: Request, res: Response) => {
  const bookingId = req.query.bookingId as string;
  return res.redirect(
    `${config.base_url_client}/payment/cancel?bookingId=${bookingId || ''}`,
  );
});
app.get('/health', serverHealth);

// 404 handler (before global error)
app.use(notFound);

// Global error handler (last)
app.use(globalErrorHandler);

export default app;
