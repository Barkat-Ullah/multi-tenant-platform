import { UserRoleEnum } from '@prisma/client';
import prisma from '../../utils/prisma';
import emailSender, {
  paymentSuccessAdminEmail,
  paymentSuccessDriverEmail,
} from '../../utils/sendMail';
import { mailQueue } from '../../helpers/queue';
import { cacheOr, CacheKeys, TTL } from '../../../lib/redis';

export const getAdminAndSuperAdminEmails = async () => {
  const result = await cacheOr(
    await CacheKeys.single('admin', 'emails'),
    TTL.LONG,
    async () => {
      const admins = await prisma.user.findMany({
        where: {
          role: { in: [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN] },
          isDeleted: false,
        },
        select: { id: true, email: true, fullName: true },
      });
      return admins;
    },
  );
  return result ?? [];
};

export const sendPaymentSuccessMails = async (
  bookingId: string,
  driverId: string,
  amount: number,
  paymentMethod: string,
) => {
  const [driver, admins, booking] = await Promise.all([
    prisma.user.findUnique({
      where: { id: driverId },
      select: { email: true, fullName: true },
    }),
    getAdminAndSuperAdminEmails(),
    prisma.booking.findUnique({
      where: { id: bookingId },
      select: { scheduledAt: true, clinic: { select: { fullName: true } } },
    }),
  ]);

  const bookingDateStr = booking?.scheduledAt
    ? new Date(booking.scheduledAt).toDateString()
    : 'N/A';
  const clinicName = booking?.clinic?.fullName ?? 'N/A';

  if (driver?.email) {
    mailQueue.add('send-email', {
      type: 'payment-success-driver',
      to: driver.email,
      html: paymentSuccessDriverEmail(
        driver.fullName,
        bookingId,
        bookingDateStr,
        clinicName,
        amount,
        paymentMethod,
      ),
      subject: 'Payment Successful – Booking Confirmed',
    }).catch(err => console.error('Driver payment mail queue failed:', err));
  }

  for (const admin of admins) {
    mailQueue.add('send-email', {
      type: 'payment-success-admin',
      to: admin.email,
      html: paymentSuccessAdminEmail(
        admin.fullName,
        driver?.fullName ?? 'N/A',
        clinicName,
        bookingId,
        bookingDateStr,
        amount,
        paymentMethod,
      ),
      subject: 'Payment Received for Booking',
    }).catch(err => console.error('Admin payment mail queue failed:', err));
  }
};
