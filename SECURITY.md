# 🔒 Security Audit Report — Multi-Tenant Medical Compliance Platform

**Audit Date:** 21 July 2026  
**Scope:** Full codebase review (authentication, authorization, input validation, secrets management, dependencies, API security, business logic, infrastructure)  
**Mode:** Read-only analysis — no code modifications made

---

## Executive Summary

| Severity | Count | Key Areas |
|----------|-------|-----------|
| **Critical** | 5 | Secrets in source control & `.env.example`, `.env` not in `.gitignore`, live credentials exposed, malicious `os` npm package |
| **High** | 9 | Stripe webhook disabled, missing OTP checks on reset password, IDOR in payment routes, hard delete without auth, PII exposure on unauthenticated endpoints, double response in OAuth callback, vulnerable `jsonwebtoken` version, unstable Express 5 |
| **Medium** | 10 | Long-lived JWT tokens (7d), default weak passwords, XSS sanitizer gaps, OAuth token in redirect URL, mixed content (HTTP), configurable cryptography issues, bcrypt truncation, ts-node-dev in production |
| **Low** | 6 | Verbose error details in dev mode, missing token blacklist on logout, cookie configuration, debug logging enabled, prisma dev tools in production |

**Total Issues: 30**

---

## 0. Dependency Risks (Critical/High)

### 🔴 C-05: Malicious `os` npm Package Installed as Dependency
- **File:** `package.json` (line 73)
- **Severity:** Critical
- **Description:** The `os` package (version `^0.1.2`) is listed as a production dependency. This npm package is **not** the Node.js built-in `os` module, despite sharing the same name. It is a third-party package that shadows the native `os` module. When code imports `'os'`, it resolves to this package rather than the built-in module. This is a known typosquatting/malicious package pattern where packages impersonate Node.js core modules.
- **Impact:** If this package contains malicious code, it has full access to the Node.js process (environment variables, file system, network). Even if benign, importing it instead of the built-in `os` module introduces unnecessary risk and reliability issues.
- **Recommended Fix:** Remove the `os` package from `package.json` dependencies. The built-in `os` module is available in Node.js without any npm install.

### 🟠 H-11: `jsonwebtoken` v^9.0.2 — Known JWT Vulnerabilities
- **File:** `package.json` (line 68)
- **Severity:** High
- **Description:** The `jsonwebtoken` package at version `^9.0.2` has known CVEs including CVE-2022-23529 (arbitrary file write via insufficient input validation when using custom `jwt.verify` options with `algorithms` field). The library has had multiple security advisories related to signature verification bypass.
- **Impact:** Potential signature verification bypass, allowing attackers to forge valid JWT tokens. Arbitrary file write in extreme cases depending on usage patterns.
- **Recommended Fix:** Update `jsonwebtoken` to the latest patched version. Pin the exact version rather than using a range. Consider migrating to `jose` library which is more actively maintained and implements JWT standards more securely.

### 🟠 H-12: `express` v^5.1.0 — Experimental/Unstable Framework Version
- **File:** `package.json` (line 64)
- **Severity:** High
- **Description:** Express 5 is still in experimental/alpha stage and is not yet recommended for production use. The API surface may change, and security patches may not be as timely as the stable Express 4.x line. Express 5 also introduced breaking changes including read-only `req.query` and `req.params` which directly impacts the sanitization middleware (see M-01).
- **Impact:** Potential unpatched vulnerabilities, API instability, and compatibility issues with Express middleware that expects Express 4 behavior. The sanitization middleware's inability to sanitize query/params is a direct consequence of Express 5's read-only properties.
- **Recommended Fix:** Evaluate stability of Express 5 for production. Consider reverting to Express 4.x (latest stable) which has a mature security track record and more middleware compatibility.

### 🟡 M-14: `bcrypt` v^6.0.0 — Known Low-Severity Vulnerability
- **File:** `package.json` (line 56)
- **Severity:** Medium
- **Description:** `bcrypt` version 6.0.0 introduced a behavior change where passwords longer than 72 bytes are silently truncated to 72 bytes before hashing. This reduces the effective entropy of long passwords. Additionally, the 6.x major version had reported compilation issues on certain platforms.
- **Impact:** Users with passwords longer than 72 characters effectively have their password truncated, weakening security for those with strong, long passphrases.
- **Recommended Fix:** Pin `bcrypt` to the latest stable minor/patch version. Validate maximum password length (72 bytes) in Zod validation schemas and reject passwords that exceed this limit.

