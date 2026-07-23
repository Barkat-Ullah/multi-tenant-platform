import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Response Logger Middleware
//
// Logs every completed request with:
//   - Method, URL, status code
//   - Response time (ms)
//   - Correlation ID (for distributed tracing)
//   - User ID (if authenticated)
//
// Skips:
//   - Health checks (too noisy)
//   - Static asset requests
// ─────────────────────────────────────────────────────────────────────────────

const SKIP_PATHS = ['/health', '/favicon.ico'];

const responseLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Skip noisy endpoints
  if (SKIP_PATHS.includes(req.path)) {
    return next();
  }

  const startTime = (req as any).startTime || Date.now();

  // Hook into response finish event (fires after response is sent)
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const correlationId = (req as any).correlationId;
    const user = (req as any).user;
    const statusCode = res.statusCode;

    const logData = {
      module: 'http',
      correlationId,
      userId: user?.id,
      method: req.method,
      url: req.originalUrl,
      status: statusCode,
      duration: `${duration}ms`,
      ip: req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim(),
    };

    if (statusCode >= 500) {
      logger.error(`${req.method} ${req.originalUrl} ${statusCode} ${duration}ms`, logData);
    } else if (statusCode >= 400) {
      logger.warn(`${req.method} ${req.originalUrl} ${statusCode} ${duration}ms`, logData);
    } else {
      logger.info(`${req.method} ${req.originalUrl} ${statusCode} ${duration}ms`, logData);
    }
  });

  next();
};

export default responseLogger;
