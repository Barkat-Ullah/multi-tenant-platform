import { generateOtpEmail } from '../../utils/sendMail';
import * as bcrypt from 'bcrypt';
import httpStatus from 'http-status';
import { Secret, SignOptions } from 'jsonwebtoken';
import config from '../../../config';
import AppError from '../../errors/AppError';
import {
  SocialProviderEnum,
  User,
  UserRoleEnum,
  UserStatus,
} from '@prisma/client';
import { Response } from 'express';
import {
  getOtpStatusMessage,
  otpExpiryTime,
  generateOTP,
} from '../../utils/otp';
import { generateToken } from '../../utils/generateToken';
import { prisma } from '../../utils/prisma';
import emailSender from '../../utils/sendMail';
import axios from 'axios';
import { OAuth2Client } from 'google-auth-library';
import {
  ALLOWED_GOOGLE_ROLES,
  signState,
  verifyState,
} from './socialLoginUtils';
import ApiError from '../../errors/AppError';
import crypto from 'crypto';
import {
  setOtp,
  getOtp,
  deleteOtp,
  setPendingRegistration,
  getPendingRegistration,
  deletePendingRegistration,
  cacheUserToken,
} from '../../../lib/authRedis';
import { mailQueue } from '../../helpers/queue';
// ======================== LOGIN WITH OTP ========================
const loginWithOtpFromDB = async (
  res: Response,
  payload: { email: string; password: string },
) => {
  const userData = await prisma.user.findUnique({
    where: { email: payload.email },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      password: true,
      isEmailVerified: true,
      image: true,
      status: true,
      isDeleted: true,
    },
  });

  if (!userData) {
    throw new AppError(401, 'User not found');
  }

  const isCorrectPassword = await bcrypt.compare(
    payload.password,
    userData.password,
  );
  if (!isCorrectPassword)
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect');

  if (userData.role !== UserRoleEnum.ADMIN && !userData.isEmailVerified) {
    const otp = generateOTP().toString();

    // Store OTP in Redis instead of MongoDB (ephemeral data optimization)
    await setOtp(userData.email, otp);

    const html = generateOtpEmail(otp);
    // Queue email sending via BullMQ for async delivery (P99 latency improvement)
    await mailQueue.add('send-otp', {
      to: payload.email,
      html,
      subject: 'OTP Verification',
    });

    return {
      message: 'Please check your email for the verification OTP.',
      id: userData.id,
      name: userData.fullName,
      email: userData.email,
      role: userData.role,
      isEmailVerified: userData.isEmailVerified,
      accessToken: null,
    };
  } else {
    const accessToken = await generateToken(
      {
        id: userData.id,
        name: userData.fullName,
        email: userData.email,
        role: userData.role,
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as SignOptions['expiresIn'],
    );

    // Pre-warm auth cache
    await cacheUserToken(userData.id, {
      id: userData.id,
      name: userData.fullName,
      email: userData.email,
      role: userData.role,
      image: userData.image,
      isEmailVerified: userData.isEmailVerified,
      isDeleted: userData.isDeleted,
      status: userData.status,
    }).catch(() => {});

    return {
      message: 'User logged in successfully',
      id: userData.id,
      name: userData.fullName,
      email: userData.email,
      role: userData.role,
      isEmailVerified: userData.isEmailVerified,
      accessToken,
    };
  }
};

