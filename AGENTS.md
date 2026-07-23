# Repository Guidelines

## Project Structure & Module Organization

TypeScript Express API using Prisma (MongoDB) and Zod validation. Entry points: `src/server.ts` (startup, graceful shutdown) and `src/app.ts` (Express app, middleware, routes).

Feature code lives in `src/app/modules/<feature>/` — each module typically has: `<feature>.service.ts`, `<feature>.controller.ts`, `<feature>.route.ts`, `<feature>.validation.ts`, `<feature>.select.ts`, `<feature>.utils.ts`.

Shared infrastructure: `src/app/middlewares/`, `src/app/utils/`, `src/app/errors/`, `src/app/routes/index.ts` (route registry), `src/config/index.ts`, `src/shared/index.ts` (middleware setup, rate limiters).

Redis/cache layer: `src/lib/redis.ts` (core cache framework), `src/lib/authRedis.ts` (auth-specific Redis ops), `src/lib/redisConnection.ts` (re-export bridge).

Prisma schema: `prisma/schema.prisma` imports domain fragments from `prisma/*.prisma`. Do not edit generated `dist/` output.

## Build, Test, and Development Commands

- `npm install` — installs dependencies (triggers `prisma generate` via postinstall)
- `npm run dev` — starts API via `ts-node-dev --respawn --transpile-only`
- `npm run build` — `tsc && prisma generate`
- `npm start` — runs compiled server at `dist/server.js`
- `npm run pm` — `prisma migrate dev` (name migrations meaningfully)
- `npm run pg` — `prisma generate` (regenerate client after schema changes)
- `npm run lint:check` — ESLint check (JS/TS)
- `npm run lint:fix` — ESLint auto-fix
- `npm run prettier:fix` — Prettier format
- No test framework configured (`npm test` intentionally fails). Run `npm run build && npm run lint:check` before changes, then exercise endpoints manually.

## Coding Style & Naming Conventions

TypeScript, 2-space indent, semicolons, single quotes, arrow functions without unnecessary parens (enforced by Prettier). ESLint enforces `prefer-const`, `no-unused-vars`, `no-unused-expressions`, and `@typescript-eslint/consistent-type-definitions: "error"` (use `type`, not `interface`).

Feature-oriented file naming: `ticket.service.ts`, `booking.controller.ts`, `location.route.ts`. camelCase for variables/functions, PascalCase for types/classes.

## Redis Cache Framework

The project has a sophisticated version-based caching framework in `src/lib/redis.ts`. **This is the primary caching mechanism — use it.**

### Key APIs

```typescript
// Read-through cache with stampede/avalanche/penetration protection
import { cacheOr, CacheKeys, TTL, CacheInvalidator } from '../lib/redis';

// Single record cache
const key = await CacheKeys.single('booking', bookingId);
const data = await cacheOr(key, TTL.MEDIUM, () => prisma.booking.findUnique(...));

// Paginated list cache
const key = await CacheKeys.list('booking', { page, limit, status });
const data = await cacheOr(key, TTL.SHORT, () => prisma.booking.findMany(...));

// User-scoped list cache
const key = await CacheKeys.myList('booking', userId, { page, limit });
const data = await cacheOr(key, TTL.SHORT, () => prisma.booking.findMany(...));

// Invalidation (version-based, no SCAN/KEYS needed)
await CacheInvalidator.onRecordUpdate('booking', id);   // single + all lists
await CacheInvalidator.onRecordCreate('booking');        // lists only
await CacheInvalidator.onRecordDelete('booking', id);    // single + lists + owner's lists
await CacheInvalidator.onRelatedChange('booking');        // lists only
await CacheInvalidator.onRelatedChangeFull('booking');    // single + lists
await CacheInvalidator.many('booking', 'payment');        // full wipe multiple models
```

### TTL Constants (seconds)

| Constant | Value | Use For |
|----------|-------|---------|
| `TTL.SHORT` | 10 min | Paginated/filtered lists |
| `TTL.MEDIUM` | 30 min | Single record by ID |
| `TTL.LONG` | 6 hours | Rarely-changing data |
| `TTL.DAY` | 24 hours | Static/config data |
| `TTL.SESSION` | 1 hour | Session-scoped data |
| `TTL.TOKEN` | 24 hours | JWT blacklist |

### Auth-Specific Redis (`src/lib/authRedis.ts`)

Separate from the version-based framework. Used by auth middleware and auth service:

```typescript
import { setOtp, getOtp, deleteOtp, cacheUserToken, getCachedUser, invalidateUserCache } from '../lib/authRedis';
```

- OTP: 5-min TTL, pending registration: 30-min TTL, token cache: 1-hour TTL

### Cache Coverage Status

**Implemented:** Auth middleware (both `auth.ts` and `authOptional.ts`), User module (invalidation on role/status/delete/profile updates), Booking helper (admin email list cached 6h).

