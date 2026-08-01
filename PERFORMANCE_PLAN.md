# 📋 Performance Remediation Plan — Multi-Tenant Medical Compliance Platform

**Date:** August 1, 2026  
**Based on:** PERFORMANCE_AUDIT.md (comprehensive audit report)

---

## Strategy Overview

Following the ROI-prioritized approach:
1. **Phase 1 — Tier 1 (High Impact / Low Risk):** Quick wins with immediate, measurable gains
2. **Phase 2 — Tier 2 (High Impact / Medium Risk):** Structural improvements that require careful migration
3. **Phase 3 — Tier 3 (Medium Impact / Low-Med Risk):** Incremental hardening and optimization
4. **Phase 4 — Infrastructure & Monitoring:** Deployment config and observability

Each item includes: what, why, implementation approach, tests required, expected impact, and risk.

---

## Phase 1 — 🟢 Tier 1: High Impact / Low Risk

### P1.1 — Reuse Nodemailer Transporter (Module Singleton)
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/utils/sendMail.ts` |
| **Audit Ref** | 2.1 |
| **Risk** | 🟢 Very Low |

**What:** Convert the per-call `nodemailer.createTransport()` to a module-level singleton with connection pooling (`pool: true`).

**Why:** Creating a new SMTP transporter per email incurs TCP+SMTP handshake overhead of 10-50ms per email. With the mail queue processing potentially hundreds of emails, this becomes the dominant bottleneck.

**Expected Impact:**
- ⚡ **Throughput:** 10-50x email processing rate (from ~10-20 emails/min to 200+ emails/min)
- 🌐 **Network:** Eliminate redundant SMTP handshakes
- 💾 **Memory:** Reduced object churn

**Implementation:**
```typescript
// Module level — created once
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 2525,
  secure: false,
  auth: { user: ..., pass: ... },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateLimit: 20,  // Be nice to Brevo
});
```

**Tests:** Existing email test flows; verify confirmation emails arrive correctly after change.

---

### P1.2 — Conditional Worker Startup (Fix Duplicate Workers)
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/server.ts`, `docker-compose.yml` |
| **Audit Ref** | 2.2 |
| **Risk** | 🟢 Very Low |

**What:** Only start background workers when `IS_WORKER === 'true'`.

**Why:** Currently both the app and worker containers run the email worker. This creates duplicate email delivery and wastes resources.

**Expected Impact:**
- ⚡ **Throughput:** 2x processing efficiency (no more duplicate jobs)
- 📧 **Reliability:** Eliminates duplicate email sends
- 💾 **Memory:** Saves ~30-50MB in the app container

**Implementation:**
```typescript
// server.ts
if (process.env.IS_WORKER === 'true') {
  require('./app/helpers/worker/emailWorker');
}
```

**Tests:** Deploy with both `IS_WORKER=false` (app) and `IS_WORKER=true` (worker); verify only one set of workers runs.

---

### P1.3 — TimeSlot Bulk Creation with `createMany`
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/modules/timeSlot/timeSlot.service.ts` |
| **Audit Ref** | 1.4 |
| **Risk** | 🟢 Very Low |

**What:** Replace the `Promise.all(slots.map(...create))` pattern with a single `createMany`.

**Why:** 16+ individual MongoDB inserts for a single clinic day = 16+ round-trips. One `createMany` call = 1 round-trip.

**Expected Impact:**
- ⏱️ **Response Time:** ~16x faster availability creation
- 🗄️ **DB Load:** 16x fewer write operations

**Implementation:**
```typescript
await prisma.timeSlot.createMany({
  data: slots.map(slot => ({
    availabilityId: availability.id,
    clinicId,
    date: slot.nextDay ? nextDayObj : slotDateObj,
    startTime: slot.startTime,
    endTime: slot.endTime,
    duration: 30,
    capacity: capacity ?? 100,
    booked: 0,
    isBooked: false,
    status: SlotStatus.Active,
  })),
});
```

**Tests:** Verify slot list response shape still matches (`id`, `date`, `startTime`, `endTime`, `status`). May need re-query after createMany.

---

### P1.4 — Parallelize Independent Queries in createBooking
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/modules/booking/booking.service.ts` |
| **Audit Ref** | 2.3 |
| **Risk** | 🟢 Very Low |

**What:** Run `getAdminAndSuperAdminEmails()`, driver query, and clinic query in parallel.

