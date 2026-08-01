# 🔍 Performance Audit Report — Multi-Tenant Medical Compliance Platform

**Date:** August 1, 2026  
**Auditor:** Principal Software Architect & Performance Engineer  
**Scope:** Full stack — database, application, caching, queues, API, infrastructure  
**Audit Method:** Static code analysis of all modules, services, schema, and infrastructure config

---

## Executive Summary

The codebase is architecturally sound with a well-structured Express + Prisma (MongoDB) + Redis + BullMQ stack. Good efforts have already been made: read-through caching with stampede protection, version-based cache invalidation, background email queues, and selective field projection. However, several **critical performance bottlenecks** remain that will severely degrade performance as data volume grows:

| Priority | Area | Impact | Effort |
|----------|------|--------|--------|
| **CRITICAL** | Nodemailer transporter recreated on every email send | Extremely high | Low |
| **CRITICAL** | Workers initialized in both app & worker containers | High | Low |
| **HIGH** | MongoDB full-collection scans for text search (`contains` + `insensitive`) | High | Medium |
| **HIGH** | Entire-year data loaded into memory for analytics trends | High | Medium |
| **HIGH** | Sequential queries where parallelization is possible | Medium-High | Low |
| **HIGH** | Missing compound indexes on high-traffic queries | Medium-High | Medium |
| **HIGH** | TimeSlot creation via N+1 individual creates | High | Low |
| **MEDIUM** | Redis 150MB memory cap with 24h TTL auth cache | Medium | Low |
| **MEDIUM** | OTP queue worker dead code path | Medium | Low |
| **MEDIUM** | Inefficient sanitize middleware (regex on every request) | Medium | Medium |
| **MEDIUM** | Unbounded chat history loading | Medium | Low |
| **MEDIUM** | Double queue-cleaner interval registration | Low | Low |
| **LOW** | SSE heartbeat logging every 20s | Low | Low |
| **LOW** | Dead code & commented-out blocks | Low | Low |

---

## 1. 🔴 Database Bottlenecks

### 1.1 MongoDB Full-Collection Scans for Text Search
**Files:** `booking.service.ts`, `user.service.ts`, `ticket.service.ts`, `organizerRequest.service.ts`, `medicalRecord.service.ts`, `QueryBuilder.ts`

**Problem:** MongoDB has no native `contains + mode: 'insensitive'` operator in Prisma — these translate to `$regex` queries that **cannot use indexes** and cause full collection scans on every search.

```typescript
// This is in almost every service:
{ fullName: { contains: searchTerm, mode: 'insensitive' } }
// Translates to: { fullName: { $regex: searchTerm, $options: 'i' } }
// → Full collection scan, no index usage
```

**Impact:** As user/booking/ticket collections grow, every search request becomes O(n) over the entire collection. At 10K+ documents, search latency will degrade from ~5ms to 200-1000ms+.

**Root Cause:** Prisma's `mode: 'insensitive'` is a PostgreSQL feature that works with indexes. MongoDB's `$regex` with `$options: 'i'` bypasses standard indexes unless a **text index** (with `$text` operator) is defined.

**Recommended Fix:**
- Create MongoDB **text indexes** on searchable fields (`fullName`, `email`, `title`, etc.)
- Use `$text` queries (`search: { text: { query: searchTerm } }` in Prisma) where appropriate
- For partial-string search, use prefix-optimized regex (`^searchTerm`) with **normalized lowercase field** indexed
- Add a `normalizedEmail` lowercased field + unique index

**Risk:** Schema migration needed; behavior change for partial substring matching
**Expected Gain:** 50-200x improvement on search queries at scale

---

### 1.2 Entire-Year Data Loaded Into Memory for Analytics
**Files:** `analytics.service.ts` (lines 53-90, 365-383)

**Problem:** Both `getYearlyTrend()` and `getOrganizerAnalytics()` fetch **every** booking/payment from the entire year to compute month-by-month counts.

```typescript
const [bookingMonths, paymentData] = await Promise.all([
  prisma.booking.findMany({
    where: { createdAt: { gte: yearStart } },
    select: { createdAt: true },  // Still pulls every record of the year!
  }),
  prisma.payment.findMany({
    where: { status: PaymentStatus.SUCCESS, createdAt: { gte: yearStart } },
    select: { createdAt: true, amount: true },  // Every payment!
  }),
]);
```

**Impact:** At 50K bookings/year this returns 50K documents just to count 12 months. Server memory spikes, GC pressure, slow response times.

**Root Cause:** Missing MongoDB aggregation framework usage.

