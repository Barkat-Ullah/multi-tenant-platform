# MedComply — Multi-Tenant Medical Compliance Platform

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Express-5.1-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB-6.x-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Prisma-6.9-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Redis-ioredis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/BullMQ-5.8-FF6B6B?style=for-the-badge&logo=bull&logoColor=white" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Stripe-18.5-635BFF?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe" />
  <img src="https://img.shields.io/badge/License-ISC-blue?style=for-the-badge" alt="License" />
</p>

> **Enterprise-grade multi-tenant backend** for healthcare compliance, clinic scheduling, and bulk corporate medical operations. Connects patients, clinics, corporate organizers, and administrators in a unified, secure, real-time ecosystem.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Database Schema (ERD)](#-database-schema-erd)
- [Key Features by Role](#-key-features-by-role)
- [Tech Stack](#-tech-stack)
- [System Architecture](#-system-architecture)
- [Project Directory Structure](#-project-directory-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Overview](#-api-overview)
- [Architecture & Design Decisions](#-architecture--design-decisions)
- [Contributing & License](#-contributing--license)

---

## 🎯 Overview

**MedComply** is designed to eliminate fragmented medical compliance workflows by orchestrating bookings, medical document lifecycles, and multi-tenant clinic operations:

- **Patients / Drivers** — Discover certified clinics, book compliance appointments, securely upload medical histories, and track certification statuses.
- **Clinics & Medical Centers** — Manage custom services, operating hours, capacity slots, doctor availability, and issue digital medical examination records.
- **Corporate Organizers** — Coordinate bulk compliance initiatives for entire fleets or employee groups across distributed clinics with unified reporting.
- **System Admins & Super Admins** — Monitor platform health, manage locations and payment methods, review audit logs, and configure platform-wide settings.

---

## 📊 Database Schema (ERD)

The complete Entity Relationship Diagram (ERD) is modeled with MongoDB and Prisma ORM, supporting multi-tenancy, soft deletions, polymorphic references, and nested relational integrity.

<div align="center">

[![Open Interactive ERD in Lucidchart](https://img.shields.io/badge/📊_Open_Interactive_ERD-Lucidchart_Canvas-0075FF?style=for-the-badge&logo=lucid&logoColor=white)](https://lucid.app/lucidchart/32810b04-3f9f-4ea2-8a98-051f8d46050b/edit?view_items=Y6bnX-7dulNC&page=0_0&invitationId=inv_d4036be0-aa97-4e36-aa48-98166175f624)

<br/>

[![MedComply Database ERD Diagram](https://res.cloudinary.com/dqvxeyzat/image/upload/v1787374771/medical_hub__Lucidchart_wsvlez.png)](https://lucid.app/lucidchart/32810b04-3f9f-4ea2-8a98-051f8d46050b/edit?view_items=Y6bnX-7dulNC&page=0_0&invitationId=inv_d4036be0-aa97-4e36-aa48-98166175f624)

<p><em>Click the image or button above to explore the interactive diagram on Lucidchart.</em></p>

</div>

### 🧩 Core Data Models

| Schema Domain | Primary Entities | Description |
|:---|:---|:---|
| **Identity & Access** | `User`, `Account`, `Session`, `VerificationToken` | Multi-role authentication (Email/OTP, OAuth 2.0 Google/Facebook), RBAC, self-referential organizer assignments. |
| **Clinic & Logistics** | `Location`, `Service`, `TimeSlot`, `DaySchedule` | Multi-location clinics, service catalogs with dynamic pricing, recurring & date-specific slot scheduling. |
| **Appointments** | `Booking`, `BookingItem`, `StatusLog` | Multi-step booking lifecycle (Pending, Confirmed, Completed, Cancelled, Rescheduled). |
| **Medical Records** | `MedicalRecord`, `Attachment`, `Certificate` | Encrypted medical compliance documents, examination results, and compliance pass/fail tracking. |
| **Enterprise B2B** | `OrganizeRequest`, `AssignedDriver` | Bulk organizational booking requests, batch clinic assignment, and group compliance tracking. |
| **Financials** | `Payment`, `PaymentMethod`, `Invoice` | Stripe integration, multiple currency support, automated receipts, webhook handling. |
| **Engagement & Ops** | `Notification`, `Ticket`, `AuditLog`, `Faq` | Real-time push/WebSocket alerts, support ticketing, centralized immutable audit logs. |

---

## 👥 Key Features by Role

```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ 👤 Patient/User │   │   🏥 Clinic     │   │  📋 Organizer   │   │  🔧 Admin/Super │
├─────────────────┤   ├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ • OTP & OAuth   │   │ • Slot Matrix   │   │ • Bulk Requests │   │ • User Mgmt     │
│ • Clinic Search │   │ • Service Mgmt  │   │ • Fleet Assign  │   │ • Audit Trails  │
│ • Appt Booking  │   │ • Patient Queue │   │ • Group Reports │   │ • Finance Stats │
│ • Med Records   │   │ • Result Upload │   │ • Batch Status  │   │ • CMS & Config  │
│ • Live Alerts   │   │ • Analytics     │   │ • Org Dashboard │   │ • Ticket Desk   │
└─────────────────┘   └─────────────────┘   └─────────────────┘   └─────────────────┘
```

### 👤 User (Patient / Driver)
- **Profile & Auth:** Seamless registration with email/phone OTP verification and Google/Facebook OAuth.
- **Service Discovery:** Search and filter certified clinics by location, service type, and earliest availability.
- **Booking Management:** Real-time appointment scheduling, rescheduling, and cancellation with instant confirmation.
- **Digital Health Passport:** Upload, view, and download medical certificates and historical compliance documentation.
- **Omnichannel Alerts:** Real-time notifications for appointment reminders, status updates, and doctor notes.

### 🏥 Clinic / Provider
- **Availability Engine:** Granular weekly schedule management, recurring time slots, break windows, and off-day blackouts.
- **Service Catalog:** Custom medical compliance services, pricing, durations, and requirements.
- **Patient Queue & Intake:** View upcoming bookings, check in patients, and update appointment workflows in real time.
- **Medical Documentation:** Upload certified examination outcomes, lab reports, and doctor signatures directly to patient profiles.
- **Clinic Dashboard:** Real-time statistics on appointments, patient turnout, and revenue.

### 📋 Organizer (Corporate / Fleet)
- **Bulk Compliance Requests:** Submit bulk medical compliance requests for hundreds of drivers/employees in a single submission.
- **Automated Driver Assignment:** Map drivers to preferred clinics and time slots across different locations.
- **Live Compliance Tracker:** Unified dashboard to monitor pending, completed, and expiring compliance statuses.
- **Batch Export:** Download group certification summaries and audit-ready compliance rosters.

### 🔧 Admin & ⚙️ Super Admin
- **Global User Management:** Manage permissions, activate/suspend accounts, and assign organizational roles.
- **System Governance:** Maintain global locations, active services, supported payment methods, FAQs, Terms, and Privacy policies.
- **Financial Control:** Live tracking of transactions, refunds, and Stripe payment gateway settings.
- **Security & Auditing:** Comprehensive immutable audit logs, request correlation tracking, and platform health telemetry.

---

## 🛠 Tech Stack

| Layer | Technologies | Highlights |
|:---|:---|:---|
| **Runtime & Language** | Node.js (≥18.x), TypeScript 5.8 | Type-safe development with strict type checking |
| **Web Framework** | Express 5.1.x | Next-gen Express routing, async error propagation |
| **Database & ORM** | MongoDB 6.x, Prisma 6.9.x | Split multi-file Prisma schemas, high-speed aggregation |
| **Caching & Invalidation** | Redis (ioredis 5.11) | JWT token blacklisting, user cache, stampede protection |
| **Queue & Background Jobs** | BullMQ 5.80 + Bull Board | Asynchronous email dispatch, OTP lifecycle, queue monitoring |
| **Payments** | Stripe SDK (v18.5) | Webhook handling, multi-currency checkout, payment intent |
| **File Storage Engines** | Cloudinary, AWS S3, DO Spaces, MinIO | Multi-provider storage abstraction via unified Multer handler |
| **Real-time Engine** | WebSocket (ws 8.18), Socket.io 4.8, Firebase FCM | Instant messaging, live event feeds, and push notifications |
| **Validation & Security** | Zod 3.25, bcrypt, CORS, Rate Limiting | Request validation, XSS sanitization, HTTP payload compression |
| **Email Delivery** | Nodemailer (SMTP, Brevo, Mailtrap) | Templated HTML emails, automated password resets & OTPs |

---

## 🏛 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Client Applications                             │
│               (Patient Web · Clinic Portal · Mobile App · Admin)            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / WSS
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            API Gateway (Express 5)                          │
│   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐  │
│   │ Auth & RBAC   │ │ Rate Limiter  │ │ XSS Sanitizer │ │ Request ID    │  │
│   │ Middleware    │ │ (Redis-backed)│ │ & Compression │ │ Context Hook  │  │
│   └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                               Application Core                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │   Auth · User · Clinic · Service · Booking · TimeSlot · Location      │  │
│  │   MedicalRecord · OrganizerRequest · Payment · Ticket · Analytics     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│   ┌────────────────────────┬────────────────────────┬─────────────────────┐ │
│   │      Prisma ORM        │      Redis Cache       │   BullMQ Queues     │ │
│   │   (Query Builders)     │  (Token / Data Layer)  │  (Email & Workers)  │ │
│   └────────────────────────┴────────────────────────┴─────────────────────┘ │
└───────────────────┬─────────────────────┬─────────────────────┬─────────────┘
                    │                     │                     │
┌───────────────────▼───────┐ ┌───────────▼───────────┐ ┌───────▼─────────────┐
│       MongoDB Cluster     │ │      Redis Instance   │ │  Object Storage     │
│   (Persistent Storage)    │ │   (Cache / PubSub)    │ │  (S3/Cloudinary)    │
└───────────────────────────┘ └───────────────────────┘ └─────────────────────┘
```

---

## 📂 Project Directory Structure

```
multi-tenant-platform/
├── prisma/                           # Multi-file Prisma schema directory
│   ├── schema.prisma                 # Generator, datasource, global enums, common models
│   ├── user.prisma                   # User & Account models
│   ├── booking.prisma                # Booking & schedule entities
│   ├── service.prisma                # Service catalog
│   ├── location.prisma               # Clinic locations
│   ├── medicalRecord.prisma          # Medical documents & examination records
│   ├── payment.prisma                # Transactions & payment records
│   ├── OrganizeRequest.prisma        # B2B bulk request management
│   ├── message.prisma                # Chat & messaging
│   ├── notification.prisma           # In-app & push notifications
│   ├── ticket.prisma                 # Support ticketing
│   └── auditLog.prisma               # System audit logging
├── src/
│   ├── server.ts                     # Server bootstrap (HTTP + WebSocket server)
│   ├── app.ts                        # Express application configuration & pipeline
│   ├── config/                       # Typed environment configuration
│   ├── shared/                       # Global middleware, health check, rate limiters
│   └── app/
│       ├── builder/                  # Dynamic Prisma query builder (search, filter, sort)
│       ├── constants/                # Enums, roles, and static definitions
│       ├── db/                       # Auto-seeder (Super Admin, default settings)
│       ├── errors/                   # Custom AppError & Zod validation formatters
│       ├── helpers/                  # WebSocket manager, BullMQ workers & queues
│       ├── interfaces/               # Shared TypeScript types & Express augmentations
│       ├── middlewares/              # Auth guard, RBAC, file uploaders, sanitizers
│       ├── routes/                   # Central modular route aggregator
│       ├── utils/                    # JWT, bcrypt, mailer, and logger utilities
│       └── modules/                  # Encapsulated feature domains
│           ├── Auth/                 # Authentication, OTP, OAuth
│           ├── User/                 # User CRUD & profile management
│           ├── service/              # Clinic medical service management
│           ├── booking/              # Appointment lifecycle & reservations
│           ├── timeSlot/             # Availability schedules & time slot generator
│           ├── location/             # Clinic branch & location management
│           ├── medicalRecord/        # Medical record creation & document uploads
│           ├── organizerRequest/     # B2B bulk request workflow
│           ├── Payment/              # Stripe checkout & webhook processing
│           ├── paymethod/            # Payment gateway configurations
│           ├── Notifications/        # Notification dispatchers
│           ├── ticket/               # Support tickets & resolution
│           ├── analytics/            # Role-specific analytics aggregations
│           └── all/                  # FAQ, Privacy Policy, Terms & Conditions
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your local environment:
- **Node.js** (v18.0.0 or higher)
- **MongoDB** (Local instance or MongoDB Atlas URI)
- **Redis** (Local instance or Cloud Redis)
- **npm** or **yarn**

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/multi-tenant-platform.git
cd multi-tenant-platform

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Open .env and configure your database, Redis, and API keys

# 4. Generate Prisma Client & push schema to MongoDB
npx prisma generate
npx prisma db push

# 5. Start the development server
npm run dev
```

The server will be running at **`http://localhost:5002`**.

### 📜 Available Scripts

| Command | Purpose |
|:---|:---|
| `npm run dev` | Start development server with hot reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` and generate Prisma client |
| `npm start` | Run the compiled production server from `dist/server.js` |
| `npm run pg` | Regenerate Prisma client from multi-file schema |
| `npm run pm` | Run Prisma migrations |
| `npm run generate` | Scaffold a new boilerplate CRUD module |
| `npm run lint:check` | Check codebase for ESLint violations |
| `npm run lint:fix` | Automatically fix ESLint errors |
| `npm run prettier:fix`| Format files across the project with Prettier |

### 🐳 Docker Deployment (Optional)

Run the full stack (API, Worker, Redis) with a single command:

```bash
docker-compose up -d --build
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory and configure the following parameters:

```env
# ─── Application Configuration ───
NODE_ENV=development
PORT=5002
BASE_URL_CLIENT=http://localhost:3000
BASE_URL_SERVER=http://localhost:5002

# ─── Database & Cache ───
DATABASE_URL="mongodb+srv://<username>:<password>@cluster.mongodb.net/medcomply?retryWrites=true&w=majority"
REDIS_URL=redis://127.0.0.1:6379

# ─── Security & Authentication ───
SUPER_ADMIN_PASSWORD=your_secure_password
BCRYPT_SALT_ROUNDS=12
JWT_ACCESS_SECRET=your_super_secret_jwt_access_key
JWT_REFRESH_SECRET=your_super_secret_jwt_refresh_key
JWT_ACCESS_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# ─── OAuth 2.0 ───
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5002/api/v1/auth/google/callback
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_CALLBACK_URL=http://localhost:5002/api/v1/auth/facebook/callback

# ─── Email Dispatchers ───
OWN_MAIL=support@medcomply.com
OWN_MAIL_PASS=your_email_password
BREVO_MAIL=
BREVO_MAIL_PASS=
MAILTRAP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_PORT=587
MAILTRAP_USER=
MAILTRAP_PASSWORD=

# ─── Cloud File Storage (Cloudinary / S3 / Spaces / MinIO) ───
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ─── Stripe Payments ───
STRIPE_PUBLISHED_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK=whsec_...
```

---

## 🔌 API Overview

All endpoints are versioned and exposed under the base route: **`/api/v1`**

```
Base URL: http://localhost:5002/api/v1
```

| Module | Route Prefix | Auth Required | Description |
|:---|:---|:---:|:---|
| **Auth** | `/auth` | Public / Bearer | Registration, OTP verification, login, password reset, OAuth |
| **User** | `/user` | Bearer | Profile management, role assignment, user status updates |
| **Services** | `/services` | Mixed | Medical compliance service listings and clinic offerings |
| **Bookings** | `/bookings` | Bearer | Appointment reservations, status tracking, cancellations |
| **Time Slots** | `/timeslots` | Mixed | Clinic weekly schedules, slot generation, availability checks |
| **Locations** | `/locations` | Public / Admin | Clinic branches, addresses, contact details |
| **Medical Records** | `/medical-records` | Bearer | Medical examination documents, compliance certificates |
| **Organizer** | `/organizer-requests` | Bearer (Organizer/Admin) | Bulk compliance requests and driver assignment |
| **Payments** | `/payments` | Bearer | Stripe checkout session creation & transaction history |
| **Payment Methods**| `/method` | Admin | Active payment gateway configuration |
| **Notifications** | `/notifications` | Bearer | In-app alerts, read status toggling, push notifications |
| **Support Tickets**| `/tickets` | Bearer | Customer support ticket creation and resolution |
| **Analytics** | `/analytics` | Role-Gated | Dashboard statistics for clinics, organizers, and admins |
| **CMS** | `/faq`, `/privacy`, `/terms` | Mixed | FAQs, Privacy Policies, Terms & Conditions |

---

## ⚡ Architecture & Design Decisions

### 1. Multi-Tenancy & Role-Based Access Control
The platform employs a role-driven hierarchical architecture (`SuperAdmin`, `Admin`, `Clinic`, `Organizer`, `User`). Organizational requests are scoped to organizers via relational IDs, isolating fleet data while allowing clinics to service multi-tenant batches seamlessly.

### 2. High-Throughput Redis Caching & Token Blacklisting
- **Token Invalidation:** Revoked JWT tokens are recorded in Redis with an auto-expiring TTL on logout.
- **Cache Stampede Prevention:** Versioned cache keys prevent stale reads while caching high-traffic endpoints (services, locations, schedules).

### 3. Background Job Queue (BullMQ)
Heavy operations such as multi-recipient notification emails, OTP generation, and bulk organizer status recalculations are offloaded to BullMQ Redis queues, keeping API response latencies minimal.

### 4. Storage Engine Abstraction
The file upload layer dynamically routes uploads through a unified interface supporting **Cloudinary**, **AWS S3**, **DigitalOcean Spaces**, or **MinIO** based on environment settings.

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **ISC License**.

<p align="center">
  <sub>Built with ❤️ for scalable healthcare compliance operations.</sub>
</p>