**Why:** Three sequential DB queries add 6-30ms to the critical path of booking creation.

**Expected Impact:**
- ⏱️ **Response Time:** ~15-30ms saved per booking creation

**Implementation:**
```typescript
const [admins, driver, clinic] = await Promise.all([
  getAdminAndSuperAdminEmails(),
  prisma.user.findUnique({ where: { id: driverId }, select: {...} }),
  prisma.user.findFirst({ where: { id: clinicId, ... }, select: {...} }),
]);
```

**Tests:** Create booking end-to-end test; verify all notification/email flows still work.

---

### P1.5 — Raise Compression Threshold
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/shared/index.ts` |
| **Audit Ref** | 5.2 |
| **Risk** | 🟢 Very Low |

**What:** Change `threshold: 1024` → `threshold: 4096`.

**Why:** Compressing sub-4KB JSON responses wastes CPU with negligible bandwidth savings.

**Expected Impact:**
- ⏱️ **Response Time:** 0.1-0.5ms saved per small request
- 🔧 **CPU:** Reduced compression work

---

### P1.6 — Fix Overly-Long Negative Cache TTL
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/lib/redis.ts` |
| **Audit Ref** | 3.4 |
| **Risk** | 🟢 Very Low |

**What:** Change negative cache TTL from `60 * 2` to `60 * 30` (30 seconds).

**Why:** A 2-minute negative cache on frequently-created records (bookings) causes "not found" responses for newly created records.

**Expected Impact:**
- ⚡ **Consistency:** Records become visible 4x faster after creation

---

### P1.7 — Add Cache-Control Response Headers
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/middlewares/cacheControl.ts` (verify existing), `src/app/middlewares/` |
| **Audit Ref** | 5.1 |
| **Risk** | 🟢 Very Low |

**What:** Apply Cache-Control headers on cacheable endpoints (services, locations, FAQs, privacy, terms).

**Why:** Reduces redundant client-side network requests.

---

### P1.8 — Fix SSE Heartbeat Logging
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/modules/Notifications/sse.ts` |
| **Audit Ref** | 5.3 |
| **Risk** | 🟢 Very Low |

**What:** Remove the per-heartbeat console.log or make it debug-level.

**Why:** Logs 430K lines/day with 100 active connections.

---

## Phase 2 — 🟡 Tier 2: High Impact / Medium Risk

### P2.1 — MongoDB Text Indexes for Search
| Attribute | Value |
|-----------|-------|
| **File(s)** | `prisma/*.prisma` (schema), all service `search` queries |
| **Audit Ref** | 1.1 |
| **Risk** | 🟡 Medium |

**What:** Add MongoDB text indexes on searchable fields; switch `contains + insensitive` queries to `$search` (Prisma `search` filter) or `normalized` fields with prefix regex.

**Why:** Regex full-collection scans become the dominant bottleneck as collections grow.

**Expected Impact:**
- ⏱️ **Response Time:** 50-200x faster search at scale
- 🗄️ **DB Load:** Indexed lookups instead of full scans

**Implementation Plan:**
1. Add text indexes in Prisma schema on `User[fullName, email]`, `Booking` → driver/clinic name (via relations), `Service[title]`, `Ticket[subject, description]` 
2. Add a `normalizedFullName` field (lowercase) to User for prefix search
3. Update search queries to use `$text` search or prefix regex
4. Run index creation migration

**Tests:** Search accuracy tests; benchmark before/after with 10K+ documents.

---

