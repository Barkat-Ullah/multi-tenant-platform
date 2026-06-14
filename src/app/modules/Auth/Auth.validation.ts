import { UserRoleEnum } from '@prisma/client';
import z from 'zod';

const loginUser = z.object({
  body: z.object({
    email: z
      .string({
        required_error: 'Email is required!',
      })
      .email({
        message: 'Invalid email format!',
      }),
    password: z.string({
      required_error: 'Password is required!',
    }),
  }),
});

const registerSchema = z.object({
  fullName: z.string({ required_error: 'fullName is required' }).min(1),
  email: z.string({ required_error: 'email is required' }).email(),
  phoneNumber: z.string().optional(),
  password: z.string({ required_error: 'password is required' }).min(6),
  companyLocation: z.string().optional(),
  role: z
    .enum([UserRoleEnum.USER, UserRoleEnum.ORGINIZER])
    .optional()
    .default(UserRoleEnum.USER),
});
const forgetPasswordValidationSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'email is required' })
      .email({ message: 'Use a valid Email' }),
  }),
});

const verifyOtpValidationSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'email is required' })
      .email({ message: 'Use a valid Email' }),
    otp: z.string({ required_error: 'Otp is required.' }),
  }),
});

const verifyTokenValidationSchema = z.object({
  body: z.object({
    token: z.string({ required_error: 'Token is required.' }),
  }),
});

const resetPasswordValidationSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'User email is required!' })
      .trim()
      .email({ message: 'Use a valid Email' }),
    password: z.string({ required_error: 'New Password is required!' }),
  }),
});

export const authValidation = {
  loginUser,
  registerSchema,
  forgetPasswordValidationSchema,
  verifyOtpValidationSchema,
  verifyTokenValidationSchema,
  resetPasswordValidationSchema,
};
