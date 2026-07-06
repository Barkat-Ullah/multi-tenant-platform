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

  const isExistUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
  });

  if (isExistUser) return;

  await prisma.user.create({
    data: payload,
  });
};