### P2.2 — Aggregate Queries for Analytics
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/modules/analytics/analytics.service.ts` |
| **Audit Ref** | 1.2 |
| **Risk** | 🟡 Medium |

**What:** Replace in-memory yearly trend computation with MongoDB aggregation pipelines using `$dateToString` + `$group`.

**Why:** Loading 50K+ documents into Node just to count them wastes memory and blocks the event loop during JSON serialization.

**Expected Impact:**
- 💾 **Memory:** ~95% reduction on analytics endpoints
- ⏱️ **Response Time:** 2-5x faster for admins with large datasets

**Implementation Plan:**
1. Create a reusable `getMonthlyCounts(model, field, dateField, yearStart)` helper using `$raw` or `$queryRaw`
2. Replace `getYearlyTrend()` and organizer booking history
3. Keep the same response shape

**Tests:** Verify analytics response matches expected structure and numbers for known datasets.

---

### P2.3 — Add Compound Indexes
| Attribute | Value |
|-----------|-------|
| **File(s)** | `prisma/booking.prisma`, `prisma/user.prisma`, `prisma/payment.prisma`, `prisma/timeSlot.prisma` |
| **Audit Ref** | 1.3 |
| **Risk** | 🟡 Medium (requires migration, but additive only) |

**What:** Add compound indexes:
- `Booking[driverId, scheduledAt]`
- `Booking[clinicId, scheduledAt]`
- `Booking[status, createdAt]`
- `User[role, isDeleted]`
- `Payment[bookingId, status]`
- `TimeSlot[clinicId, date, status]`

**Why:** Common filtered queries currently do collection scans.

**Expected Impact:**
- ⏱️ **Response Time:** 5-20x faster on filtered list queries
- 🗄️ **DB Load:** Reduced scanning

---

### P2.4 — Optimize Sanitize Middleware
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/middlewares/sanitize.ts` |
| **Audit Ref** | 2.4 |
| **Risk** | 🟡 Medium (security-sensitive) |

**What:** Replace parse-and-sanitize-everything with field-level validation + single-pass sanitization only on user-provided strings that enter the DB as free text.

**Why:** Current double-pass (scan + sanitize) regex work adds CPU overhead on every request.

**Expected Impact:**
- ⏱️ **Response Time:** 0.3-2ms saved per request
- 🔧 **CPU:** Reduced GC pressure from regex object churn

---

### P2.5 — Reduce Redis Version-Cache Round-Trips
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/lib/redis.ts` |
| **Audit Ref** | 3.1 |
| **Risk** | 🟢 Low |

**What:** Increase `LOCAL_VERSION_TTL_MS` from 2s to 30-60s; optionally consolidate version keys into one Redis hash.

**Why:** Reduces 2-3 Redis round-trips per cache operation to 1.

**Expected Impact:**
- ⚡ **Throughput:** ~30% fewer Redis commands at high RPS
- ⏱️ **Latency:** 0.2-0.5ms saved per cached request

---

## Phase 3 — 🟠 Tier 3: Medium Impact / Low-Med Risk

### P3.1 — Fix Admin Emails Cache Invalidation
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/modules/booking/booking.helper.ts`, `src/app/modules/User/user.service.ts` |
| **Audit Ref** | 3.2 |
| **Risk** | 🟢 Low |

**What:** Invalidate the `admin:emails` cache when new admins are created.

**Implementation:** Add `CacheInvalidator.onRelatedChangeFull('admin')` in `createAdminIntoDB`.

---

### P3.2 — WebSocket Chat Pagination
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/middlewares/webSocket.ts` |
| **Audit Ref** | 1.5 |
| **Risk** | 🟢 Low |

**What:** Add cursor/offset pagination to `fetchChats`; limit `messageList` to ~50 conversations.

**Why:** Unbounded chat loading freezes clients and saturates the network.

**Expected Impact:**
- 🖥️ **UX:** Smooth chat loading regardless of history size
- 🌐 **Network:** 10x+ reduction in WS payload size

---

### P3.3 — Remove OTP Queue Dead Code
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/helpers/worker/otpWorker.ts`, `src/app/helpers/queue/index.ts`, `src/app/helpers/queue-manager/queueManager.ts` |
| **Audit Ref** | 4.2 |
| **Risk** | 🟢 Low |

**What:** Remove `otpQueue` since no code adds to it. All OTP emails go through `mailQueue`.

**Expected Impact:**
- 💾 **Memory:** ~10-20MB saved
- ⚡ **CPU:** No wasted worker polling

---

### P3.4 — Remove Double Queue Cleaner
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/helpers/cleanQueue/cleanOtpQueue.ts` |
| **Audit Ref** | 4.3 |
| **Risk** | 🟢 Low |

**What:** Remove the auto-registered `setInterval` at module bottom; keep only the `cleanQueue` function for `queueManager.ts` to call.

---

### P3.5 — Fix Payment Search Fields
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/modules/Payment/payment.service.ts` |
| **Audit Ref** | 1.7 |
| **Risk** | 🟢 Low |

**What:** Fix `paymentSearchAbleFields` to valid Payment fields (e.g., `['id', 'status']`) or use related user join search.

---