**NOT yet implemented:** Booking, Ticket, Payment, Service, Location, MedicalRecord, OrganizerRequest, TimeSlot, Notification, Analytics services. The `cacheOr` framework is ready — these modules need `cacheOr` wrapping on read queries and `CacheInvalidator` calls on writes.

### Important: `cacheOr` Return Type

`cacheOr<T>()` returns `T | null`. The fetcher must return the data directly. If the fetcher returns `null`/`undefined`, a negative cache placeholder is stored for 2 minutes (penetration protection). Always handle the `null` return.

## Key Architectural Patterns

### Single Prisma Instance

`src/app/utils/prisma.ts` exports a single `PrismaClient`. All queries that need sensitive fields (password, OTP) must use explicit `select` — no `omit` at the client level.

### BullMQ Queues

`src/app/helpers/queue/index.ts` exports `mailQueue` and `otpQueue`. All email sending is offloaded to BullMQ (non-blocking). The `otpQueue` exists but is unused — prefer `mailQueue` for new email work.

**BullMQ Redis requires:** `maxRetriesPerRequest: null` and `enableReadyCheck: false` (configured in `bullMQRedisOptions` in `src/lib/redis.ts`).

### Email Sending

```typescript
import { mailQueue } from '../../helpers/queue';
mailQueue.add('send-email', { type, to, html, subject })
  .catch(err => console.error('Mail queue failed:', err));
```

Never `await` email sends directly — always queue via BullMQ.

### Fire-and-Forget Pattern

For non-critical DB writes (notifications, audit logs), use `.catch(err => console.error(...))` to avoid blocking the response.

### Rate Limiters

Applied in `src/app.ts`:
- `apiLimiter`: 2000 req/15min per IP (all `/api/v1` routes)
- `authLimiter`: 20 req/15min per IP (login, register, verify, resend, forget-password, reset-password)
- `uploadLimiter`: 50 req/15min per IP (file upload)

### HTTP Cache-Control

`src/app/middlewares/cacheControl.ts` provides middleware for browser/CDN caching. Profiles: `static` (1hr), `reference` (10min), `analytics` (2min), `userPrivate` (1min, private).

### Response Compression

Gzip enabled via `compression` middleware in `src/shared/index.ts`, threshold 1KB.

### Structured Logging

`src/app/utils/logger.ts` provides JSON-structured logging:

```typescript
import { logger } from '../utils/logger';

logger.info('Booking created', { module: 'booking', userId, action: 'create' });
logger.cache.hit(cacheKey, 'booking');
logger.cache.invalidate('booking', id, 'booking');
```

Debug-level logs only appear in development (`NODE_ENV !== 'production'`).

### Error Tracking

`src/app/utils/errorTracker.ts` captures errors in a ring buffer (last 500) with request context:

```typescript
import { trackError, getRecentErrors, getErrorStats } from '../utils/errorTracker';

// Automatically called by globalErrorHandler — manual use for non-thrown errors:
trackError(err, req, statusCode, { extra: 'context' });

getRecentErrors(50);       // last 50 errors, newest first
getErrorStats();           // { low: 0, medium: 2, high: 1, critical: 0 }
```

Critical errors (500s) are persisted to Redis (7-day retention). External exporters can be registered via `registerErrorExporter()`.

### Middleware Pipeline (order matters)

Applied in `src/shared/index.ts` — `setupMiddlewares()`:

1. **Request Context** — correlation IDs, timing (`X-Correlation-Id` header)
2. **Response Logger** — request/response audit trail with duration
3. **Input Sanitizer** — XSS & injection protection on body/query/params
4. **Compression** — gzip (1KB threshold)
5. **CORS** — configured origins
6. **Body Parsers** — JSON + URL-encoded (500KB limit)

### Health Endpoint

`GET /health` returns DB + Redis status, cache hit/miss metrics, and error stats. Returns 503 when degraded.

## Testing Guidelines

No automated test framework. Before changes: `npm run build && npm run lint:check`, then exercise affected endpoints locally. When tests are added, place them beside the relevant module (e.g., `ticket.service.test.ts`).

## Commit & Pull Request Guidelines

Concise imperative summaries with `feat :` and `fix :` prefixes (e.g., `feat : add ticket status updates`). Keep commits focused.

PRs should state: purpose, affected modules/routes, database or env-var changes, validation performed. Call out required Prisma migrations explicitly.

## Security & Configuration

Copy `.env.example` to `.env`. Never commit secrets. The `.env.example` contains placeholder values — replace with real credentials locally. Redis config: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`.

Review validation and authorization middleware whenever adding or changing a route. Zod validation schemas exist in `<feature>.validation.ts` files.

## Deployment

- Vercel config: `vercel.json` (routes all to `src/server.ts`)
- Docker: `Dockerfile` + `.dockerignore` present
- Graceful shutdown: `server.ts` calls `disconnectRedis()` before `server.close()`
- Health check: `GET /health`