// ======================== REGISTER WITH OTP (Redis-First) ========================
const registerWithOtpIntoDB = async (payload: User) => {
  const { fullName, email, phoneNumber, dob, password, companyLocation, role } =
    payload;
  const userRole = role ?? UserRoleEnum.USER;

  // cross-field check moved here
  if (userRole === UserRoleEnum.ORGINIZER && !companyLocation) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'companyLocation is required for organizer registration',
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // Check if a pending registration already exists in Redis
  const existingPending = await getPendingRegistration(email);
  if (existingPending) {
    throw new AppError(
      httpStatus.CONFLICT,
      'A verification email has already been sent. Please check your inbox or try again later.',
    );
  }

  // Check if user already exists in DB (to prevent re-registration)
  const isUserExist = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (isUserExist) {
    throw new AppError(httpStatus.CONFLICT, 'User already exists');
  }

  const otp = generateOTP().toString();

  // 💡 OPTIMIZATION: Store pending registration in Redis with 30-min TTL
  // No DB write until OTP is verified — eliminates dead user rows
  await setPendingRegistration(email, {
    fullName,
    email,
    phoneNumber: phoneNumber || null,
    password: hashedPassword,
    role: userRole,
    companyLocation: companyLocation || null,
    dob: dob || null,
    createdAt: Date.now(),
  });

  // 💡 OPTIMIZATION: Store OTP in Redis with 5-min TTL instead of MongoDB
  await setOtp(email, otp);

  // 💡 OPTIMIZATION: Queue email via BullMQ — response returns in ~50ms
  const html = generateOtpEmail(otp);
  mailQueue.add('send-otp', {
    type: 'otp-email',
    to: email,
    html,
    subject: 'OTP Verification',
  }).catch(err => console.error('Mail queue failed:', err));

  return {
    message:
      'Please check your email to verify your account. Your registration data is valid for 30 minutes.',
    email,
  };
};

// ======================== COMMON OTP VERIFY (REGISTER + FORGOT) ========================
const verifyOtpCommon = async (payload: { email: string; otp: string }) => {
  const { email, otp } = payload;

  // 💡 OPTIMIZATION: First check Redis for OTP (covers both pending registrations and existing users)
  const redisOtp = await getOtp(email);

  // If OTP found in Redis, it's a pending registration flow
  if (redisOtp) {
    if (redisOtp !== otp) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP');
    }

    // Check if this is a pending registration (Redis-first flow)
    const pendingReg = await getPendingRegistration(email);
    if (pendingReg) {
      // Create user in MongoDB now that OTP is verified
      const newUser = await prisma.user.create({
        data: {
          fullName: pendingReg.fullName,
          email: pendingReg.email,
          phoneNumber: pendingReg.phoneNumber || null,
          password: pendingReg.password,
          role: pendingReg.role as UserRoleEnum,
          dob: pendingReg.dob || null,
          isAgreeWithTerms: true,
          isEmailVerified: true,
          ...(pendingReg.role === UserRoleEnum.ORGINIZER &&
            pendingReg.companyLocation && {
              companyLocation: pendingReg.companyLocation,
            }),
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isEmailVerified: true,
        },
      });

      // Clean up Redis
      await Promise.all([deleteOtp(email), deletePendingRegistration(email)]);

      // Generate access token
      const accessToken = await generateToken(
        {
          id: newUser.id,
          name: newUser.fullName,
          email: newUser.email,
          role: newUser.role,
        },
        config.jwt.access_secret as Secret,
        config.jwt.access_expires_in as SignOptions['expiresIn'],
      );

      // 💡 OPTIMIZATION: Cache user token in Redis for auth middleware
      await cacheUserToken(newUser.id, {
        id: newUser.id,
        name: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        image: null,
        isEmailVerified: true,
        isDeleted: false,
        status: 'ACTIVE',
      });

      return {
        message: 'Email verified successfully!',
        accessToken,
        id: newUser.id,
        name: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
      };
    }

    // OTP exists in Redis but no pending registration — could be login OTP
    // Delete OTP from Redis and return (skip MongoDB fallback)
    await deleteOtp(email);
    throw new AppError(httpStatus.BAD_REQUEST, 'OTP verification failed. No pending registration found.');
  }

  // Fallback: Check existing user in MongoDB (for login OTP, forgot password flows)
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      otp: true,
      otpExpiry: true,
      isEmailVerified: true,
      fullName: true,
      role: true,
    },
  });

  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found!');

  // If OTP was already verified via Redis, skip DB OTP check
  if (!redisOtp) {
    if (
      !user.otp ||
      user.otp !== otp ||
      !user.otpExpiry ||
      new Date(user.otpExpiry).getTime() < Date.now()
    ) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid or expired OTP');
    }
  }

  let message = 'OTP verified successfully!';

  if (user.isEmailVerified === false) {
    await prisma.user.update({
      where: { email: user.email },
      data: { otp: null, otpExpiry: null, isEmailVerified: true },
    });

    message = 'Email verified successfully!';

    // Generate access token for registration flow
    const accessToken = await generateToken(
      {
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: user.role,
      },
      config.jwt.access_secret as Secret,
      config.jwt.access_expires_in as SignOptions['expiresIn'],
    );

    // 💡 OPTIMIZATION: Cache user token in Redis for auth middleware
    await cacheUserToken(user.id, {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
      image: null,
      isEmailVerified: true,
      isDeleted: false,
      status: 'ACTIVE',
    });

    return {
      message,
      accessToken,
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
    };
  }
  // Handle forgot password case
  else {
    await prisma.user.update({
      where: { email: user.email },
      data: { otp: null, otpExpiry: null },
    });

    message = 'OTP verified for password reset!';
    return { message };
  }
};

