# MedComply — Multi-Tenant Medical Compliance Platform  (https://api.homify.barkatullah.dev)

> **Enterprise-grade multi-tenant backend** for medical compliance management — connecting patients, clinics, organizers, and administrators in a unified ecosystem with secure document handling, real-time communication, and intelligent scheduling.

---

## Objective

Build a scalable, secure, and role-driven platform that streamlines medical compliance workflows across multiple tenants. The system enables:

- **Patients** to book medical compliance services, manage records, and track appointments.
- **Clinics** to manage availability, time slots, services, and patient bookings.
- **Organizers** to coordinate bulk driver/patient compliance requests across clinics.
- **Admins** to oversee users, locations, services, payments, and system health.
- **Super Admins** to configure global settings, roles, and audit trails.

---

## Tech Stack

| Category       | Technologies |
|----------------|-------------|
| **Runtime**    | Node.js, TypeScript |
| **Framework**  | Express 5.x |
| **Database**   | MongoDB (via Prisma 6.x ORM) |
| **Validation** | Zod 3.x |
| **Auth**       | JSON Web Token, bcrypt, OAuth 2.0 (Google, Facebook) |
| **Cache**      | Redis (ioredis) — token blacklist, user cache, version-based invalidation |
| **Queue**      | BullMQ — background email/OTP processing, queue monitoring (Bull Board) |
| **File Upload**| Multer, Cloudinary, AWS S3 SDK, DigitalOcean Spaces, ZenexCloud (MinIO) |
| **Payments**   | Stripe SDK |
| **Real-time**  | WebSocket (ws), Socket.io, Firebase Cloud Messaging |
| **Email**      | Nodemailer (SMTP, Brevo, Mailtrap) |
| **Security**   | CORS, Rate Limiting, XSS Sanitization, HTTP Compression |
| **Dev Tools**  | ESLint, Prettier, ts-node-dev, Prisma Studio |

### Key Packages

```
express@^5.1.0        @prisma/client@^6.9.0   mongodb@^6.17.0
zod@^3.25.67          jsonwebtoken@^9.0.2      bcrypt@^6.0.0
ioredis@^5.11.1       bullmq@^5.80.9           stripe@^18.5.0
socket.io@^4.8.1      ws@^8.18.3               firebase-admin@^14.2.0
nodemailer@^9.0.3     cloudinary@^2.9.0        multer@^2.0.1
@aws-sdk/client-s3@^3.835.0                    axios@^1.13.6
```

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    Client Applications                     │
│    (Web App · Mobile App · Third-party Integrations)      │
└─────────────────────────┬─────────────────────────────────┘
                          │ HTTPS / WebSocket