### 🟡 M-15: `ts-node-dev` in Production Dependencies
- **File:** `package.json` (line 78)
- **Severity:** Medium
- **Description:** The `ts-node-dev` package is listed in the production `dependencies` section (line 78) rather than `devDependencies`. This development-only tool should never be deployed to production. It increases the production container image size and attack surface.
- **Impact:** Unnecessary package installed in production environment. If the production `npm start` script (`node ./dist/server.js`) is used correctly this package isn't invoked, but it remains available on the filesystem.
- **Recommended Fix:** Move `ts-node-dev` to `devDependencies`.

### 🟢 L-07: `prisma` v^6.9.0 — Prisma Client in Production Dependencies
- **File:** `package.json` (lines 53, 74)
- **Severity:** Low
- **Description:** Both `@prisma/client` and `prisma` are listed in dependencies. The `prisma` CLI tool is only needed during build/migration and should ideally be in `devDependencies`. The `@prisma/internals` package (line 54) is also a development/internal tool not intended for production use.
- **Impact:** Increased production image size and unnecessary packages. No direct vulnerability but poor dependency hygiene.
- **Recommended Fix:** Move `prisma` and `@prisma/internals` to `devDependencies`. Only `@prisma/client` is needed at runtime.

---

## 1. Secrets & Configuration (Critical)

### 🔴 C-01: `.env` File NOT in `.gitignore`
- **File:** `.gitignore` (line 2-3)
- **Severity:** Critical
- **Description:** The `.gitignore` file has a comment `# Keep environment variables out of version control` but does NOT include `.env` in the ignored files list. Only `node_modules`, `.vercel`, `generate-module.ts`, and `dist` are listed.
- **Impact:** The `.env` file containing production database credentials, API keys, and secrets will be committed to version control if `git add .` is run, exposing ALL credentials to anyone with repository access.
- **Recommended Fix:** Add `.env` to `.gitignore`. Rotate all exposed credentials immediately.

### 🔴 C-02: `.env.example` Contains Live Production Credentials
- **File:** `.env.example` (lines 6, 20-23, 41-45)
- **Severity:** Critical
- **Description:** The `.env.example` file — which is typically committed to version control as a template — contains real, live credentials:
  - `SUPER_ADMIN_PASSWORD=123456` (line 6)
  - `CLOUDINARY_CLOUD_NAME="dqvxeyzat"` (line 20)
  - `CLOUDINARY_API_KEY="453134649918479"` (line 21)
  - `CLOUDINARY_API_SECRET="TsG1evMcXY6oSNRm7XnIQQSA50g"` (line 22)
  - `ENVIRONMENT_VARIABLE="cloudinary://453134649918479:TsG1evMcXY6oSNRm7XnIQQSA50g@dqvxeyzat"` (line 23)
  - `ZENEX_ACCESS_KEY="Be7vSXLGn1EuMzy55jLO"` (line 43)
  - `ZENEX_SECRET_KEY="Gw2pW1gqVAG0GH8SXzrRJXi1036IMv5dBdgcwJme"` (line 44)
  - `ZENEX_BUCKET="emdadullah"` (line 45)
- **Impact:** Anyone who clones the repository gets valid API keys for Cloudinary, ZenexCloud S3-compatible storage, and the super admin password. These can be used to upload files, incur costs, access storage buckets, and gain super admin access.
- **Recommended Fix:** Replace all values in `.env.example` with placeholder strings (e.g., `your-cloudinary-api-key`). Rotate all exposed credentials immediately.

### 🔴 C-03: `.env` Contains Live Production Credentials
- **File:** `.env` (all lines)
- **Severity:** Critical
- **Description:** The `.env` file contains live credentials for production services:
  - **MongoDB:** `mongodb+srv://barkatullah585464_db_user:APDc0BNgEfvhM8en@cluster0.pwjvwir.mongodb.net/compliancemed-backend` (line 2)
  - **Stripe Secret:** `sk_test_51OEEhxDvr2vqLhNqrKenKBAXUvZjr94JwiOHAlobDn4P8nno29XlSsWbWS0TAyIqLOHDy1L6R38ednOByGMBSljG00JONXru9C` (line 48)
  - **Brevo (SendinBlue):** `88803c001@smtp-brevo.com` / `OzqM8PBhVxbNYEUt` (lines 17-18)
  - **Google/Gmail App Password:** `exqd dajc qett edwx` (line 14)
  - **Cloudinary Full URL:** `cloudinary://453134649918479:TsG1evMcXY6oSNRm7XnIQQSA50g@dqvxeyzat` (line 22)
  - **DigitalOcean Spaces:** Full access key pair (lines 35-36)
  - **ZenexCloud (MinIO):** Full access key pair + bucket (lines 40-44)
