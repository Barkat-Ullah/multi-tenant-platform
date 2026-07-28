import * as bcrypt from 'bcrypt';
import config from '../../config';
import { UserRoleEnum, UserStatus } from '@prisma/client';
import prisma from '../utils/prisma';

export const initiateSuperAdmin = async () => {
  const hashedPassword = await bcrypt.hash(
    '12345678',
    Number(config.bcrypt_salt_rounds),
  );
  const payload: any = {
    fullName: 'Super Admin',
    email: 'superadmin@gmail.com',
    password: hashedPassword,
    role: UserRoleEnum.SUPERADMIN,
    isEmailVerified: true,
    status: UserStatus.ACTIVE,
  };
  const adminPayload: any = {
    fullName: 'Admin',
    email: 'admin@gmail.com',
    password: hashedPassword,
    role: UserRoleEnum.ADMIN,
    isEmailVerified: true,
    status: UserStatus.ACTIVE,
  };

  const isExistUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (isExistUser) return;

  await prisma.user.create({
    data: payload,
  });

  await prisma.user.create({
    data: adminPayload,
  });
};

// { label: "Driver", email: "driver@demo.com", password: "Demo@123", color: "bg-blue-500 hover:bg-blue-600" },
// { label: "Clinic", email: "clinic@demo.com", password: "Demo@123", color: "bg-green-500 hover:bg-green-600" },
// { label: "Organizer", email: "organizer@demo.com", password: "Demo@123", color: "bg-purple-500 hover:bg-purple-600" },
// { label: "Admin", email: "admin@demo.com", password: "Demo@123", color: "bg-orange-500 hover:bg-orange-600" },
// { label: "Super Admin", email: "superadmin@demo.com", password: "Demo@123", color: "bg-red-500 hover:bg-red-600" },