┌─────────────────────────▼─────────────────────────────────┐
│                    API Gateway (Express 5)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │  Auth    │ │  Rate    │ │ Sanitize │ │  Request     │ │
│  │Middleware│ │  Limiter │ │          │ │  Context     │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
└─────────────────────────┬─────────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────────┐
│                    Application Layer                        │
│  ┌──────────────────────────────────────────────────────┐ │
│  │   Modules: Auth · User · Service · Booking · Slot    │ │
│  │   Payment · MedicalRecord · Organizer · Notification │ │
│  │   Ticket · Analytics · FAQ · Privacy · Terms         │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌────────────┐ ┌────────────┐ ┌──────────────────────┐  │
│  │  Prisma    │ │   Redis    │ │   BullMQ Workers     │  │
│  │  ORM       │ │   Cache    │ │   (Email, OTP)       │  │
│  └────────────┘ └────────────┘ └──────────────────────┘  │
└─────────────────────────┬─────────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────────┐
│                    Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │   MongoDB    │  │    Redis     │  │  S3 / Cloudinary  │ │
│  │ (Primary DB) │  │ (Cache/Queue)│  │ (File Storage)   │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
src/
├── server.ts                         # Entry point (HTTP + WebSocket)
├── app.ts                            # Express application setup
├── config/index.ts                   # Environment configuration
├── shared/index.ts                   # Shared middleware, rate-limiters, health check
├── app/
│   ├── routes/index.ts               # Central route aggregator
│   ├── middlewares/                   # Auth, validation, sanitization, error handling
│   ├── utils/                        # Prisma client, JWT helpers, mailer, logger
│   ├── errors/                       # Custom error classes & Zod error formatter
│   ├── interfaces/                   # TypeScript interfaces & type augmentations
│   ├── constants/                    # Application-wide constants
│   ├── builder/                      # Prisma query builder (search, filter, sort, paginate)
│   ├── helpers/                      # WebSocket, BullMQ workers, queue management
│   ├── db/                           # Database seeder (super admin, admin)
│   └── modules/                      # Feature modules
│       ├── Auth/                     # Authentication & OAuth
│       ├── User/                     # User management
│       ├── service/                  # Clinic services
│       ├── booking/                  # Appointment booking
│       ├── timeSlot/                 # Time slot & availability
│       ├── Payment/                  # Payment processing (Stripe)
│       ├── paymethod/               # Payment method configuration
│       ├── location/                # Location management
│       ├── medicalRecord/           # Medical document handling
│       ├── organizerRequest/        # Bulk organizer requests
│       ├── Notifications/           # Push, SSE, in-app notifications
│       ├── ticket/                  # Support ticket system
│       ├── analytics/               # Role-based dashboards
│       └── all/                     # FAQ, Privacy, Terms
```

---

## Features by Role

### 👤 User (Patient / Driver)
- Register & manage profile (email/phone verification via OTP)
- OAuth login (Google, Facebook)
- Browse clinics & services by location
- Book appointments & manage bookings
- Upload & track medical compliance records
- Receive real-time notifications
- Raise support tickets
- View booking history & payment receipts

### 🏥 Clinic
- Manage clinic profile, services, and locations
- Configure availability & recurring time slots
- View & manage patient bookings (confirm, reschedule, cancel)
- Upload medical examination results
- Manage off-days & capacity
- View analytics dashboard

### 📋 Organizer
- Request bulk compliance checks for drivers/patients
- Assign drivers to clinic appointments
- Track compliance status across all assigned personnel
- View organizer-level reports & analytics
- Manage organizer-specific dashboard

### 🔧 Admin
- Full user management (create, update, suspend, delete)
- Manage services, locations, and payment methods
- Configure system-wide settings (FAQ, Privacy, Terms)
- Monitor all bookings, payments, and medical records
- View global analytics & audit logs
- Manage support tickets & assignment

### ⚙️ Super Admin
- All Admin permissions
- Create & manage admin accounts
- System-wide configuration
- Access to audit trails & error tracking
- Payment gateway configuration

---

## Environment Variables

```env
# ─── Application ───
NODE_ENV=development
PORT=5002

# ─── Database ───
DATABASE_URL=mongodb://localhost:27017/medcomply

# ─── Authentication ───
SUPER_ADMIN_PASSWORD=123456
BCRYPT_SALT_ROUNDS=12
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_ACCESS_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="7d"

# ─── Email (SMTP / Brevo / Mailtrap) ───
OWN_MAIL=
OWN_MAIL_PASS=
BREVO_MAIL=
BREVO_MAIL_PASS=
MAILTRAP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_PORT=587
MAILTRAP_USER=
MAILTRAP_PASSWORD=

# ─── File Storage (Cloudinary / S3 / MinIO) ───
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
DO_SPACE_REGION=
DO_SPACE_BUCKET=
DO_SPACE_ENDPOINT=
DO_SPACE_ACCESS_KEY=
DO_SPACE_SECRET_KEY=
ZENEX_ENDPOINT=
ZENEX_ACCESS_KEY=
ZENEX_SECRET_KEY=
ZENEX_BUCKET=