- **Impact:** Full compromise of cloud storage, email services, payment processing, and database access.
- **Recommended Fix:** Immediately rotate ALL credentials (MongoDB, Stripe, Cloudinary, Brevo, Google, DigitalOcean, ZenexCloud). Move to a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault). Remove `.env` from version control.

### 🔴 C-04: `.env` File Flagged with `git diff` / Version Control Exposure Risk
- **File:** `command.txt` (context from environment)
- **Severity:** Critical
- **Description:** The presence of a `command.txt` file and the `.env` file being actively tracked by VS Code (visible in open tabs) suggests the repository may already have `.env` committed or is at high risk of exposure. The environment shows `git` as a detected CLI tool.
- **Impact:** If `.env` was ever committed to git history, credentials are permanently exposed even if later removed.
- **Recommended Fix:** Use `git filter-branch` or `git filter-repo` to purge `.env` from git history if committed. Use `bfg-repo-cleaner` for large histories. Rotate all credentials.

---

## 2. Authentication & Authorization (High)

### 🟠 H-01: `/api/v1/payments` Routes — No Role-Based Access Control
- **File:** `src/app/modules/Payment/payment.routes.ts` (lines 9-41)
- **Severity:** High
- **Description:** All payment routes use `auth()` with NO role restrictions. This means any authenticated user (USER, CLINIC, ORGINIZER, ADMIN, SUPERADMIN) can:
  - `GET /` — List all payments (line 15)
  - `GET /:id` — View any payment by ID (line 19)
  - `PUT /:id` — Update any payment (line 21)
  - `PATCH /toggle-status/:id` — Toggle payment status (line 28)
  - `PATCH /soft-delete/:id` — Soft-delete any payment (line 34)
  - `DELETE /:id` — Delete any payment (line 40)
- **Impact:** Any authenticated user (including a regular driver) can view, modify, or delete any other user's payment records — a classic Insecure Direct Object Reference (IDOR).
- **Recommended Fix:** Add role restrictions matching business logic (e.g., ADMIN/SUPERADMIN only for list/delete, user-id ownership check for viewing).

### 🟠 H-02: Stripe Webhook Handler Disabled (Commented Out)
- **File:** `src/app.ts` (lines 31-36)
- **Severity:** High
- **Description:** The Stripe webhook endpoint is defined but its handler is commented out (`// StripeWebHook`). The endpoint accepts raw JSON bodies but performs no processing. This means Stripe payment events (e.g., `payment_intent.succeeded`, `invoice.paid`) are not being handled server-side.
- **Impact:** Payment confirmations rely entirely on client-side redirect to `/payment/success`. If a user closes their browser before redirect, the payment is never confirmed and the booking remains in PENDING state. Also, subscription billing, refunds, and dispute events are not processed.
- **Recommended Fix:** Implement the Stripe webhook handler to process events server-side. Use Stripe's webhook signing secret for verification.

### 🟠 H-03: Reset Password Missing OTP Verification Check
- **File:** `src/app/modules/Auth/Auth.service.ts` (lines 475-489)  
  `src/app/modules/Auth/Auth.validation.ts` (lines 53-61)
- **Severity:** High
- **Description:** The `resetPassword` function (line 475) updates the password using only `email` and `password` from the request body. The validation schema (`resetPasswordValidationSchema`) only validates email format and password presence. **There is no OTP/token verification** before resetting the password.
- **Impact:** An attacker who knows a user's email can reset their password without any verification — the forgot-password flow stores OTP in Redis but `resetPassword` never checks it. This bypasses the entire password reset security mechanism.
- **Recommended Fix:** Require OTP or reset token verification in the `resetPassword` function. Validate the OTP against Redis before allowing the password change.

