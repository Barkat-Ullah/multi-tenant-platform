import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuthServices } from '../Auth/Auth.service';
import { UserRoleEnum } from '@prisma/client';
import ApiError from '../../errors/AppError';

const loginWithOtp = catchAsync(async (req, res) => {
  const result = await AuthServices.loginWithOtpFromDB(res, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    message:result.message,
    data: result,
  });
});

const registerWithOtp = catchAsync(async (req, res) => {
  const result = await AuthServices.registerWithOtpIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    message: 'User Created Successfully',
    data: result,
  });
});

const logoutUser = catchAsync(async (req, res) => {
  // Clear the token cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User Successfully logged out',
    data: null,
  });
});

const resendVerificationWithOtp = catchAsync(async (req, res) => {
  const email = req.body.email;
  const result = await AuthServices.resendVerificationWithOtp(email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Verification OTP sent successfully',
    data: result,
  });
});

const changePassword = catchAsync(async (req, res) => {
  const user = req.user;
  const result = await AuthServices.changePassword(user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Password changed successfully',
    data: result,
  });
});

const forgetPassword = catchAsync(async (req, res) => {
  const result = await AuthServices.forgetPassword(req.body.email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: 'Verification OTP has sent to email',
    data: result,
  });
});

const verifyOtpCommon = catchAsync(async (req, res) => {
  const result = await AuthServices.verifyOtpCommon(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    message: result.message,
    data: result,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  await AuthServices.resetPassword(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Password Reset!',
    data: null,
  });
});

/* ===========================================================================================
 ************************************* SOCIAL LOGIN ******************************************
 * =========================================================================================== */

//Social Login

// Redirect to Google OAuth
const getGoogleAuthUrl = catchAsync(async (req, res) => {
  const role = req.query.role as UserRoleEnum;
  const url = AuthServices.getGoogleAuthUrl(role);
  console.log({ url });
  res.redirect(url);
});

// Google OAuth callback
const googleCallback = catchAsync(async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  console.log({ code });
  if (!code || typeof code !== 'string') {
    throw new Error('Authorization code not provided');
  }

  console.log(state);
  if (!state || typeof state !== 'string') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'OAuth state not provided');
  }

  const result = await AuthServices.googleCallback(code, state);

  // sendResponse(res, {
  //   statusCode: httpStatus.OK,
  //   success: true,
  //   message: "User logged in successfully",
  //   data: result
  // })

  const frontendUrl = `${process.env.FRONTEND_BASE_URL}/auth/google/callback?token=${result.accessToken}`;
  res.redirect(frontendUrl);
});

// Token-based Google login (for mobile)
const googleLogin = catchAsync(async (req, res) => {
  const { token } = req.body;
  const result = await AuthServices.googleLogin(token);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User logged in successfully',
    data: result,
  });
});

// Redirect to Facebook OAuth
const getFacebookAuthUrl = catchAsync(async (req, res) => {
  const url = AuthServices.getFacebookAuthUrl();
  res.redirect(url);
});

// Facebook OAuth callback
const facebookCallback = catchAsync(async (req, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    throw new Error('Authorization code not provided');
  }
  const result = await AuthServices.facebookCallback(code);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User logged in successfully',
    data: result,
  });
  const frontendUrl = `${process.env.FRONTEND_BASE_URL}/auth/facebook/callback?token=${result.token}`;
  res.redirect(frontendUrl);
});

// Token-based Facebook login (for mobile)
const facebookLogin = catchAsync(async (req, res) => {
  const { token } = req.body;
  const result = await AuthServices.facebookLogin(token);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User logged in successfully',
    data: result,
  });
});

export const AuthControllers = {
  loginWithOtp,
  registerWithOtp,
  logoutUser,
  resendVerificationWithOtp,
  changePassword,
  forgetPassword,
  verifyOtpCommon,
  resetPassword,
  // Social Login
  getGoogleAuthUrl,
  googleCallback,
  googleLogin,
  getFacebookAuthUrl,
  facebookCallback,
  facebookLogin,
};
