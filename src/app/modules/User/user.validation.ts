import { z } from "zod";
import { userRole, userStatus } from "../../constant";

const updateUser = z.object({
  body: z.object({
    fullName: z.string().optional(),
    businessType: z.string().optional(),
    describe: z.string().optional(),
    city: z
      .string()
      .max(100)
      .nullable()
      .optional()
      .transform(v => (v === '' ? null : v)),
    address: z
      .string()
      .max(300)
      .nullable()
      .optional()
      .transform(v => (v === '' ? null : v)),
    phoneNumber: z
      .string()
      .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number')
      .nullable()
      .optional(),

    role: z.enum(['USER', 'ADMIN']).optional(),
    status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  }),
});
const updateUserRoleSchema = z.object({
    body: z.object({
        role: z.enum(userRole)
    })
})
const updateUserStatus = z.object({
    body: z.object({
        status: z.enum(userStatus)
    })
})

const updateClientInfoSchema = z.object({
  body: z.object({
    fullName: z.string().optional(),
    phoneNumber: z
      .string()
      .regex(/^\+?[0-9]{7,15}$/, 'Invalid phone number')
      .nullable()
      .optional()
      .transform(v => (v === '' ? null : v)),
    describe: z.string().nullable().optional().transform(v => (v === '' ? null : v)),
    city: z
      .string()
      .max(100)
      .nullable()
      .optional()
      .transform(v => (v === '' ? null : v)),
    address: z
      .string()
      .max(300)
      .nullable()
      .optional()
      .transform(v => (v === '' ? null : v)),
    image: z.string().nullable().optional(),
  }),
});

const sendManualEmailSchema = z.object({
  body: z.object({
    subject: z.string({ required_error: 'subject is required' }).min(1, 'subject cannot be empty'),
    message: z.string({ required_error: 'message is required' }).min(1, 'message cannot be empty'),
  }),
});

export const userValidation = {
  updateUser,
  updateUserRoleSchema,
  updateUserStatus,
  updateClientInfoSchema,
  sendManualEmailSchema,
};