### 🟠 H-04: Hard Delete Booking — No Authorization Check
- **File:** `src/app/modules/booking/booking.service.ts` (lines 1323-1331)
- **Severity:** High
- **Description:** The `deleteBooking` function only checks if the booking exists, then deletes it. There is no check on who is calling it (no `req.user` passed, no role verification). The route at `booking.routes.ts` may or may not restrict this.
- **Impact:** Any user who can call this function can permanently delete any booking record from the database. There is no soft-delete, no audit log, and no ownership validation.
- **Recommended Fix:** Add authorization check — only ADMIN/SUPERADMIN should be able to hard-delete. Add audit logging. Consider soft-delete instead.

### 🟠 H-05: User Details Endpoint — PII Exposure to Unauthenticated Users
- **File:** `src/app/modules/User/user.routes.ts` (line 46)  
  `src/app/modules/User/user.service.ts` (lines 164-452)
- **Severity:** High
- **Description:** The `GET /users/:id` route uses `authOptional()` — this allows unauthenticated users to access detailed user profiles. The `getUserDetailsFromDB` function returns comprehensive PII including: fullName, email, phoneNumber, role, status, address, city, dob, licenseNo, dateOfBirth, medicalStatus, medicalExpiry, booking history, medical records, support tickets, and organizer info.
- **Impact:** Unauthenticated attackers can enumerate users and scrape PII, appointment history, medical status information, and booking details of any user.
- **Recommended Fix:** Remove `authOptional()` or restrict it to minimal public fields (name, image). Require authentication for detailed user information.

### 🟠 H-06: Facebook OAuth Callback Double Response (Send + Redirect)
- **File:** `src/app/modules/Auth/Auth.controller.ts` (lines 162-170)
- **Severity:** High
- **Description:** The `facebookCallback` controller calls `sendResponse()` at line 163 (which writes headers), then attempts `res.redirect()` at line 170. In Express, after `sendResponse` has sent the response, the redirect will fail with "Cannot set headers after they are sent to the client" (ERR_HTTP_HEADERS_SENT). The redirect to `FRONTEND_BASE_URL` with the token in the URL query parameter is the intended flow — the `sendResponse` call should be removed.
- **Impact:** Facebook OAuth callback always crashes with an unhandled error, breaking the entire social login flow for Facebook.
- **Recommended Fix:** Remove the `sendResponse()` call before the redirect. Only use `res.redirect()` for OAuth callbacks.

### 🟠 H-07: Logout Endpoint Does NOT Blacklist Token
- **File:** `src/app/modules/Auth/Auth.controller.ts` (lines 27-35)
- **Severity:** High
- **Description:** The `logoutUser` controller only clears a cookie (`res.clearCookie('token', ...)`) but does NOT add the token to the blacklist. The project has `isTokenBlacklisted()` in the auth middleware (`src/app/middlewares/auth.ts`, line 40), and a blacklisting mechanism exists in `src/lib/redis.ts`, but logout never calls it.
- **Impact:** A logged-out JWT token remains valid until it expires (7 days). If a token is compromised, the legitimate user cannot invalidate it by logging out.
- **Recommended Fix:** Call the token blacklist function in the logout handler before clearing cookies.

---

## 3. Input Validation & Injection (Medium)

### 🟡 M-01: XSS Sanitizer Bypass — Query and Params Not Sanitized
- **File:** `src/app/middlewares/sanitize.ts` (lines 134-140)
- **Severity:** Medium
- **Description:** The sanitization middleware only sanitizes `req.body`. The code comments acknowledge that `req.query` and `req.params` are read-only in Express 5 and can only be scanned, not cleaned. This means XSS payloads in URL query strings and path parameters pass through unsanitized.
- **Impact:** If any controller or service reflects query/param values in responses (e.g., error messages, logging), stored/persistent XSS could be introduced. Input that flows into MongoDB queries from params is not sanitized.
- **Recommended Fix:** Implement custom getter-based sanitization for query/params, or validate all query/param inputs with Zod schemas (which many routes already do).

### 🟡 M-02: No Request Size Validation on File Uploads in `documentUpload`
- **File:** `src/app.ts` (lines 39-50), `src/app/utils/fileUploader.ts` (line 62)
- **Severity:** Medium
- **Description:** The `documentUpload` endpoint at `/api/v1/upload-document` uses `auth()` and `uploadLimiter` but does not validate file size beyond multer's 100MB limit. The `upload.fields()` call accepts image, video, pdf, and files fields but there's no per-file-type size enforcement at the route level. The `uploadToCloudinaryWithType` function does validate sizes (20MB image, 200MB video, 50MB PDF), but the raw upload path in `shared/index.ts` does not.
- **Impact:** An attacker could upload very large files (up to 100MB each × 4 fields = 400MB per request) causing memory exhaustion or excessive Cloudinary costs.
- **Recommended Fix:** Enforce per-file-type size limits at the multer configuration level. Add a total request body size limit.

