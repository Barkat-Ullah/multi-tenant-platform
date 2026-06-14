import express from 'express';
import auth from '../../middlewares/auth';
import validateRequest from '../../middlewares/validateRequest';
import { paymentController } from '../Payment/payment.controller';
import { paymentValidation } from '../Payment/payment.validation';

const router = express.Router();

router.post(
  '/',
  auth(),
  paymentController.createPayment,
);

router.get('/', auth(), paymentController.getPaymentList);

router.get('/my', auth(), paymentController.getMyPayment);

router.get('/:id', auth(), paymentController.getPaymentById);

router.put(
  '/:id',
  auth(),
  validateRequest(paymentValidation.updateSchema),
  paymentController.updatePayment,
);

router.patch(
  '/toggle-status/:id',
  auth(),
  paymentController.toggleStatusPayment,
);

router.patch(
  '/soft-delete/:id',
  auth(),
  paymentController.softDeletePayment,
);

router.delete('/:id', auth(), paymentController.deletePayment);

export const paymentRoutes = router;