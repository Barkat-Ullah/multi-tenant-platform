/**
 * ============================================================
 *  AUTH MODULE — API Endpoints Documentation (Postman Guide)
 * ============================================================
 *
 * Base URL: http://localhost:5002/api/v1/auth
 *
 * ────────────────────────────────────────────────────────────
 *  1. REGISTER (Redis-First — No DB Write Until OTP Verify)
 * ────────────────────────────────────────────────────────────
 *   POST /api/v1/auth/register
 *
 *   Purpose:
 *     User submits registration data. Data is stored in Redis (30-min TTL)
 *     with an OTP. No database write happens until OTP is verified.
 *     An OTP email is queued via BullMQ for async delivery.
 *
 *   Request Body (JSON):
 *     {
 *       "fullName": "John Doe",
 *       "email": "john@example.com",
 *       "password": "securePass123",
 *       "phoneNumber": "+1234567890",        // optional
 *       "role": "USER",                       // optional, defaults to "USER"
 *       "companyLocation": "New York, USA"    // required if role = "ORGINIZER"
 *     }
 *
 *   Allowed roles: "USER", "ORGINIZER"
 *
 *   Success Response (201 Created):
 *     {
 *       "success": true,
 *       "message": "Please check your email to verify your account...",
 *       "data": {
 *         "message": "Please check your email to verify your account...",
 *         "email": "john@example.com"
 *       }
 *     }
 *
 *   Error Scenarios:
 *     400 — companyLocation required for ORGINIZER
 *     409 — User already exists (in MongoDB)
 *     409 — Pending registration already exists (in Redis)
 *
 * ────────────────────────────────────────────────────────────
 *  2. VERIFY OTP (Pending Registration → Create User in DB)
 * ────────────────────────────────────────────────────────────
 *   POST /api/v1/auth/verify-email-with-otp
 *
 *   Purpose:
 *     Verifies the OTP sent to the user's email. If a pending registration
 *     exists in Redis, the user is created in MongoDB. For existing users
 *     (login OTP, forgot password), it verifies and marks email as verified.
 *
 *   Request Body (JSON):
 *     {
 *       "email": "john@example.com",
 *       "otp": "1234"
 *     }
 *
 *   Success Response (200 OK):
 *     {
 *       "success": true,
 *       "message": "Email verified successfully!",
 *       "data": {
 *         "message": "Email verified successfully!",
 *         "accessToken": "eyJhbGciOiJIUzI1NiIs...",
 *         "id": "665a1b2c3d4e5f6a7b8c9d0e",
 *         "name": "John Doe",
 *         "email": "john@example.com",
 *         "role": "USER"
 *       }
 *     }
 *
 *   Error Scenarios:
 *     400 — Invalid or expired OTP
 *     404 — User not found
 *
 * ────────────────────────────────────────────────────────────
 *  3. LOGIN WITH OTP
 * ────────────────────────────────────────────────────────────
 *   POST /api/v1/auth/login
 *
 *   Purpose:
 *     Existing user logs in with email and password. If email is not
 *     verified, an OTP is sent to the email. If verified, JWT returned.
 *
 *   Request Body (JSON):
 *     {
 *       "email": "john@example.com",
 *       "password": "securePass123"
 *     }
 *
 *   Success Response — Verified User (200 OK):
 *     {
 *       "success": true,
 *       "message": "User logged in successfully",
 *       "data": {
 *         "accessToken": "eyJhbGciOiJIUzI1NiIs...",
 *         "id": "665a1b2c3d4e5f6a7b8c9d0e",
 *         "name": "John Doe",
 *         "email": "john@example.com",
 *         "role": "USER",
 *         "isEmailVerified": true
 *       }
 *     }
 *
 *   Success Response — Unverified User (OTP Sent) (200 OK):
 *     {
 *       "success": true,
 *       "message": "Please check your email for the verification OTP.",
 *       "data": {
 *         "accessToken": null,
 *         "id": "...",
 *         "name": "John Doe",
 *         "email": "john@example.com",
 *         "role": "USER",
 *         "isEmailVerified": false
 *       }
 *     }
 *
 *   Error Scenarios:
 *     400 — Password incorrect
 *     401 — User not found
 *
 * ────────────────────────────────────────────────────────────
 *  4. RESEND OTP
 * ────────────────────────────────────────────────────────────
 *   POST /api/v1/auth/resend-verification-with-otp
 *
 *   Purpose:
 *     Resends a new OTP to the user's email. Works for both pending
 *     registrations (Redis) and existing users (MongoDB).
 *
 *   Request Body (JSON):
 *     {
 *       "email": "john@example.com"
 *     }
 *
 *   Success Response (200 OK):
 *     {
 *       "success": true,
 *       "message": "Verification OTP sent successfully",
 *       "data": {
 *         "message": "Verification OTP sent successfully..."
 *       }
 *     }
 *
 *   Error Scenarios:
 *     401 — User not found (not in DB and no pending registration in Redis)
 *     403 — User is suspended
 *
 * ────────────────────────────────────────────────────────────
 *  5. LOGOUT
 * ────────────────────────────────────────────────────────────
 *   POST /api/v1/auth/logout
 *
 *   Purpose:
 *     Clears the auth cookie. (Token blacklisting can be added later.)
 *
 *   Request Body: none
 *
 *   Success Response (200 OK):
 *     {
 *       "success": true,
 *       "message": "User Successfully logged out",
 *       "data": null
 *     }
 *
 * ────────────────────────────────────────────────────────────
 *  6. FORGOT PASSWORD
 * ────────────────────────────────────────────────────────────
 *   POST /api/v1/auth/forget-password
 *
 *   Purpose:
 *     Sends an OTP to the user's email for password reset.
 *     OTP is stored in Redis (5-min TTL) and email is queued via BullMQ.
 *
 *   Request Body (JSON):
 *     {
 *       "email": "john@example.com"
 *     }
 *
 *   Success Response (200 OK):
 *     {
 *       "success": true,
 *       "message": "Verification OTP has sent to email",
 *       "data": { "message": "OTP sent successfully" }
 *     }
 *
 *   Error Scenarios:
 *     400 — User is suspended
 *     401 — User not found
 *     409 — OTP already sent recently (rate-limited)
 *
 * ────────────────────────────────────────────────────────────
 *  7. RESET PASSWORD
 * ────────────────────────────────────────────────────────────
 *   POST /api/v1/auth/reset-password
 *
 *   Purpose:
 *     Resets the user's password after OTP verification.
 *
 *   Request Body (JSON):
 *     {
 *       "email": "john@example.com",
 *       "password": "newSecurePass456"
 *     }
 *
 *   Success Response (200 OK):
 *     {
 *       "success": true,
 *       "message": "Password Reset!",
 *       "data": null
 *     }
 *
 *   Error Scenarios:
 *     404 — User not found
 *
 * ────────────────────────────────────────────────────────────
 *  8. CHANGE PASSWORD (Authenticated)
 * ────────────────────────────────────────────────────────────
 *   POST /api/v1/auth/change-password
 *
 *   Headers:
 *     Authorization: Bearer <accessToken>
 *
 *   Purpose:
 *     Authenticated user changes their password (requires old password).
 *
 *   Request Body (JSON):
 *     {
 *       "oldPassword": "securePass123",
 *       "newPassword": "newSecurePass456"
 *     }
 *
 *   Success Response (200 OK):
 *     {
 *       "success": true,
 *       "message": "Password changed successfully",
 *       "data": { "message": "Password changed successfully!" }
 *     }
 *
 *   Error Scenarios:
 *     400 — Old password is incorrect
 *     401 — User not found
 *
 * ────────────────────────────────────────────────────────────
 *  9. GOOGLE OAUTH — Get Auth URL (Web)
 * ────────────────────────────────────────────────────────────
 *   GET /api/v1/auth/google?role=USER
 *
 *   Query Parameters:
 *     role: "USER" | "ORGINIZER" | "CLINIC"
 *
 *   Purpose:
 *     Redirects the user to Google's OAuth consent screen.
 *
 *   Response: 302 Redirect to Google OAuth URL
 *
 * ────────────────────────────────────────────────────────────
 *  10. GOOGLE OAUTH — Callback (Web)
 * ────────────────────────────────────────────────────────────
 *   GET /api/v1/auth/google/callback?code=<auth_code>&state=<state>
 *
 *   Purpose:
 *     Google redirects here after user consent. Exchanges code for
 *     tokens, creates/links user, and redirects to frontend with JWT.
 *
 *   Response: 302 Redirect to frontend
 *     {FRONTEND_BASE_URL}/auth/google/callback?token=<jwt>
 *
 * ────────────────────────────────────────────────────────────
 *  11. GOOGLE LOGIN — Token Based (Mobile)
 * ────────────────────────────────────────────────────────────
 *   POST /api/v1/auth/google-login
 *
 *   Purpose:
 *     Mobile apps send the Google ID token directly.
 *
 *   Request Body (JSON):
 *     {
 *       "token": "google-id-token-here"
 *     }
 *
 *   Success Response (200 OK):
 *     {
 *       "success": true,
 *       "message": "User logged in successfully",
 *       "data": {
 *         "user": { "id": "...", "fullName": "...", "email": "..." },
 *         "accessToken": "eyJhbGciOiJIUzI1NiIs..."
 *       }
 *     }
 *
 * ────────────────────────────────────────────────────────────
 *  12. FACEBOOK OAUTH — Get Auth URL (Web)
 * ────────────────────────────────────────────────────────────
 *   GET /api/v1/auth/facebook
 *
 *   Purpose:
 *     Redirects to Facebook's OAuth dialog.
 *
 *   Response: 302 Redirect to Facebook OAuth URL
 *
 * ────────────────────────────────────────────────────────────
 *  13. FACEBOOK OAUTH — Callback (Web)
 * ────────────────────────────────────────────────────────────
 *   GET /api/v1/auth/facebook/callback?code=<auth_code>
 *
 *   Purpose:
 *     Facebook redirects here after user consent.
 *
 *   Response: 302 Redirect to frontend
 *     {FRONTEND_BASE_URL}/auth/facebook/callback?token=<jwt>
 *
 * ────────────────────────────────────────────────────────────
 *  14. FACEBOOK LOGIN — Token Based (Mobile)
 * ────────────────────────────────────────────────────────────
 *   POST /api/v1/auth/facebook-login
 *
 *   Purpose:
 *     Mobile apps send the Facebook access token directly.
 *
 *   Request Body (JSON):
 *     {
 *       "token": "facebook-access-token-here"
 *     }
 *
 *   Success Response (200 OK):
 *     {
 *       "success": true,
 *       "message": "User logged in successfully",
 *       "data": {
 *         "user": { "id": "...", "fullName": "...", "email": "..." },
 *         "accessToken": "eyJhbGciOiJIUzI1NiIs..."
 *       }
 *     }
 *
 * ────────────────────────────────────────────────────────────
 *  COMMON ERROR RESPONSE FORMAT
 * ────────────────────────────────────────────────────────────
 *   {
 *     "success": false,
 *     "message": "Error description",
 *     "errorSources": [
 *       {
 *         "path": "/api/v1/auth/register",
 *         "message": "Specific error detail"
 *       }
 *     ],
 *     "stack": "Error stack trace (only in development)"
 *   }
 *
 * ────────────────────────────────────────────────────────────
 *  AUTH HEADERS FOR PROTECTED ROUTES
 * ────────────────────────────────────────────────────────────
 *   All routes protected by auth() middleware require:
 *     Authorization: Bearer <accessToken>
 *
 *   The auth middleware:
 *     1st request:  Checks DB → caches user data in Redis (1-hour TTL)
 *     2nd request+: Reads from Redis cache → ~95% faster
 *
 * ────────────────────────────────────────────────────────────
 *  OPTIMIZATION NOTES (Post-Refactor)
 * ────────────────────────────────────────────────────────────
 *   - Registration data lives in Redis (30-min TTL), not MongoDB
 *   - OTP stored in Redis (5-min TTL), not MongoDB
 *   - All emails are queued via BullMQ (async, non-blocking)
 *   - Auth middleware uses Redis cache (1-hour TTL) for user data
 *   - Zod validation enabled on login/ForgotPassword/ResetPassword
 */