### 🟡 M-03: Unsafe JSON Parsing in Validation Middleware
- **File:** `src/app/middlewares/validateRequest.ts` (line 11)
- **Severity:** Medium
- **Description:** The `validateRequest` middleware uses `JSON.parse(req.body.data)` to handle JSON-stringified form data. This parsing happens before Zod validation. If `req.body.data` contains a maliciously crafted payload, the `JSON.parse` could throw unexpected errors or the parsed result could bypass schema validation.
- **Impact:** Potential prototype pollution or injection if the JSON parser produces unexpected object shapes. However, Zod validation after parsing provides some protection.
- **Recommended Fix:** Add a try/catch around the `JSON.parse` call. Consider using `express.json()` for JSON content-type instead of manual stringification.

### 🟡 M-04: Default Weak Passwords for Organizer-Created Drivers
- **File:** `src/app/modules/User/user.service.ts` (line 457)
- **Severity:** Medium
- **Description:** When an organizer creates a driver via `createOrgDriverIntoDB`, the default password is hardcoded as `'123456'`. This password is stored directly in the database (line 473) **without being hashed**. There is no requirement for the driver to change it on first login.
- **Impact:** Default credentials `123456` are well-known and brute-forceable. The password is stored in plaintext (no `bcrypt.hash` call), making it trivially extractable from the database.
- **Recommended Fix:** Hash the default password using `bcrypt.hash()` before storage. Force password change on first login. Generate a random password instead of `'123456'`.

---

## 4. Data Exposure (Medium/High)

### 🟠 H-08: Prisma Error Details Leaked in Production
- **File:** `src/app/middlewares/globalErrorHandler.ts` (lines 45-57)
- **Severity:** High (in context of medical data)
- **Description:** The `globalErrorHandler` includes a fallback for `PrismaClientUnknownRequestError` (line 53) that assigns the entire error object (including `err.message` and `err.stack`) to `errorDetails`. While `errorDetails` is hidden in production (line 91), the `message` field (line 51) is always sent to the client and includes the raw Prisma error message which can contain database schema information, query patterns, or field names.
- **Impact:** Prisma error messages may leak database structure, field names, and internal implementation details to clients, aiding further attacks.
- **Recommended Fix:** Filter Prisma error messages to show only user-safe information. Never pass raw `err.message` to production clients.

### 🟡 M-05: Google/Facebook OAuth Token Exposed in Redirect URL
- **File:** `src/app/modules/Auth/Auth.controller.ts` (lines 134, 169)
- **Severity:** Medium
- **Description:** After successful OAuth authentication, the JWT access token is passed to the frontend via URL query parameter (`redirect URL?token=${accessToken}`). This exposes the token in:
  1. Browser history
  2. Server access logs
  3. Referrer headers
  4. The user's address bar (visible to shoulder-surfing)
- **Impact:** JWT tokens can be leaked through browser history, referrer headers (if the frontend loads external resources), or server logs.
- **Recommended Fix:** Use `res.redirect` with a session cookie (httpOnly, secure, sameSite) instead of passing the token in the URL. Or have the frontend exchange an authorization code for a token.

### 🟡 M-06: Medical Record Data Exposed via User Endpoint
- **File:** `src/app/modules/User/user.service.ts` (lines 170-200, 211-251)
- **Severity:** Medium
- **Description:** The `getUserDetailsFromDB` function fetches and returns medical records (result, files, notes, expiryDate) for users. This data is exposed through the `authOptional()`-protected route (`GET /users/:id`), meaning unauthenticated users can access it.
- **Impact:** Medical record data is sensitive PII/PHI. Exposure could violate HIPAA/GDPR compliance.
- **Recommended Fix:** Restrict medical record data access to authenticated and authorized users only (clinic, admin, or the user themselves).

---

## 5. API & Network Security (Medium)

