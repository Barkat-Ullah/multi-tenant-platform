import { UserRoleEnum } from '@prisma/client';
import jwt from 'jsonwebtoken';
import config from '../../../config';

export type GoogleState = { role: UserRoleEnum; nonce: string };

export const ALLOWED_GOOGLE_ROLES: UserRoleEnum[] = ['USER'];

export const signState = (payload: GoogleState) =>
  jwt.sign(payload, config.jwt.access_secret as string, { expiresIn: '10m' });

export const verifyState = (state: string): GoogleState =>
  jwt.verify(state, config.jwt.access_secret as string) as GoogleState;