**Recommended Fix:** Use `groupBy` with date-based grouping:
```typescript
// Using Prisma groupBy (aggregates in DB, not in memory)
const result = await prisma.booking.groupBy({
  by: ['createdAt'],  // Grouped by month in MongoDB aggregation
  where: { createdAt: { gte: yearStart } },
  _count: { _all: true },
});
```
Or use raw MongoDB `$group` aggregation for month extraction. In MongoDB, Prisma's `groupBy` with date objects will need custom raw queries using `$dateToString`.

**Risk:** Medium — custom raw queries needed for MongoDB
**Expected Gain:** ~95% memory reduction on analytics endpoints

---

### 1.3 Missing Compound Indexes
**Files:** All Prisma schema files

**Problem:** Critical compound indexes are missing for common query patterns:

| Missing Index | Query Pattern | Impact |
|---------------|--------------|--------|
| `Booking[driverId, scheduledAt]` | Driver dashboard "my upcoming appointments" | Collection scan per driver |
| `Booking[clinicId, scheduledAt]` | Clinic calendar views | Collection scan per clinic |
| `Booking[status, createdAt]` | Admin status-filtered lists | Collection scan |
| `User[role, isDeleted]` | User list by role | Collection scan |
| `Notification[receiverId, createdAt]` | Notification pages | Already exists ✓ |
| `Payment[bookingId, status]` | Payment status checks | Partial coverage |
| `Chat[roomId, createdAt]` | Chat history | Already exists ✓ |
| `TimeSlot[clinicId, date, status]` | Slot availability lookups | Partial coverage |

**Impact:** Every uncached filter runs a full or partial collection scan.

---

### 1.4 N+1 Query Pattern — TimeSlot Bulk Creation
**File:** `timeSlot.service.ts` (lines 139-157)

**Problem:** `createAvailabilityWithSlots` uses `Promise.all` with individual `create` calls for each slot:

```typescript
const createdSlots = await Promise.all(
  slots.map(slot =>
    prisma.timeSlot.create({ data: { ... } }),  // One insert per slot!
  ),
);
```

**Impact:** A clinic with a 9AM-5PM day generates 16 slots → 16 individual inserts (acceptable at low volume, but 10 clinics creating availability simultaneously = 160 inserts + MongoDB round-trips). At scale this becomes a write bottleneck.

**Recommended Fix:** Use `createMany`:
```typescript
await prisma.timeSlot.createMany({
  data: slots.map(slot => ({ ... })),
});
```

**Risk:** Low
**Expected Gain:** ~16x fewer round-trips on availability creation

---

### 1.5 WebSocket Chat History — No Pagination
**File:** `middlewares/webSocket.ts` (lines 505-539, 584-640)

**Problem:** `fetchChats` loads the **entire** chat history for a room without pagination. `messageList` also queries all rooms and all last messages even for users with hundreds of conversations.

**Impact:** A user with 10K messages in a room gets all 10K records in a single WS response. Memory + network saturation, frozen UI.

**Recommended Fix:** Implement cursor-based or offset pagination on WebSocket `fetchChats`; limit `messageList` to top N recent room conversations.

---

### 1.6 Location Nearest — O(n) Application-Side Distance
**File:** `location.service.ts` (lines 312-388)

**Problem:** `councilNearestLocationServices` fetches **all** locations, then does Haversine distance computation in JavaScript for each one. As location count grows this is O(n) memory + CPU.

**Recommended Fix:** Use MongoDB `$geoNear` with `2dsphere` index on `{ lat, lng }`.
**Expected Gain:** O(log n) instead of O(n); eliminates loading all locations into memory.

---

### 1.7 Payment Search Fields Mismatch
**File:** `payment.service.ts` (line 68)

**Problem:** `paymentSearchAbleFields = ['fullName', 'email']` — these fields don't exist on the `Payment` model. Any search results in a Prisma error or empty results. This indicates the search was ported from a different model.

**Impact:** Broken feature + wasted query attempt on every payment list with search.

---

## 2. 🔴 Application Layer Bottlenecks

### 2.1 Nodemailer Transporter Created on Every Email
**File:** `utils/sendMail.ts` (lines 1557-1581)

**Problem:** Every single email send creates a **new SMTP transporter**:

```typescript
const emailSender = async (to: string, html: string, subject: string) => {
  const transporter = nodemailer.createTransport({  // ← Created EVERY call!
    host: 'smtp-relay.brevo.com',
    port: 2525,
    auth: { ... },
  });
  await transporter.sendMail(mailOptions);
};
```