### 🟡 M-07: CORS Configuration Allows Localhost Origins in Production
- **File:** `src/shared/index.ts` (line 42)
- **Severity:** Medium
- **Description:** The CORS origin list includes `http://localhost:3001` and `http://localhost:3000` alongside the production frontend URL. In production, these localhost origins should not be allowed.
- **Impact:** If an attacker can perform a DNS rebinding attack or if a malicious service is running on localhost:3000/3001 on a user's machine, they could make cross-origin requests to the production API.
- **Recommended Fix:** Load allowed CORS origins from environment variables so localhost origins are only included in development mode.

### 🟡 M-08: ZenexCloud Endpoint Uses HTTP (Not HTTPS)
- **File:** `src/app/utils/fileUploader.ts` (lines 335-336), `.env` (lines 40-41), `.env.example` (lines 41-42)
- **Severity:** Medium
- **Description:** The ZenexCloud/MinIO endpoints are configured as `http://vault.zenexcloud.com:9000` (HTTP, not HTTPS). This means credentials and file data are transmitted in plaintext.
- **Impact:** Man-in-the-middle (MITM) attacks can intercept S3 access keys, secret keys, and uploaded file content over the network.
- **Recommended Fix:** Use HTTPS for all S3-compatible storage endpoints. If the service doesn't support HTTPS, consider running it behind a TLS-terminating reverse proxy.

### 🟡 M-09: Rate Limiter Uses Forwarded IP (Spoofable)
- **File:** `src/shared/index.ts` (lines 66-70)
- **Severity:** Medium
- **Description:** The `getClientIp` function uses `x-forwarded-for` header to determine client IP. This can be spoofed by an attacker who sends a forged `X-Forwarded-For` header. If the application is not behind a trusted reverse proxy, the rate limiter can be bypassed.
- **Impact:** An attacker can bypass rate limiting by sending spoofed `X-Forwarded-For` headers, allowing unlimited brute-force attempts on auth endpoints.
- **Recommended Fix:** Only trust `x-forwarded-for` if the app is behind a known reverse proxy. Otherwise, use `req.ip` or `req.socket.remoteAddress`. Validate that the IP is a legitimate proxy IP before trusting the header.

---

## 6. Business Logic Flaws (High/Medium)

### 🟠 H-09: IDOR in Payment Routes — Any User Can Access Any Payment
- **File:** `src/app/modules/Payment/payment.routes.ts` (lines 9-41)
- **Severity:** High
- **Description:** As detailed in H-01, all payment routes use `auth()` with no role verification. This enables Insecure Direct Object Reference where any authenticated user can:
  - View payment records of any other user
  - Update payment statuses
  - Delete payment records
  - Toggle payment status
- **Impact:** Financial data breach, payment fraud, unauthorized refunds, data loss.
- **Recommended Fix:** Implement ownership checks (user can only see own payments) and role-based guards (admin for admin operations).

### 🟠 H-10: Stripe Payment Success Handler — Race Condition / Lack of Webhook Confirmation
- **File:** `src/app.ts` (lines 59-162)
- **Severity:** High
- **Description:** The `/payment/success` endpoint confirms payments by retrieving the Stripe session and updating booking status. This is a client-triggered endpoint. There is no webhook-based confirmation. If the client never reaches this URL (e.g., browser crash, network issue), the payment remains unconfirmed even though Stripe has processed it.
- **Impact:** Users may pay but never get their booking confirmed. Manual intervention required to reconcile payments. This is a business-critical reliability issue.
- **Recommended Fix:** Enable and implement the Stripe webhook handler (currently commented out). Use the webhook as the primary payment confirmation mechanism, with the success URL as a fallback.

### 🟡 M-10: Token Blacklist Missing on JWT Expiry Handling
- **File:** `src/app/middlewares/globalErrorHandler.ts` (lines 62-66)
- **Severity:** Medium
- **Description:** When a `TokenExpiredError` occurs, the error handler returns 401 but does NOT add the token to the blacklist. While expired tokens are technically invalid, maintaining a blacklist of expired tokens would aid in audit trails and prevent replay attacks in edge cases.
- **Impact:** Low direct impact, but auditing and token lifecycle management is incomplete.
- **Recommended Fix:** Optionally add expired tokens to a short-lived blacklist for audit purposes.

---

## 7. Infrastructure & Deployment (Medium/Low)

