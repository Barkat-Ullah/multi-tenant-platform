import express, { Application, NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import compression from 'compression';
import catchAsync from '../app/utils/catchAsync';
import AppError from '../app/errors/AppError';

import { prisma } from '../app/utils/prisma';
import { fileUploader } from '../app/utils/fileUploader';
import ApiError from '../app/errors/AppError';
import { isRedisHealthy, redis } from '../lib/redis';
import requestContext from '../app/middlewares/requestContext';
import responseLogger from '../app/middlewares/responseLogger';
import sanitize from '../app/middlewares/sanitize';
import { getErrorStats } from '../app/utils/errorTracker';

export const setupMiddlewares = (app: Application): void => {

  // 1. Request context — correlation IDs, timing
  app.use(requestContext);

  // 2. Response logging — request/response audit trail
  app.use(responseLogger);

  // 3. Input sanitization — XSS & injection protection
  app.use(sanitize);

  // 4. gzip compression — reduces payload size by 60-80%
  app.use(compression({
    filter: (req, res) => {
      if (req.query['no-compression']) return false;
      return compression.filter(req, res);
    },
    threshold: 1024,
  }));

  // CORS
  app.use(
    cors({
      origin: ['http://localhost:3001', 'http://localhost:3000', 'https://compliancemed-frontend.vercel.app','https://multi-tenant-platform-five.vercel.app','https://platform.multiple.barkatullah.dev'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'X-Requested-With',
        'Origin',
        'Cache-Control',
        'X-CSRF-Token',
        'User-Agent',
        'Content-Length',
      ],
      credentials: true,
    }),
  );

  // Body parsers
  app.use(express.json({ limit: '500kb' }));
  app.use(cookieParser());
  app.use(express.urlencoded({ limit: '500kb', extended: true }));
};

// ─── Rate Limiters ──────────────────────────────────────────────────────────

const getClientIp = (req: any): string => {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ipArray = forwardedFor ? forwardedFor.split(/\s*,\s*/) : [];
  return ipArray.length > 0 ? ipArray[0] : req.connection.remoteAddress;
};

// Default API limiter — 2000 requests per 15 minutes per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  keyGenerator: getClientIp,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth endpoints — 20 requests per 15 minutes per IP
// Prevents brute-force attacks on login/register/OTP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: getClientIp,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload limiter — 50 requests per 15 minutes per IP
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  keyGenerator: getClientIp,
  message: {
    success: false,
    message: 'Too many upload requests, please try again after 15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply limiter to main routes (in app/index.ts)
console.log('✅ Middlewares setup complete');

export const notFound = (req: Request, res: Response, next: NextFunction) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'API NOT FOUND! please check on router',
    error: {
      path: req.originalUrl,
      message: 'Your requested path is not found!',
    },
  });
};

//only image upload
export const documentUpload = catchAsync(
  async (req: Request, res: Response) => {
    const files = req.files as
      | {
          [fieldname: string]: Express.Multer.File[];
        }
      | undefined;
    // console.log(files);

    let uploadedFiles: {
      image?: string;
      video?: string;
      pdf?: string;
      files?: string;
      fileName?: string;
      fileType?: string;
    } = {};

    try {
      // Image
      if (files?.image?.[0]) {
        const upload = await fileUploader.uploadToCloudinaryWithType(
          files.image[0],
          'image',
        );
        // const upload = await fileUploader.uploadToDigitalOceanWithType(
        //   files.image[0],
        //   'image',
        // );

        uploadedFiles.fileName = files.image[0].originalname;
        uploadedFiles.fileType = files.image[0].mimetype;
        uploadedFiles.image = upload.Location;
      }

      // Video Upload
      if (files?.video?.[0]) {
        const upload = await fileUploader.uploadToCloudinaryWithType(
          files.video[0],
          'video',
        );
        // const upload = await fileUploader.uploadToDigitalOceanWithType(
        //   files.video[0],
        //   'video',
        // );

        uploadedFiles.fileName = files.video[0].originalname;
        uploadedFiles.fileType = files.video[0].mimetype;
        uploadedFiles.video = upload.Location;
      }

      // PDF Upload
      if (files?.pdf?.[0]) {
        const upload = await fileUploader.uploadToCloudinaryWithType(
          files.pdf[0],
          'pdf',
        );
        // const upload = await fileUploader.uploadToDigitalOceanWithType(
        //   files.pdf[0],
        //   'pdf',
        // );

        uploadedFiles.fileName = files.pdf[0].originalname;
        uploadedFiles.fileType = files.pdf[0].mimetype;
        uploadedFiles.pdf = upload.Location;
      }

      if (files?.files?.[0]) {
        const file = files.files[0];
        const ext = file.originalname.split('.').pop()?.toLowerCase();

        let fileType: 'image' | 'video' | 'pdf' = 'pdf';
        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
          fileType = 'image';
        } else if (['mp4', 'mov', 'avi', 'webm'].includes(ext || '')) {
          fileType = 'video';
        }

        const upload = await fileUploader.uploadToCloudinaryWithType(
          file,
          fileType,
        );
        // const upload = await fileUploader.uploadToDigitalOceanWithType(
        //   file,
        //   fileType,
        // );

        uploadedFiles.fileName = file.originalname;
        uploadedFiles.fileType = file.mimetype;
        uploadedFiles.files = upload.Location;
      }
    } catch (error: any) {
      console.error('Cloudinary upload error:', error);
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Failed to upload file',
        error,
      );
    }

    res.status(httpStatus.OK).json({ success: true, uploadedFiles });
  },
);

export const serverHealth = catchAsync(async (req: Request, res: Response) => {
  const [dbOk, redisOk] = await Promise.all([
    prisma.$connect().then(() => true).catch(() => false),
    isRedisHealthy(),
  ]);

  // Cache metrics from Redis INFO
  let cacheMetrics = null;
  if (redisOk) {
    try {
      const info = await redis.info('stats');
      const hits = parseInt(info.match(/keyspace_hits:(\d+)/)?.[1] ?? '0', 10);
      const misses = parseInt(info.match(/keyspace_misses:(\d+)/)?.[1] ?? '0', 10);
      const total = hits + misses;
      cacheMetrics = {
        hits,
        misses,
        hitRate: total > 0 ? `${((hits / total) * 100).toFixed(1)}%` : 'N/A',
      };
    } catch {
      cacheMetrics = null;
    }
  }

  const statusCode = dbOk && redisOk ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE;

  // Error stats from ring buffer
  const errorStats = getErrorStats();

  res.status(statusCode).json({
    success: dbOk && redisOk,
    message: dbOk && redisOk ? '🟢 Server healthy' : '🟡 Degraded — some services unavailable',
    timestamp: new Date().toISOString(),
    services: {
      database: dbOk ? 'Connected' : 'Disconnected',
      redis: redisOk ? 'Connected' : 'Disconnected',
    },
    cache: cacheMetrics,
    errors: errorStats,
  });
});
