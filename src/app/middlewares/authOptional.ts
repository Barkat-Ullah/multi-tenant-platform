import { NextFunction, Request, Response } from 'express';
import { Secret } from 'jsonwebtoken';
import config from '../../config';
import { verifyToken } from '../utils/verifyToken';
import { UserStatus } from '@prisma/client';
import { insecurePrisma } from '../utils/prisma';

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

      const user = await insecurePrisma.user.findUnique({
        where: { id: verifyUserToken.id },
      });

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