### 🟡 M-11: Docker Compose Exposes MongoDB on Non-Default Port Without Auth
- **File:** `docker-compose.yml` (lines 73-74)
- **Severity:** Medium
- **Description:** MongoDB is exposed on host port 27018 mapping to container port 27017. There is no authentication configured for MongoDB in the docker-compose — no `MONGO_INITDB_ROOT_USERNAME` or `MONGO_INITDB_ROOT_PASSWORD` environment variables are set.
- **Impact:** Any process on the host machine (or network if port 27018 is publicly exposed) can connect to MongoDB without authentication and read/write all data including PII and medical records.
- **Recommended Fix:** Enable MongoDB authentication by setting `MONGO_INITDB_ROOT_USERNAME` and `MONGO_INITDB_ROOT_PASSWORD`. Restrict port exposure to internal network only.

### 🟡 M-12: Docker Compose Exposes Redis on Non-Default Port Without Auth
- **File:** `docker-compose.yml` (lines 99-100)
- **Severity:** Medium
- **Description:** Redis is exposed on host port 6380 mapping to container port 6379. The `REDIS_PASSWORD` is optional (empty by default, line 110: `${REDIS_PASSWORD:-}`). If `REDIS_PASSWORD` is not set in `.env`, Redis starts without any authentication.
- **Impact:** Without a Redis password, any host-network process can connect to Redis and read/write cached data including session tokens, OTPs, and cached user data. OTPs and pending registrations are stored in Redis.
- **Recommended Fix:** Set a strong `REDIS_PASSWORD` in `.env`. Consider not exposing Redis ports to the host at all (remove the `ports` section) if only the app and worker containers need access via the Docker network.

### 🟢 L-03: Dockerfile Uses Slim Image But Installs openssl Each Stage
- **File:** `Dockerfile` (lines 5, 24)
- **Severity:** Low
- **Description:** Both the `deps` and `production` stages install openssl separately. This is redundant but not a security vulnerability per se. However, the `deps` stage does not clean apt cache, slightly increasing image size.
- **Impact:** Minimal. Slightly larger Docker images.
- **Recommended Fix:** Combine apt operations with && and add `rm -rf /var/lib/apt/lists/*` after installs.

---

## 8. Cryptographic & JWT Issues (Medium)

### 🟡 M-13: JWT Access Token Expiry Set to 7 Days (Excessively Long)
- **File:** `.env` (line 11)  
  `src/app/utils/generateToken.ts` (lines 3-13)
- **Severity:** Medium
- **Description:** Both `JWT_ACCESS_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN` are set to `"7d"` (7 days). Industry best practice for access tokens is 15-60 minutes. There is no separate refresh token mechanism being used — the "refresh" secret appears to be unused in the codebase.
- **Impact:** If an access token is stolen, the attacker can use it for up to 7 days before it expires. The window of compromise is excessively long.
- **Recommended Fix:** Reduce access token expiry to 15 minutes, implement a proper refresh token with longer expiry (7 days) for session continuation.

### 🟢 L-04: HS256 Algorithm Used for JWT Signing
- **File:** `src/app/utils/generateToken.ts` (line 9)
- **Severity:** Low
- **Description:** JWT tokens are signed using HMAC-SHA256 (HS256). While not inherently broken, HS256 is symmetric — the same secret is used to sign and verify. If the secret is compromised, attackers can forge tokens. RS256 (asymmetric) is preferred for production systems.
- **Impact:** Low risk if the secret is properly protected. Higher risk given the secret exposure issues (C-01 through C-03).
- **Recommended Fix:** Consider migrating to RS256 (RSASSA-PKCS1-v1_5 with SHA-256) for stronger key management.

---

## 9. Code Quality & Error Handling (Low)

### 🟢 L-05: Console Log Statements in Production Code
- **File:** Multiple files including:
  - `src/app/modules/Auth/Auth.controller.ts` (lines 106, 115, 120)
  - `src/app/modules/Auth/Auth.service.ts` (line 809)
  - `src/app/utils/fileUploader.ts` (lines 90, 134, 222, 314)
  - `src/shared/index.ts` (line 113)
- **Severity:** Low
- **Description:** Multiple `console.log` and `console.error` statements are present throughout the codebase. These can leak sensitive information (OAuth state, redirect URLs, error details) to stdout/stderr in production.
- **Impact:** Low direct security impact, but may leak debugging information. Also impacts log hygiene.
- **Recommended Fix:** Remove `console.log` statements from production code. Replace `console.error` with the structured `logger` utility already available in the project.

