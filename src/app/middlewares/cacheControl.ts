import { Request, Response, NextFunction } from 'express';

type CacheOptions = {
  maxAge: number;       // seconds
  staleWhileRevalidate?: number; // seconds
  isPrivate?: boolean;
};

/**
 * Sets HTTP Cache-Control headers on the response.
 * Use on read-heavy endpoints to leverage browser/CDN caching.
 *
 * Usage:
 *   router.get('/faq', cacheControl({ maxAge: 3600 }), faqHandler)
 */
export const cacheControl = (options: CacheOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { maxAge, staleWhileRevalidate = 60, isPrivate = false } = options;

    const directives: string[] = [];

    if (isPrivate) {
      directives.push('private');
    } else {
      directives.push('public');
    }

    directives.push(`max-age=${maxAge}`);

    if (staleWhileRevalidate > 0) {
      directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }

    res.setHeader('Cache-Control', directives.join(', '));
    next();
  };
};

/**
 * No-cache middleware — for endpoints that must always hit the server.
 */
export const noCache = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
};

// Pre-configured cache profiles
export const cacheProfiles = {
  // Static content (FAQ, terms, privacy) — cache 1 hour
  static: { maxAge: 3600, staleWhileRevalidate: 300 },
  // Reference data (services, locations) — cache 10 minutes
  reference: { maxAge: 600, staleWhileRevalidate: 120 },
  // Analytics — cache 2 minutes
  analytics: { maxAge: 120, staleWhileRevalidate: 60 },
  // User-specific lists — private, cache 1 minute
  userPrivate: { maxAge: 60, staleWhileRevalidate: 30, isPrivate: true },
};