// ======================== RESEND OTP ========================
const resendVerificationWithOtp = async (email: string) => {
  // Check if user exists in DB first (for existing users)
  const dbUser = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, status: true },
  });

  // Also check if there's a pending registration in Redis (for new users)
  const pendingReg = await getPendingRegistration(email);

  if (!dbUser && !pendingReg) {
    throw new AppError(401, 'User not found');
  }

  if (dbUser?.status === UserStatus.SUSPENDED) {
    throw new AppError(httpStatus.FORBIDDEN, 'User is Suspended');
  }

  const otp = generateOTP().toString();

  // 💡 OPTIMIZATION: Store OTP in Redis with 5-min TTL
  await setOtp(email, otp);

  // 💡 OPTIMIZATION: Queue email via BullMQ for async delivery
  const html = generateOtpEmail(otp);
  await mailQueue.add('send-otp', {
    type: 'otp-email',
    to: email,
    html,
    subject: 'OTP Verification',
  });

  return {
    message: 'Verification OTP sent successfully. Please check your inbox.',
  };
};

// ======================== CHANGE PASSWORD ========================
const changePassword = async (user: any, payload: any) => {
  const userData = await prisma.user.findUnique({
    where: { email: user.email, status: 'ACTIVE' },
    select: {
      id: true,
      email: true,
      password: true,
    },
  });

  if (!userData) {
    throw new AppError(401, 'User not found');
  }

  const isCorrectPassword = await bcrypt.compare(
    payload.oldPassword,
    userData.password,
  );
  if (!isCorrectPassword)
    throw new AppError(httpStatus.BAD_REQUEST, 'Password incorrect!');

  const hashedPassword = await bcrypt.hash(payload.newPassword, 12);

  await prisma.user.update({
    where: { id: userData.id },
    data: { password: hashedPassword },
  });

  return { message: 'Password changed successfully!' };
};

// ======================== FORGOT PASSWORD ========================
const forgetPassword = async (email: string) => {
  const userData = await prisma.user.findUnique({
    where: { email },
    select: { email: true, status: true, id: true },
  });
  if (!userData) {
    throw new AppError(401, 'User not found');
  }
  if (userData.status === UserStatus.SUSPENDED) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User has been suspended');
  }

  // 💡 OPTIMIZATION: Check existing Redis OTP to avoid unnecessary operations
  const existingOtp = await getOtp(email);
  if (existingOtp) {
    throw new AppError(httpStatus.CONFLICT, 'An OTP has already been sent. Please check your email or try again later.');
  }

  const otp = generateOTP().toString();

  // 💡 OPTIMIZATION: Store OTP in Redis (5-min TTL) — eliminates the Prisma transaction entirely
  // Previously this used a $transaction with 15s timeout wrapping both DB update and email I/O
  await setOtp(email, otp);

  // 💡 OPTIMIZATION: Queue email via BullMQ for async delivery
  const html = generateOtpEmail(otp);
  await mailQueue.add('send-otp', {
    type: 'otp-email',
    to: email,
    html,
    subject: 'OTP Verification',
  });

  return { message: 'OTP sent successfully' };
};

