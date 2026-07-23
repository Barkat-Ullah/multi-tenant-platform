import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Request Context Middleware
//
// Adds:
//   - correlationId: unique ID for request tracing across logs/services
//   - startTime: request timing (used by response logger)
//   - req.id: shorthand for correlation ID
// ─────────────────────────────────────────────────────────────────────────────

const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  (req as any).correlationId = correlationId;
  (req as any).startTime = Date.now();
  (req as any).id = correlationId;

  // Expose correlation ID in response headers for client-side tracing
  res.setHeader('X-Correlation-Id', correlationId);

  next();
};

export default requestContext;
