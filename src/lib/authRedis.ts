import redis from './redis';

// ─────────────────────────────────────────────────────────────────────────────
// Auth-specific Redis Operations
// ─────────────────────────────────────────────────────────────────────────────

// ─── TTL Constants ───────────────────────────────────────────────────────────
const OTP_TTL = 60 * 5; // 5 minutes (matches current OTP expiry)
const PENDING_REGISTRATION_TTL = 60 * 30; // 30 minutes
const TOKEN_CACHE_TTL = 60 * 60; // 1 hour

// ─── Key Builders ────────────────────────────────────────────────────────────
const otpKey = (email: string) => `auth:otp:${email.toLowerCase()}`;
const pendingRegKey = (email: string) =>
  `auth:pending:reg:${email.toLowerCase()}`;
const tokenCacheKey = (userId: string) => `auth:token:cache:${userId}`;

// ─────────────────────────────────────────────────────────────────────────────
// OTP Operations
// ─────────────────────────────────────────────────────────────────────────────

export const setOtp = async (
  email: string,
  otp: string,
): Promise<void> => {
  await redis.set(otpKey(email), otp, 'EX', OTP_TTL);
};

export const getOtp = async (email: string): Promise<string | null> => {
  return redis.get(otpKey(email));
};

export const deleteOtp = async (email: string): Promise<void> => {
  await redis.del(otpKey(email));
};

// ─────────────────────────────────────────────────────────────────────────────
// Pending Registration Operations
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingRegistration {
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  password: string; // already hashed
  role: string;
  companyLocation?: string | null;
  dob?: string | null;
  createdAt: number; // timestamp
}

export const setPendingRegistration = async (
  email: string,
  data: PendingRegistration,
): Promise<void> => {
  await redis.set(
    pendingRegKey(email),
    JSON.stringify(data),
    'EX',
    PENDING_REGISTRATION_TTL,
  );
};

export const getPendingRegistration = async (
  email: string,
): Promise<PendingRegistration | null> => {
  const raw = await redis.get(pendingRegKey(email));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingRegistration;
  } catch {
    return null;
  }
};

export const deletePendingRegistration = async (
  email: string,
): Promise<void> => {
  await redis.del(pendingRegKey(email));
};

// ─────────────────────────────────────────────────────────────────────────────
// Token Cache Operations (for auth middleware)
// ─────────────────────────────────────────────────────────────────────────────

export interface CachedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  image?: string | null;
  isEmailVerified: boolean;
  isDeleted: boolean;
  status: string;
}

export const cacheUserToken = async (
  userId: string,
  userData: CachedUser,
): Promise<void> => {
  await redis.set(
    tokenCacheKey(userId),
    JSON.stringify(userData),
    'EX',
    TOKEN_CACHE_TTL,
  );
};

export const getCachedUser = async (
  userId: string,
): Promise<CachedUser | null> => {
  const raw = await redis.get(tokenCacheKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedUser;
  } catch {
    return null;
  }
};

export const invalidateUserCache = async (
  userId: string,
): Promise<void> => {
  await redis.del(tokenCacheKey(userId));
};

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Invalidation (for admin operations affecting many users)
// ─────────────────────────────────────────────────────────────────────────────

export const invalidateMultipleUserCaches = async (
  userIds: string[],
): Promise<void> => {
  if (!userIds.length) return;
  const keys = userIds.map(id => tokenCacheKey(id));
  await redis.del(...keys);
};