# ─── Payments ───
STRIPE_PUBLISHED_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK=

# ─── OAuth ───
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:5002/api/v1/auth/google/callback
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_CALLBACK_URL=http://localhost:5002/api/v1/auth/facebook/callback

# ─── URLs ───
BASE_URL_CLIENT=http://localhost:3000
BASE_URL_SERVER=http://localhost:5002
```

> Copy `.env.example` → `.env` and fill in your values.

---

## Setup

### Prerequisites
- **Node.js** ≥ 18.x
- **MongoDB** (local or Atlas)
- **Redis** (local or cloud — required for caching & BullMQ)
- **npm** or **yarn**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/medcomply.git
cd medcomply

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 4. Generate Prisma client & push schema
npx prisma generate
npx prisma db push

# 5. Seed default data
# (Super admin & payment methods are auto-seeded on first run)

# 6. Start development server
npm run dev
```

Server starts at **http://localhost:5002**.

### Available Scripts

| Command                | Description                                    |
|------------------------|------------------------------------------------|
| `npm run dev`          | Start dev server with hot-reload               |
| `npm run build`        | Compile TypeScript & generate Prisma client    |
| `npm start`            | Run production build                           |
| `npm run pm`           | Run Prisma migrations                          |
| `npm run pg`           | Regenerate Prisma client                       |
| `npm run generate`     | Scaffold a new CRUD module                     |
| `npm run lint:check`   | Run ESLint                                     |
| `npm run lint:fix`     | Auto-fix ESLint issues                         |
| `npm run prettier:fix` | Format code with Prettier                      |

### Docker (Optional)

```bash
docker-compose up -d
```

Spins up three services:
- **app** — API server
- **worker** — BullMQ background job processor
- **redis** — Cache & queue broker

---

## API Overview

Base URL: `http://localhost:5002/api/v1`

### Core Modules

| Module            | Prefix               | Auth Required |
|-------------------|----------------------|:-------------:|
| Auth              | `/auth`              | Partial       |
| User              | `/user`              | Yes           |
| Services          | `/services`          | Mixed         |
| Bookings          | `/bookings`          | Yes           |
| Time Slots        | `/timeslots`         | Yes           |
| Payments          | `/payments`          | Yes           |
| Payment Methods   | `/method`            | Mixed         |
| Locations         | `/locations`         | Mixed         |
| Medical Records   | `/medical-records`   | Yes           |
| Organizer Requests| `/organizer-requests`| Yes           |
| Notifications     | `/notifications`     | Yes           |
| Support Tickets   | `/tickets`           | Yes           |
| Analytics         | `/analytics`         | Role-gated    |
| FAQ / Privacy / Terms | `/faq`, `/privacy`, `/terms` | Mixed |

### Authentication Flow

1. Register → Verify email via OTP → Login → Receive JWT access & refresh tokens
2. Pass JWT in `Authorization: Bearer <token>` header for protected routes
3. Token blacklisting on logout (Redis-backed)
4. OAuth options: Google & Facebook login

---

## Key Design Decisions

| Decision | Approach |
|----------|----------|
| **Multi-tenancy** | Role-based access control with self-referential `organizerId` on User model |
| **Performance** | Redis-first cache strategy with version-based invalidation & cache stampede protection |
| **Background Jobs** | BullMQ workers for email delivery & OTP cleanup — decouples I/O from request lifecycle |
| **File Storage** | Abstraction layer supports Cloudinary, AWS S3, DigitalOcean Spaces, & MinIO — swap via env vars |
| **Real-time** | WebSocket for messaging; SSE & Firebase FCM for notifications |
| **Security** | XSS sanitization, rate limiting, JWT blacklisting, request correlation tracing, audit logging |
| **DB Abstraction** | Prisma ORM with MongoDB provider — schema-first development with auto-generated types |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

ISC © [MedComply](LICENSE)

---

<p align="center">Built with TypeScript, Express, Prisma & ❤️</p>