**Impact:** Creating a transporter involves DNS lookup, SMTP handshake, auth. This is **10-50ms of TCP/SSL handshake + SMTP protocol setup per email**. Even with the BullMQ queue, the worker throughput is capped by this overhead. Sending 100 emails = 100 SMTP connections.

**Root Cause:** Nodemailer documentation explicitly states to reuse the transporter.

**Recommended Fix:**
```typescript
// At module level — create ONCE:
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 2525,
  secure: false,
  auth: { user: ..., pass: ... },
  pool: true,  // Connection pooling — reuse SMTP connections
  maxConnections: 5,
  maxMessages: 100,
});

const emailSender = async (to, html, subject) => {
  return transporter.sendMail(mailOptions);  // Cheap!
};
```

**Risk:** Very low
**Expected Gain:** **10-50x faster email processing**, significantly higher queue throughput

---

### 2.2 Workers Started in Both App AND Worker Containers
**Files:** `server.ts` (line 8), `helpers/worker/emailWorker.ts`, `docker-compose.yml`

**Problem:** `server.ts` unconditionally imports and starts `emailWorker`. The docker-compose config has `IS_WORKER: 'false'` for the app container but **nothing checks this flag**. Both the app and worker containers run workers — causing:
- Duplicate email delivery (2x emails)
- Redundant processor slots
- Wasted memory in the app container

```typescript
// server.ts — line 8: unconditional import
import './app/helpers/worker/emailWorker';
```

**Recommended Fix:**
```typescript
if (process.env.IS_WORKER === 'true') {
  import('./app/helpers/worker/emailWorker');
  import('./app/helpers/worker/otpWorker');
}
```
Or move worker startup to a separate entry file.

**Expected Gain:** Eliminates duplicate processing, halves worker resource consumption, prevents duplicate emails.

---

### 2.3 Sequential Queries Where Parallelization Possible
**File:** `booking.service.ts` (createBooking, lines 97-407)

**Problems identified:**
1. `getAdminAndSuperAdminEmails()` (line 119) runs **before** the `driver` and `clinic` queries — could be parallel
2. `prisma.user.findUnique` for `driver` (line 121) and `clinic` findFirst (line 130) — sequential
3. `clinicUser` query (line 308) runs **after** the transaction — could be inside the Promise.all with cache invalidation
4. `app.ts` payment success handler (lines 68-151) — `stripe.checkout.sessions.retrieve()` then payment findUnique — sequential await chain
5. `user.service.ts` `getUserDetailsFromDB` — role-specific data + count queries run **sequentially** within the role block (lines 268-279)

**Impact:** Each sequential query adds a round-trip latency of 2-10ms. Combined, these add 20-50ms of unnecessary latency.

**Recommended Fix:** Use `Promise.all` for independent queries.

---

### 2.4 Sanitize Middleware — Regex Overhead on Every Request
**File:** `middlewares/sanitize.ts`

**Problem:** For **every** request body, the middleware:
1. Runs `scanForDangerousPatterns` — 8 regex patterns traversing the entire object tree
2. Then `sanitizeValue` — HTML-tag stripping, character escaping, whitespace collapsing
3. Both operations traverse **every string in the body recursively**

**Impact:** For a large request body (e.g., medical record with long text), this adds 0.5-3ms of CPU-bound regex work **per request**.

**Recommended Fix:**
- Move to a lightweight allowlist-based validator
- Skip sanitization for known-safe request bodies (or only sanitize specific fields)
- Use a compiled single-pass sanitizer
- Cache sanitized results by body hash for repeated identical bodies

---

### 2.5 Hash Cost for Password
**Files:** `Auth.service.ts` (bcrypt 12 rounds), `db.ts` (bcrypt configurable)

**Problem:** Bcrypt with 12 rounds takes ~300-500ms per hash. Every login, registration, and password change incurs this cost.

**Recommended Fix:** Consider scrypt (Node.js native) with `crypto.scrypt` — faster and memory-hard. Or reduce to 10 rounds (still secure, ~100-200ms). At minimum, keep bcrypt but ensure the salt rounds are tuned.

---

## 3. 🟠 Caching Bottlenecks

### 3.1 Cache Key Building — Two Redis Round-Trips Per Key
**File:** `lib/redis.ts` (CacheKeys.list, myList)

**Problem:** Building a cache key requires `getVersion(model)` and `getVersion(list)` — **two Redis GETs per cache access**. Even though `getVersion` uses a 2s local cache, the first request after expiry pays 2 round-trips + the final `cacheOr` GET round-trip = **3 Redis round-trips per cache miss**.

**Impact:** At high request rates where the 2s local cache expires, this builds up: 200 RPS × 3 round-trips = 600 Redis ops/sec just for key building.