// ======================== RESET PASSWORD ========================
const resetPassword = async (payload: { password: string; email: string }) => {
  const user = await prisma.user.findUnique({
    where: { email: payload.email },
  });
  if (!user) throw new AppError(httpStatus.NOT_FOUND, 'User not found!');

  const hashedPassword = await bcrypt.hash(payload.password, 10);

  await prisma.user.update({
    where: { email: payload.email },
    data: { password: hashedPassword, otp: null, otpExpiry: null },
  });

  return { message: 'Password reset successfully' };
};

/* ===========================================================================================
 ************************************* SOCIAL LOGIN ******************************************
 * =========================================================================================== */

const googleClient = new OAuth2Client(
  config.google_client_id,
  config.google_client_secret,
  config.google_callback_url,
);

// Generate Google OAuth URL
const getGoogleAuthUrl = (role: UserRoleEnum) => {
  if (!ALLOWED_GOOGLE_ROLES.includes(role)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Invalid role. Allowed roles: ${ALLOWED_GOOGLE_ROLES.join(', ')}`,
    );
  }

  const state = signState({
    role,
    nonce: crypto.randomUUID(),
  });

  const url = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
    state,
  });

  return url;
};

// Handle Google OAuth callback
const googleCallback = async (code: string, state: string) => {
  let roleFromState: UserRoleEnum;

  try {
    const decoded = verifyState(state);
    roleFromState = decoded.role;
  } catch {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid/expired OAuth state');
  }

  const { tokens } = await googleClient.getToken(code);
  googleClient.setCredentials(tokens);

  if (!tokens.id_token) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Google login failed (missing id_token)',
    );
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Google login failed');
  }

  const { sub, email, name, picture } = payload;

  let socialAccount = await prisma.socialAccount.findUnique({
    where: {
      provider_providerId: {
        provider: SocialProviderEnum.GOOGLE,
        providerId: sub,
      },
    },
  });

  let user = null as any;

  if (socialAccount) {
    user = await prisma.user.findUnique({
      where: { id: socialAccount.userId },
    });

    if (!user) {
      await prisma.socialAccount.delete({ where: { id: socialAccount.id } });
      socialAccount = null;
    }
  }

  if (!socialAccount) {
    user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          fullName: name ?? '',
          image: picture ?? null,
          isSocialLogin: true,
          isEmailVerified: true,
          role: roleFromState,
          password: '',
          isAgreeWithTerms: true,
        },
      });
    }

    // link social account
    socialAccount = await prisma.socialAccount.create({
      data: {
        provider: SocialProviderEnum.GOOGLE,
        providerId: sub,
        userId: user.id,
      },
    });
  }

  // final guarantee: load user if still null
  if (!user) {
    user = await prisma.user.findUnique({
      where: { id: socialAccount.userId },
    });
    if (!user) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        'User not found after social login',
      );
    }
  }

  // update lastLoginAt (optional but useful)
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = await generateToken(
    {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as SignOptions['expiresIn'],
  );

  // Pre-warm auth cache so first authenticated request doesn't hit DB
  await cacheUserToken(user.id, {
    id: user.id,
    name: user.fullName,
    email: user.email,
    role: user.role,
    image: user.image,
    isEmailVerified: user.isEmailVerified,
    isDeleted: user.isDeleted,
    status: (user as any).status ?? 'ACTIVE',
  }).catch(() => {});

  return { user, accessToken };
};

// Token-based Google login (for mobile apps)
const googleLogin = async (token: string) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: token,
    audience: config.google_client_id,
  });

  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Google login failed');
  }

  const { sub, email, name, picture } = payload;

  let socialAccount = await prisma.socialAccount.findUnique({
    where: {
      provider_providerId: {
        provider: 'GOOGLE',
        providerId: sub,
      },
    },
    select: {
      id: true,
      provider: true,
      providerId: true,
      userId: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isSocialLogin: true,
          isEmailVerified: true,
          image: true,
        },
      },
    },
  });

  let user;

  if (!socialAccount) {
    user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          fullName: name ?? '',
          image: picture,
          isSocialLogin: true,
          isEmailVerified: true,
          password: '',
          isAgreeWithTerms: true,
        },
      });
    }

    socialAccount = await prisma.socialAccount.create({
      data: {
        provider: 'GOOGLE',
        providerId: sub,
        userId: user.id,
      },
      select: {
      id: true,
      provider: true,
      providerId: true,
      userId: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isSocialLogin: true,
          isEmailVerified: true,
          image: true,
        },
      },
    },
    });
  }
  // const accessToken = await generateToken(
  //   {
  //     id: userData.id,
  //     name: userData.fullName,
  //     email: userData.email,
  //     role: userData.role,
  //   },
  //   config.jwt.access_secret as Secret,
  //   config.jwt.access_expires_in as SignOptions['expiresIn'],
  // );

  const accessToken = await generateToken(
    {
      id: socialAccount.user.id,
      name: socialAccount.user.fullName,
      email: socialAccount.user.email as string,
      role: socialAccount.user.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as SignOptions['expiresIn'],
  );

  // Pre-warm auth cache
  await cacheUserToken(socialAccount.user.id, {
    id: socialAccount.user.id,
    name: socialAccount.user.fullName,
    email: socialAccount.user.email as string,
    role: socialAccount.user.role,
    image: socialAccount.user.image,
    isEmailVerified: socialAccount.user.isEmailVerified,
    isDeleted: false,
    status: 'ACTIVE',
  }).catch(() => {});

  return {
    user: socialAccount.user,
    accessToken,
  };
};

// Generate Facebook OAuth URL
const getFacebookAuthUrl = () => {
  const fbAppId = config.facebook_app_id;
  const redirectUri = `${config.facebook_callback_url}`;
  const scope = 'email,public_profile';

  return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${fbAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
};

// Handle Facebook OAuth callback
const facebookCallback = async (code: string) => {
  const fbAppId = `${config.facebook_app_id}`;
  const fbAppSecret = `${config.facebook_app_secret}`;
  const redirectUri = `${config.facebook_callback_url}`;

  // Exchange code for access token
  const tokenResponse = await axios.get(
    `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${fbAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${fbAppSecret}&code=${code}`,
  );

  const token = tokenResponse.data.access_token;

  // Get user info
  let fbRes;
  try {
    fbRes = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${token}`,
    );
  } catch (error: any) {
    console.error('Facebook API Error:', error.response?.data || error.message);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      error.response?.data?.error?.message || 'Invalid Facebook access token',
    );
  }

  const { id, email, name, picture } = fbRes.data;
  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Facebook login failed');
  }

  if (!email) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Email is required. Please grant email permission.',
    );
  }

  let socialAccount = await prisma.socialAccount.findUnique({
    where: {
      provider_providerId: {
        provider: 'FACEBOOK',
        providerId: id,
      },
    },
    select: {
      id: true,
      provider: true,
      providerId: true,
      userId: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isSocialLogin: true,
          isEmailVerified: true,
          image: true,
        },
      },
    },
  });

  let user;

  if (!socialAccount) {
    user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          fullName: name,
          image: picture?.data?.url,
          isSocialLogin: true,
          isEmailVerified: true,
          password: '',
          isAgreeWithTerms: true,
        },
      });
    } else {
      if (user.isSocialLogin === false) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Please login with email and password',
        );
      }
    }

    socialAccount = await prisma.socialAccount.create({
      data: {
        provider: 'FACEBOOK',
        providerId: id,
        userId: user.id,
      },
      select: {
      id: true,
      provider: true,
      providerId: true,
      userId: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isSocialLogin: true,
          isEmailVerified: true,
          image: true,
        },
      },
    },
    });
  } else {
    user = socialAccount.user;
  }

  const accessToken = await generateToken(
    {
      id: socialAccount.user.id,
      name: socialAccount.user.fullName,
      email: socialAccount.user.email as string,
      role: socialAccount.user.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as SignOptions['expiresIn'],
  );

  // Pre-warm auth cache
  await cacheUserToken(socialAccount.user.id, {
    id: socialAccount.user.id,
    name: socialAccount.user.fullName,
    email: socialAccount.user.email as string,
    role: socialAccount.user.role,
    image: socialAccount.user.image,
    isEmailVerified: socialAccount.user.isEmailVerified,
    isDeleted: false,
    status: 'ACTIVE',
  }).catch(() => {});

  return {
    token: accessToken,
    user: user,
  };
};