### P3.6 — GeoIndex for Location Queries
| Attribute | Value |
|-----------|-------|
| **File(s)** | `prisma/location.prisma`, `src/app/modules/location/location.service.ts` |
| **Audit Ref** | 1.6 |
| **Risk** | 🟡 Medium |

**What:** Add `2dsphere` index; use `$geoNear` aggregation for nearest-location.

**Why:** Application-side O(n) distance calculation becomes unbounded as locations grow.

---

### P3.7 — Fix Notification Over-Fetching
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/modules/Notifications/Notification.service.ts` |
| **Audit Ref** | 5.4 |
| **Risk** | 🟢 Low |

**What:** Add explicit `select: { fcmToken: true }` on user queries in notification flows.

---

## Phase 4 — 🏗 Infrastructure & Monitoring

### P4.1 — Increase Redis Memory & Tune Policy
| Attribute | Value |
|-----------|-------|
| **File(s)** | `docker-compose.yml` |
| **Audit Ref** | 6.1 |
| **Risk** | 🟢 Low |

**What:** Increase `--maxmemory` from `150mb` to `512mb`; consider `allkeys-lfu`.

**Why:** 150MB causes aggressive eviction and cache thrashing.

**Expected Impact:**
- ⚡ **Cache Hit Rate:** 3-10x improvement
- 🗄️ **DB Load:** Significantly fewer cache-miss-driven queries

---

### P4.2 — Prisma Connection Pool Tuning
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/app/utils/prisma.ts`, `.env` |
| **Audit Ref** | 6.3 |
| **Risk** | 🟢 Low |

**What:** Configure explicit MongoDB connection pool size (e.g., `connection_limit=20`) in DATABASE_URL or Prisma client config.

---

### P4.3 — Node.js Cluster/PM2 Configuration
| Attribute | Value |
|-----------|-------|
| **File(s)** | `src/server.ts`, new `ecosystem.config.js` |
| **Audit Ref** | 6.4 |
| **Risk** | 🟡 Medium |

**What:** Add PM2 cluster mode (2-4 instances) or Node cluster for multi-core utilization.

**Why:** Single-process Node uses only 1 core on multi-core hosts.

---

### P4.4 — Vercel Deployment Review
| Attribute | Value |
|-----------|-------|
| **File(s)** | `vercel.json` |
| **Audit Ref** | 6.2 |
| **Risk** | 🟡 Medium |

**What:** Recommend moving API deployment to a container platform (Render/Railway/Fly) for WebSocket + BullMQ support.

---

## Execution Order & Rollout

```
Phase 1 (Tier 1 — Safe Wins)          → Deployable immediately, test after each
  P1.1 Nodemailer singleton
  P1.2 Conditional workers
  P1.3 TimeSlot createMany
  P1.4 Parallel booking queries
  P1.5 Compression threshold
  P1.6 Negative cache TTL
  P1.7 Cache-Control headers
  P1.8 SSE logging

Phase 2 (Tier 2 — Medium Risk)        → Requires schema migration, benchmark before/after
  P2.1 Text indexes
  P2.2 Analytics aggregation
  P2.3 Compound indexes
  P2.4 Sanitize optimization
  P2.5 Version cache optimization

Phase 3 (Tier 3 — Incremental)        → As capacity allows
  P3.1-P3.7

Phase 4 (Infrastructure)              → Coordinated with deployment
  P4.1-P4.4
```

---

## Measurement Plan

| Metric | Tool | Baseline | Target |
|--------|------|----------|--------|
| API P95 response time | responseLogger | TBD | -50% |
| Cache hit rate | `serverHealth` / Redis INFO | TBD | >85% |
| Email queue processing rate | Bull Board | TBD | 10x |
| Memory usage (app) | Docker stats | TBD | -20% |
| Search query latency | Response logger | TBD | 50x |
| Availability creation latency | API timing | TBD | 16x |

**Before implementing each phase:** capture baseline metrics from current production/development environment.

---

## Approval Gate

This plan requires **explicit approval** before implementation begins. Please review:
1. **Phase 1** — Ready for immediate implementation (all low-risk)
2. **Phase 2** — Review schema migration implications
3. **Phase 3** — Queue for subsequent sprints
4. **Phase 4** — Coordinate with deployment infrastructure

**Note:** All changes are designed to be **backward-compatible**. No breaking API changes are introduced. Existing functionality is preserved.