**Recommended Fix:**
- Cache version keys in-process for longer (30-60s) — invalidation impact is negligible
- Use a single hash key `cache:versions` storing all versions in one Redis HSET/GET

---

### 3.2 Admin Emails Cache Key Doesn't Invalidate on Admin Creation
**File:** `booking.helper.ts` (line 11)

**Problem:** `getAdminAndSuperAdminEmails` caches under `CacheKeys.single('admin', 'emails')`. But when a new admin is created, `CacheInvalidator.onRecordCreate('user')` only bumps the `user` list version, not the `admin` model version.

**Impact:** New admin emails are invisible to notification recipients for up to **6 hours** (TTL.LONG), causing missed admin notifications.

---

### 3.3 In-Process Stampede Protection Doesn't Work Across Instances
**File:** `lib/redis.ts` (line 194, `pendingFetches` Map)

**Problem:** The `pendingFetches` Map is in-process only. With multiple app instances (like Vercel's serverless), stampede protection doesn't prevent **cross-instance thundering herd** on cache misses.

**Recommended Fix:** Use Redis SETNX locking for cross-instance protection, or implement a "request coalescing" proxy layer.

---

### 3.4 TTL Tuning Issues
**Problem:**
- `TTL.SHORT = 10 minutes` is too long for **booking lists** — booking data changes frequently
- `TTL.LONG = 6 hours` for services/locations is aggressive **but** they rarely change, so acceptable
- **Negative cache TTL = 2 minutes** is too long for frequently-created records — a not-found booking will be cached as non-existent for 2 minutes

---

## 4. 🟠 Queue & Background Processing

### 4.1 Worker Limiter Too Restrictive for Email Queue
**File:** `helpers/worker/workerFactory.ts` (lines 13-18)

```typescript
concurrency: 5, // process up to 5 OTPs concurrently
limiter: {
  max: 10, // max 10 per second
  duration: 1000,
},
```

**Problem:** This config is **shared** between the OTP and email workers. 10 jobs/second is extremely conservative for email sending. With 50 concurrent users registering, the email queue backs up.

**Recommended Fix:** Separate worker configs — email worker with `concurrency: 20, limiter: { max: 50 }`.

### 4.2 OTP Queue is Dead Code
**File:** `helpers/worker/otpWorker.ts`, `Auth.service.ts`

**Problem:** The OTP queue (`otp-queue`) has a worker, but the Auth service sends all OTP emails via `mailQueue` (the `mail-queue`). No code ever adds to `otpQueue`. The worker and its queue cleaner interval are pure overhead.

**Recommended Fix:** Remove `otpQueue` entirely or redirect `mailQueue.add` calls to use it properly.

### 4.3 Double Queue Cleaner Registration
**Files:** `helpers/cleanQueue/cleanOtpQueue.ts` (lines 24-29), `helpers/queue-manager/queueManager.ts` (lines 22-31)

**Problem:** Both files set independent intervals to clean the OTP queue. The `cleanOtpQueue.ts` auto-registers its interval at module load, and `queueManager.ts` also manually registers its own cleaner.

**Impact:** Double-clean operations every 10 minutes + 1 hour = unnecessary Redis/REDIS load.

---

## 5. 🟠 API Performance

### 5.1 No HTTP Response Caching Headers
**Problem:** The API serves compressible JSON but no `Cache-Control` headers on cacheable endpoints (services, locations, FAQs, privacy, terms). Clients re-fetch these every time.

**Recommended Fix:** Add `Cache-Control: private, max-age=300` for authenticated cacheable endpoints, `public, max-age=3600` for public endpoints. Implement the existing `CacheControl` middleware.

### 5.2 Compression Threshold Too Low
**File:** `shared/index.ts` (line 36)

```typescript
threshold: 1024,
```

**Impact:** Every response over 1KB gets compressed, including small JSON that's already tiny. Compression CPU overhead for negligible savings on small payloads.

**Recommended Fix:** Raise to 4096 (4KB).

### 5.3 SSE Heartbeat Logging
**File:** `Notifications/sse.ts` (lines 38-41)

```typescript
if (activeCount > 0) {
  console.log(`Heartbeat sent to ${activeCount} connections`);
}
```

**Impact:** With 100 active SSE connections, this logs every 20 seconds = 430K log lines/day. Log noise can fill disk and slow the process.

**Recommended Fix:** Remove or make it debug-only / rate-limited.

### 5.4 Over-fetching — Full User Objects Without Select
**File:** `Notifications/Notification.service.ts` (line 85-87)

```typescript
const user = await prisma.user.findUnique({ where: { id: userId } });  // NO select!
```

**Impact:** Fetches full user document including password hash, OTPs, etc. for sending a notification.

---

## 6. 🟠 Infrastructure

### 6.1 Redis Maxmemory 150MB — Too Small
**File:** `docker-compose.yml` (lines 218-220)

```yaml
command: redis-server --maxmemory 150mb --maxmemory-policy allkeys-lru
```

**Problem:** With:
- 24-hour TTL auth token cache for every user
- Version-based cache keys (old versions never deleted, just expire)
- BullMQ job data
- SSE/WS online user profiles

150MB causes aggressive LRU eviction, leading to **cache thrashing** — entries evicted before their TTL, causing cache misses and DB overload.

**Recommended Fix:** Increase to 512MB minimum. Add `maxmemory-policy` tuning — consider `allkeys-lfu` instead of LRU for higher hit rate.

### 6.2 Vercel Deployment Conflicts
**File:** `vercel.json`

**Problem:** Deploying a long-running Express server with WebSockets, BullMQ workers, and SSE connections to Vercel serverless is fundamentally incompatible:
- Serverless functions have timeout limits (max 60s on Hobby, 300s on Pro)
- WebSockets do not persist between serverless invocations
- BullMQ workers need a persistent process

**Recommended Fix:** Deploy to a container platform (Render, Railway, Fly.io, ECS) for the API + worker. Keep Vercel for frontend only.

### 6.3 No Prisma Connection Pool Tuning
**File:** `utils/prisma.ts`

**Problem:** Default Prisma connection pool for MongoDB is not explicitly configured. MongoDB connector uses a client pool that may be too small for concurrent request bursts.

**Recommended Fix:** Add `connection_limit` and possibly `pool_timeout` in the Prisma client config or DATABASE_URL params.

### 6.4 Single-Process Node.js
**Problem:** The server runs on a single Node.js process/thread. CPU-bound operations (sanitize regex, bcrypt, JSON serialization of large payloads) block the event loop.

**Recommended Fix:** Enable Node.js cluster mode or use PM2 with `cluster` mode, or horizontally scale with multiple containers.

---

## 7. 🟡 Frontend / Asset Performance

### 7.1 Massive Email Template File
**File:** `utils/sendMail.ts` — 1,582 lines of inline HTML

**Impact:** Every import of this file pulls 1,582 lines into the bundle. Any change to one template re-parses all templates.

**Recommended Fix:** Move templates to separate files or a template directory, lazy-load only the needed template.

### 7.2 No Database-Level Pagination on Analytics
**Files:** `analytics.service.ts` — no pagination on `recentBookings` (take: 5) and `recentMedicalRecords` (take: 5), acceptable. But `getYearlyTrend` has no limits.

---

## 8. 📊 Estimated Impact Summary

| Bottleneck | Current Impact | After Fix | Latency Reduction |
|-----------|---------------|-----------|-------------------|
| Nodemailer per-send | 10-50ms/email | <5ms/email | **10-50x** |
| MongoDB regex search | 200-1000ms/query | 2-10ms/query | **50-200x** |
| Yearly analytics memory | 50K+ docs in RAM | Aggregated in DB | **~95% memory** |
| TimeSlot createMany | 16+ inserts | 1 insert | **16x** |
| Sequential queries | +20-50ms | +0ms | **2-5x** |
| Worker duplication | 2x processing | 1x processing | **2x throughput** |
| Redis thrashing | Cache miss storms | Stable hit rate | **3-10x hit rate** |
| Chat unbound | UI freeze | Smooth | **10x+** |

---

## 9. 📋 Risk Assessment Summary

| Change | Risk Level | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| Reuse Nodemailer transporter | 🟢 Low | Minor API change | Module-level singleton |
| Add MongoDB text indexes | 🟡 Medium | Index build time; behavior change | Build in background; test search accuracy |
| Use aggregation for analytics | 🟡 Medium | Raw queries needed for MongoDB date grouping | Test with production data patterns |
| Worker conditional startup | 🟢 Low | Config flag deployment | Default to current behavior if flag missing |
| TimeSlot `createMany` | 🟢 Low | Prisma API change | Verify return shape |
| Redis memory increase | 🟢 Low | Infrastructure cost | +$5-15/month |
| Remove OTP queue | 🟢 Low | No code uses it | Keep file archived |
| Sanitize optimization | 🟡 Medium | Security regression risk | Maintain allowlist validation |
| Paginate chat history | 🟢 Low | Client expects full history | Add backward-compatible default limit |

---

*Audit complete. See `PERFORMANCE_PLAN.md` for prioritized remediation strategy.*