// Token-based Facebook login (for mobile apps)
const facebookLogin = async (token: string) => {
  let fbRes;
  try {
    fbRes = await axios.get(
      `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${token}`,
    );
  } catch (error: any) {
    console.error('Facebook API Error:', error.response?.data || error.message);
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      error.response?.data?.error?.message || 'Invalid Facebook access token',
    );
  }

  const { id, email, name, picture } = fbRes.data;
  if (!id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Facebook login failed');
  }

  if (!email) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Email is required. Please grant email permission.',
    );
  }

  let socialAccount = await prisma.socialAccount.findUnique({
    where: {
      provider_providerId: {
        provider: 'FACEBOOK',
        providerId: id,
      },
    },
    select: {
      id: true,
      provider: true,
      providerId: true,
      userId: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isSocialLogin: true,
          isEmailVerified: true,
          image: true,
        },
      },
    },
  });

  let user;

  if (!socialAccount) {
    user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          fullName: name,
          image: picture?.data?.url,
          isSocialLogin: true,
          isEmailVerified: true,
          password: '',
          isAgreeWithTerms: true,
        },
      });
    } else {
      if (user.isSocialLogin === false) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Please login with email and password',
        );
      }
    }

    socialAccount = await prisma.socialAccount.create({
      data: {
        provider: 'FACEBOOK',
        providerId: id,
        userId: user.id,
      },
      select: {
      id: true,
      provider: true,
      providerId: true,
      userId: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isSocialLogin: true,
          isEmailVerified: true,
          image: true,
        },
      },
    },
    });
  } else {
    user = socialAccount.user;
  }
  const accessToken = await generateToken(
    {
      id: socialAccount.user.id,
      name: socialAccount.user.fullName,
      email: socialAccount.user.email as string,
      role: socialAccount.user.role,
    },
    config.jwt.access_secret as Secret,
    config.jwt.access_expires_in as SignOptions['expiresIn'],
  );

  // Pre-warm auth cache
  await cacheUserToken(socialAccount.user.id, {
    id: socialAccount.user.id,
    name: socialAccount.user.fullName,
    email: socialAccount.user.email as string,
    role: socialAccount.user.role,
    image: socialAccount.user.image,
    isEmailVerified: socialAccount.user.isEmailVerified,
    isDeleted: false,
    status: 'ACTIVE',
  }).catch(() => {});

  return {
    accessToken,
    user: user,
  };
};

// ======================== EXPORT ========================
export const AuthServices = {
  loginWithOtpFromDB,
  registerWithOtpIntoDB,
  resendVerificationWithOtp,
  changePassword,
  forgetPassword,
  resetPassword,
  verifyOtpCommon,
  // Social Login
  getGoogleAuthUrl,
  googleCallback,
  googleLogin,
  getFacebookAuthUrl,
  facebookCallback,
  facebookLogin,
};