### 🟢 L-06: `catchAsync` Not Used Consistently
- **File:** Various route files
- **Severity:** Low
- **Description:** Some async route handlers use `catchAsync` wrapper, while others may not or may throw errors in the route definition itself. Missing `catchAsync` can cause unhandled promise rejections.
- **Impact:** Potential server crashes from unhandled async errors in routes not wrapped with `catchAsync`.
- **Recommended Fix:** Audit all route handlers and ensure they use `catchAsync`.

---

## Prioritized Action List

### Immediate (Critical — Fix within 24 hours)
| # | Issue | ID | Action |
|---|-------|----|--------|
| 1 | Add `.env` to `.gitignore` | C-01 | Add `.env` to `.gitignore` immediately |
| 2 | Rotate ALL exposed credentials | C-02, C-03 | Rotate MongoDB, Stripe, Cloudinary, Brevo, Google, DigitalOcean, ZenexCloud credentials |
| 3 | Remove live keys from `.env.example` | C-02 | Replace with placeholder values |
| 4 | Check git history for `.env` commits | C-04 | Run `git filter-repo` if committed |
| 5 | Remove malicious `os` npm package | C-05 | Uninstall `os` package, use built-in Node `os` module |

### High Priority (Fix within 1 week)
| # | Issue | ID | Action |
|---|-------|----|--------|
| 6 | Add role-based access to payment routes | H-01, H-09 | Restrict payment routes with role + ownership checks |
| 7 | Implement Stripe webhook handler | H-02 | Enable the commented-out webhook handler |
| 8 | Require OTP verification in reset password | H-03 | Add OTP check before allowing password reset |
| 9 | Add authorization to hard delete booking | H-04 | Restrict to admin only, add audit log |
| 10 | Restrict user detail endpoint | H-05 | Remove `authOptional()`, require auth for PII |
| 11 | Fix Facebook OAuth double response | H-06 | Remove `sendResponse` before redirect |
| 12 | Add token blacklist on logout | H-07 | Call token blacklist function in logout |
| 13 | Update `jsonwebtoken` to patched version | H-11 | Pin latest patched version or migrate to `jose` |
| 14 | Evaluate Express 5 stability for production | H-12 | Consider reverting to Express 4.x stable |

### Medium Priority (Fix within 2 weeks)
| # | Issue | ID | Action |
|---|-------|----|--------|
| 15 | Reduce JWT access token expiry | M-13 | Set to 15 minutes, implement refresh tokens |
| 16 | Hash default driver passwords | M-04 | Use bcrypt, force password change |
| 17 | Fix OAuth token exposure in redirect URL | M-05 | Use httpOnly cookie instead of URL parameter |
| 18 | Enable Redis password in Docker | M-12 | Set strong `REDIS_PASSWORD` |
| 19 | Enable MongoDB auth in Docker | M-11 | Set root credentials |
| 20 | Fix ZenexCloud HTTP endpoint | M-08 | Use HTTPS |
| 21 | Sanitize query/params in Express 5 | M-01 | Implement custom sanitization for read-only props |
| 22 | Add CORS environment-based origins | M-07 | Load origins from env, exclude localhost in production |
| 23 | Add bcrypt 72-byte max length validation | M-14 | Reject passwords exceeding 72 bytes in Zod schemas |
| 24 | Move `ts-node-dev` to devDependencies | M-15 | Move from `dependencies` to `devDependencies` |

### Low Priority (Fix within 1 month)
| # | Issue | ID | Action |
|---|-------|----|--------|
| 25 | Clean up console.log statements | L-05 | Use structured logger |
| 26 | Add audit for catchAsync usage | L-06 | Ensure all routes are wrapped |
| 27 | Clean Dockerfile apt cache | L-03 | Add cache cleanup |
| 28 | Consider RS256 for JWT | L-04 | Migration to asymmetric signing |
| 29 | Review Prisma error message exposure | H-08 | Filter database details from error responses |
| 30 | Move `prisma` & `@prisma/internals` to devDependencies | L-07 | Only `@prisma/client` needed at runtime |

---

## Footer

This audit was performed as a read-only analysis. No code modifications were made. All recommendations should be reviewed and approved by the development team before implementation. Credential rotation should be treated as the highest priority due to the exposure of live production secrets.