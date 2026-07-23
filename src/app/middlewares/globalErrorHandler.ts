import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from '@prisma/client/runtime/library';
import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import AppError from '../errors/AppError';
import handleZodError from '../errors/handleZodError';
import { trackError, exportError } from '../utils/errorTracker';
import { logger } from '../utils/logger';

const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = 500;
  let message = err.message || 'Something went wrong!';
  let errorDetails: Record<string, any> = {};
  const correlationId = (req as any).correlationId;

  if (err instanceof ZodError) {
    const simplifiedError = handleZodError(err);
    statusCode = simplifiedError?.statusCode || 400;
    message = simplifiedError?.message || 'Validation error';
    errorDetails = simplifiedError?.errorDetails || {};
  } else if (err?.code === 'P2002') {
    statusCode = 409;
    message = `Duplicate entity on the fields: ${err.meta?.target?.split('_')[1]}`;
    errorDetails = { code: err.code, target: err.meta?.target };
  } else if (err?.code === 'P2003') {
    statusCode = 400;
    message = `Foreign key constraint failed on the field: ${err.meta?.field_name}`;
    errorDetails = { code: err.code, field: err.meta?.field_name, model: err.meta?.modelName };
  } else if (err?.code === 'P2011') {
    statusCode = 400;
    message = `Null constraint violation on the field: ${err.meta?.field_name}`;
    errorDetails = { code: err.code, field: err.meta?.field_name };
  } else if (err?.code === 'P2025') {
    statusCode = 404;
    message = `Record not found: ${err.meta?.cause || 'No matching record found for the given criteria.'}`;
    errorDetails = { code: err.code, cause: err.meta?.cause };
  } else if (err instanceof PrismaClientValidationError) {
    statusCode = 400;
    message = 'Validation error in Prisma operation';
    errorDetails = { message: err.message };
  } else if (err instanceof PrismaClientKnownRequestError) {
    statusCode = 400;
    message = err.message;
    errorDetails = { code: err.code, meta: err.meta };
  } else if (err instanceof PrismaClientUnknownRequestError) {
    statusCode = 500;
    message = err.message;
    errorDetails = err;
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorDetails = { stack: err.stack };
  } else if (err instanceof Error) {
    if (err.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Expired token';
    }
    errorDetails = { stack: err.stack };
  }

  // Structured error logging
  logger.error(`${req.method} ${req.originalUrl} ${statusCode}`, {
    module: 'error-handler',
    correlationId,
    userId: (req as any).user?.id,
    statusCode,
    errorName: err?.name,
    errorMessage: message,
  });

  // Track error in ring buffer + Redis (for critical errors)
  const errorReport = trackError(err, req, statusCode, errorDetails);

  // Export to external services (Sentry, etc.) — async, non-blocking
  exportError(errorReport).catch(() => {});

  // Hide internal error details from client in production
  const isProd = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    message,
    ...(isProd ? {} : { errorDetails }),
    ...(correlationId ? { correlationId } : {}),
  });
};

export default globalErrorHandler;
