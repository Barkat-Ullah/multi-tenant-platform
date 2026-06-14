import { UserRoleEnum } from '@prisma/client';
import prisma from '../../utils/prisma';
import emailSender, {
  paymentSuccessAdminEmail,
  paymentSuccessDriverEmail,
} from '../../utils/sendMail';

export const getAdminAndSuperAdminEmails = async () => {
  const admins = await prisma.user.findMany({
    where: {
      role: { in: [UserRoleEnum.ADMIN, UserRoleEnum.SUPERADMIN] },
      isDeleted: false,
    },
    select: { id: true, email: true, fullName: true },
  });
  return admins;
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
    emailSender(
      driver.email,
      paymentSuccessDriverEmail(
        driver.fullName,
        bookingId,
        bookingDateStr,
        clinicName,
        amount,
        paymentMethod,
      ),
      'Payment Successful – Booking Confirmed',
    ).catch(err => console.error('Driver payment mail failed:', err));
  }

  for (const admin of admins) {
    emailSender(
      admin.email,
      paymentSuccessAdminEmail(
        admin.fullName,
        driver?.fullName ?? 'N/A',
        clinicName,
        bookingId,
        bookingDateStr,
        amount,
        paymentMethod,
      ),
      'Payment Received for Booking',
    ).catch(err => console.error('Admin payment mail failed:', err));
  }
};
