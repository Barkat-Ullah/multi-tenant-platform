import express from 'express';
import auth from '../../middlewares/auth';
import { UserRoleEnum } from '@prisma/client';
import { AuthControllers } from '../Auth/Auth.controller';
import validateRequest from '../../middlewares/validateRequest';
import { authValidation } from './Auth.validation';

const router = express.Router();

router.post(
  '/login',
  // validateRequest.body(authValidation.loginUser),
  AuthControllers.loginWithOtp,
);

router.post(
  '/register',
  validateRequest(authValidation.registerSchema),
  AuthControllers.registerWithOtp,
);
router.post('/logout', AuthControllers.logoutUser);

router.post('/verify-email-with-otp', AuthControllers.verifyOtpCommon);

router.post(
  '/resend-verification-with-otp',
  AuthControllers.resendVerificationWithOtp,
);

router.post(
  '/change-password',
  auth(UserRoleEnum.USER, UserRoleEnum.ADMIN,UserRoleEnum.SUPERADMIN,UserRoleEnum.CLINIC,UserRoleEnum.ORGINIZER),
  AuthControllers.changePassword,
);

router.post(
  '/forget-password',
  // validateRequest.body(authValidation.forgetPasswordValidationSchema),
  AuthControllers.forgetPassword,
);

router.post(
  '/reset-password',
  // validateRequest.body(authValidation.resetPasswordValidationSchema),
  AuthControllers.resetPassword,
);

//Google login

// OAuth redirect routes (for web)
router.get('/google', AuthControllers.getGoogleAuthUrl);

// OAuth callback route
router.get('/google/callback', AuthControllers.googleCallback);

// Token-based login routes (for mobile apps)
router.post('/google-login', AuthControllers.googleLogin);

//Facebook login

// OAuth redirect routes (for web)
router.get('/facebook', AuthControllers.getFacebookAuthUrl);

// OAuth callback route
router.get('/facebook/callback', AuthControllers.facebookCallback);

// Token-based login routes (for mobile apps)
router.post('/facebook-login', AuthControllers.facebookLogin);
export const AuthRouters = router;
