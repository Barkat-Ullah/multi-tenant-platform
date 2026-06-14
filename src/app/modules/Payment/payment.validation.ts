import { z } from 'zod';
import { Currency, PaymentStatus } from '@prisma/client';

const createSchema = z.object({
  userId: z.string({ required_error: 'userId is required', invalid_type_error: 'Invalid userId' }),
  subscriptionId: z.string({ required_error: 'subscriptionId is required', invalid_type_error: 'Invalid subscriptionId' }),
  amount: z.number({ required_error: 'amount is required', invalid_type_error: 'Invalid amount' }),
  currency: z.nativeEnum(Currency, { required_error: 'currency is required', invalid_type_error: 'Invalid currency' }).optional(),
  status: z.nativeEnum(PaymentStatus, { required_error: 'status is required', invalid_type_error: 'Invalid status' }).optional(),
  paymentMethodType: z.string({ required_error: 'paymentMethodType is required', invalid_type_error: 'Invalid paymentMethodType' }).optional(),
  cardBrand: z.string({ required_error: 'cardBrand is required', invalid_type_error: 'Invalid cardBrand' }).optional(),
  cardLast4: z.string({ required_error: 'cardLast4 is required', invalid_type_error: 'Invalid cardLast4' }).optional(),
  cardExpMonth: z.number({ required_error: 'cardExpMonth is required', invalid_type_error: 'Invalid cardExpMonth' }).int('Must be an integer').optional(),
  cardExpYear: z.number({ required_error: 'cardExpYear is required', invalid_type_error: 'Invalid cardExpYear' }).int('Must be an integer').optional(),
  stripeSessionId: z.string({ required_error: 'stripeSessionId is required', invalid_type_error: 'Invalid stripeSessionId' }).optional(),
  stripePaymentId: z.string({ required_error: 'stripePaymentId is required', invalid_type_error: 'Invalid stripePaymentId' }).optional(),
  stripeCustomerId: z.string({ required_error: 'stripeCustomerId is required', invalid_type_error: 'Invalid stripeCustomerId' }).optional(),
});

const updateSchema = z.object({
  userId: z.string({ required_error: 'userId is required', invalid_type_error: 'Invalid userId' }).optional(),
  subscriptionId: z.string({ required_error: 'subscriptionId is required', invalid_type_error: 'Invalid subscriptionId' }).optional(),
  amount: z.number({ required_error: 'amount is required', invalid_type_error: 'Invalid amount' }).optional(),
  currency: z.nativeEnum(Currency, { required_error: 'currency is required', invalid_type_error: 'Invalid currency' }).optional(),
  status: z.nativeEnum(PaymentStatus, { required_error: 'status is required', invalid_type_error: 'Invalid status' }).optional(),
  paymentMethodType: z.string({ required_error: 'paymentMethodType is required', invalid_type_error: 'Invalid paymentMethodType' }).optional(),
  cardBrand: z.string({ required_error: 'cardBrand is required', invalid_type_error: 'Invalid cardBrand' }).optional(),
  cardLast4: z.string({ required_error: 'cardLast4 is required', invalid_type_error: 'Invalid cardLast4' }).optional(),
  cardExpMonth: z.number({ required_error: 'cardExpMonth is required', invalid_type_error: 'Invalid cardExpMonth' }).int('Must be an integer').optional(),
  cardExpYear: z.number({ required_error: 'cardExpYear is required', invalid_type_error: 'Invalid cardExpYear' }).int('Must be an integer').optional(),
  stripeSessionId: z.string({ required_error: 'stripeSessionId is required', invalid_type_error: 'Invalid stripeSessionId' }).optional(),
  stripePaymentId: z.string({ required_error: 'stripePaymentId is required', invalid_type_error: 'Invalid stripePaymentId' }).optional(),
  stripeCustomerId: z.string({ required_error: 'stripeCustomerId is required', invalid_type_error: 'Invalid stripeCustomerId' }).optional(),
});

export const paymentValidation = {
  createSchema,
  updateSchema,
};