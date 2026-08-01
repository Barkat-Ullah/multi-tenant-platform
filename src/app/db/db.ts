import * as bcrypt from 'bcrypt';
import config from '../../config';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import prisma from '../utils/prisma';

export const seedDemoUsers = async () => {
  try {
    const hashedPassword = await bcrypt.hash(
      'Demo@123',
      Number(config.bcrypt_salt_rounds) || 12
    );

    const demoUsers = [
      {
        fullName: 'Driver Demo',
        email: 'driver@demo.com',
        password: hashedPassword,
        role: UserRoleEnum.USER,
        isEmailVerified: true,
        status: UserStatus.ACTIVE,
      },
      {
        fullName: 'Organizer Demo',
        email: 'organizer@demo.com',
        password: hashedPassword,
        role: UserRoleEnum.ORGINIZER,
        isEmailVerified: true,
        status: UserStatus.ACTIVE,
      },
      {
        fullName: 'Admin Demo',
        email: 'admin@demo.com',
        password: hashedPassword,
        role: UserRoleEnum.ADMIN,
        isEmailVerified: true,
        status: UserStatus.ACTIVE,
      },
      {
        fullName: 'Super Admin Demo',
        email: 'superadmin@demo.com',
        password: hashedPassword,
        role: UserRoleEnum.SUPERADMIN,
        isEmailVerified: true,
        status: UserStatus.ACTIVE,
      },
    ];

    for (const userData of demoUsers) {
      const isExistUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (!isExistUser) {
        await prisma.user.create({
          data: userData,
        });
        console.log(`✅ Demo user created: ${userData.email}`);
      }
    }
  } catch (error) {
    console.error('Error seeding demo users:', error);
  }
};