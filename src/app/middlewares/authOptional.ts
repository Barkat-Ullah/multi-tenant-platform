import { NextFunction, Request, Response } from 'express';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import { verifyToken } from '../utils/verifyToken';
import { UserStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { getCachedUser } from '../../lib/authRedis';
import { isTokenBlacklisted } from '../../lib/redis';

// optional auth — attaches req.user if a valid token is present,
// but never throws if token is missing or invalid
const authOptional = () => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = req.headers.authorization;

      if (!token) {
        return next();
      }

      const verifyUserToken = verifyToken(
        token,
        config.jwt.access_secret as Secret,
      );

      // If token is blacklisted (logged out), treat as guest
      const blacklisted = await isTokenBlacklisted(token).catch(() => false);
      if (blacklisted) {
        return next();
      }

      // 💡 OPTIMIZATION: Use cached user data from Redis when available
      let user = await getCachedUser(verifyUserToken.id);

      if (!user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: verifyUserToken.id },
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
            image: true,
            isEmailVerified: true,
            isDeleted: true,
            status: true,
          },
        });
        // Map Prisma's fullName to CachedUser's name
        if (dbUser) {
          user = {
            id: dbUser.id,
            name: dbUser.fullName,
            email: dbUser.email,
            role: dbUser.role,
            image: dbUser.image,
            isEmailVerified: dbUser.isEmailVerified,
            isDeleted: dbUser.isDeleted,
            status: dbUser.status,
          };
        }
      }

      // silently skip if user invalid/deleted/suspended/unverified
      if (
        !user ||
        user.isDeleted ||
        !user.isEmailVerified ||
        user.status === UserStatus.SUSPENDED
      ) {
        return next();
      }

      if (user.image) {
        verifyUserToken.image = user.image;
      }

      req.user = verifyUserToken;
      next();
    } catch (error) {
      // invalid/expired token — proceed as guest, don't block request
      next();
    }
  };
};

export default authOptional;
