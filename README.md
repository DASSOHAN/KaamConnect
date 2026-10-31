# 🛠️ KaamConnect — Hyperlocal Informal Workforce Platform

> **Connecting verified blue-collar professionals with households across Kalyani and the Nadia District, West Bengal.**

KaamConnect is a full-stack, local-first workforce marketplace designed to empower local electricians, plumbers, carpenters, cleaners, masons, and technicians with transparent pricing, instant bookings, direct messaging, and verifiable reviews.

The entire application runs as a **single unified full-stack service** with **zero external cloud dependencies** (pure local SQLite, Express REST API, and React 19 frontend).

---

## 📑 Table of Contents
- [✨ Key Features](#-key-features)
- [🏗️ Architecture & Tech Stack](#️-architecture--tech-stack)
- [📁 Project Structure](#-project-structure)
- [🚀 Quick Start (Setup & Run)](#-quick-start-setup--run)
- [🔑 Demo Credentials](#-demo-credentials)
- [🔌 API Overview](#-api-overview)
- [🧪 Testing & Verification](#-testing--verification)
- [🤝 Collaborative Sync Tools](#-collaborative-sync-tools)

---

## ✨ Key Features

### 1. ⚡ Hyperlocal Service Discovery & Booking
* **Transparent Fair-Wage Pricing**: Clear daily, half-day, and task-specific rates to eliminate arbitrary pricing disputes.
* **Flexible Bookings**: Choose between **Immediate Emergency Dispatch** or **Scheduled Time-Slot Booking**.
* **Live Service Status Tracking**: Track order progress from `pending` ➔ `accepted` ➔ `en_route` ➔ `in_progress` ➔ `completed`.

### 2. ❄️ Home Electronics Care & Appliance Diagnostics
* Dedicated booking module for household appliances:
  * Air Conditioners (AC), Refrigerators, Washing Machines
  * Water Purifiers (RO), Microwave Ovens, Geysers / Heaters
  * Kitchen Chimneys, Inverters / UPS, and Induction Cooktops
* Provides upfront provisional estimates or quotation-based diagnosis with verified local technicians.

### 3. 💬 Secure In-App Communication & Quotations
* **Real-time Messaging**: Customer and worker messaging with image attachments (workplace photos, part receipts).
* **Smart Safety Filters**: Automated redaction and admin alerts for premature off-platform contact sharing.
* **Formal Quotations**: Workers submit formal labour, material, and travel itemized quotations directly in chat for customer approval.

### 4. 👷 Worker Workspace & Job Board
* Custom dashboard for local tradespeople to manage active bookings, update daily availability, toggle duty status, and complete KYC verification.
* Community Job Board where workers view and bid on localized customer job postings matching their trade.

### 5. 🛡️ Admin Moderation & Community Safety
* Dedicated admin oversight panel for message review, flagged contact attempts, and user suspension/reinstatement.
* Database integrity checks and automated security token tracking.

---

## 🏗️ Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────┐
│                   Unified Full-Stack App               │
│                  http://localhost:5000                 │
├───────────────────────────┬────────────────────────────┤
│       Frontend (SPA)      │        Backend (API)       │
│  React 19 + Vite + Tailwind│      Express 4 + Node.js   │
│   Client-side routing     │     REST API & Static Host │
└─────────────┬─────────────┴──────────────┬─────────────┘
              │                            │
              ▼                            ▼
      Browser Client                 SQLite Database
 (Single-Origin, No CORS)       (WAL Mode, Foreign Keys)
```

* **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons, React Router.
* **Backend**: Node.js, Express.js.
* **Database**: Local SQLite via `better-sqlite3` with Write-Ahead Logging (WAL) and strict relational integrity.
* **Authentication**: HTTP-only session cookies with SQLite persistent storage (`express-session`) and `bcryptjs` password hashing.
* **Hosting**: **Unified** — Express serves the React SPA static build and handles all `/api/*` requests on one single port (`5000`).

---

## 📁 Project Structure

```text
KaamConnect/
├── client/                     # Active React Frontend
│   ├── src/
│   │   ├── components/         # UI components (Header, BookingModal, HomeElectronicsCare, etc.)
│   │   ├── contexts/           # Authentication state (AuthProvider)
│   │   ├── hooks/              # Custom React hooks (useAuth)
│   │   ├── services/           # API client (api.js)
│   │   └── utils/              # Translations, categorization, helpers
│   ├── index.html              # Frontend HTML entry point
│   ├── package.json            # Client dependencies (React, Vite, Tailwind)
│   └── vite.config.js          # Vite build configuration
├── server/                     # Active Express Backend
│   ├── database/
│   │   ├── migrations/         # SQL schema migrations (001, 002, 003 demo seed)
│   │   ├── sqlite.js           # Database client & Supabase-compatible ORM wrapper
│   │   └── session-store.js    # Persistent SQLite session store
│   ├── uploads/                # User uploaded worker avatars & chat attachments
│   ├── electronicsCare.js      # Electronics care appliance definitions & pricing logic
│   ├── index.js                # Express server entry point & REST endpoints
│   ├── package.json            # Server dependencies
│   └── test/                   # Automated 20-point test harness (run_test.js)
├── scripts/                    # Git auto-sync helper scripts
├── package.json                # Root package scripts (orchestrates full-stack lifecycle)
├── sync.bat                    # One-click collaborator sync utility
├── sync-watch.bat              # Background live-sync watcher (polls origin/main)
└── README.md                   # Project documentation
```

---

## 🚀 Quick Start (Setup & Run)

### 1. Prerequisites
* **Node.js** v18, v20, v22, or v24
* **Git**

### 2. Install Dependencies
Run the installation command from the project root:
```powershell
npm run install:all
```
*(This installs root, server, and client packages).*

### 3. Configure Environment Variables
Copy the template configuration into `server/.env`:
```powershell
Copy-Item server/.env.example server/.env
```

Ensure `server/.env` contains:
```dotenv
PORT=5000
SESSION_SECRET=kaamconnect_development_session_secret_key_2026_super_secure_32chars
```

### 4. Start the Application

#### Option A: Production / Unified Mode (Recommended)
Builds the client and starts the unified full-stack server on port 5000:
```powershell
npm start
```
👉 Open **`http://localhost:5000`** in your browser.

#### Option B: Live Development Mode (Auto-Rebuilding)
Runs the backend and watches frontend source files for live rebuilds:
```powershell
npm run dev
```
👉 Open **`http://localhost:5000`** in your browser.

#### Option C: Split Dev Mode (Standalone Vite Server)
If you prefer running separate terminals for backend and Vite HMR:
```powershell
npm run dev:split
```
* Backend API: `http://localhost:5000`
* Frontend Vite: `http://localhost:5173`

---

## 🔑 Demo Credentials

All pre-seeded demo accounts use the standard password: **`KaamConnect@123`**

| Role | Name | Email | Profession / Area |
| :--- | :--- | :--- | :--- |
| **Admin** | System Admin | `admin@kaamconnect.test` | Full Moderation Hub |
| **Customer** | Suman Chatterjee | `customer1@kaamconnect.test` | Kalyani Central Park |
| **Customer** | Priya Mukherjee | `customer2@kaamconnect.test` | Ghoshpara Station Rd |
| **Worker** | Subrata Das | `subrata@kaamconnect.test` | Electrician (Nadia) |
| **Worker** | Biplab Roy | `biplab@kaamconnect.test` | Plumber (Kalyani) |
| **Worker** | Anjali Mondal | `anjali@kaamconnect.test` | Home Cleaner (Kalyani Univ.) |

*You can also register new customer or worker accounts directly through the UI.*

---

## 🔌 API Overview

All API endpoints are prefixed with `/api` and return standard JSON `{ success: boolean, data?: any, message?: string }`:

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & SQLite integrity status | Public |
| `GET` | `/api/services` | Service categories and task rate cards | Public |
| `GET` | `/api/locations` | Supported areas across Nadia/Kalyani | Public |
| `GET` | `/api/workers` | Discoverable worker profiles & ratings | Public |
| `POST` | `/api/auth/register` | Register customer or worker account | Public |
| `POST` | `/api/auth/login` | Authenticate and create session | Public |
| `GET` | `/api/auth/me` | Current authenticated user profile | Authenticated |
| `GET` | `/api/electronics-care/catalog` | Appliance maintenance catalog & rates | Public |
| `POST` | `/api/electronics-care/bookings` | Book appliance care diagnosis | Customer |
| `GET` | `/api/jobs` | Public & customer job listings | Public / Authenticated |
| `POST` | `/api/jobs` | Post a localized service request | Customer |
| `POST` | `/api/jobs/:id/offers` | Submit worker quotation/offer | Worker |
| `GET` | `/api/conversations` | User conversations list | Authenticated |
| `POST` | `/api/conversations/:id/messages` | Send in-app chat message | Participant |
| `GET` | `/api/admin/message-reports` | View moderation queue & flagged chats | Admin |

---

## 🧪 Testing & Verification

The project includes an automated **20-point end-to-end integration test suite** that exercises every layer (guest browsing, auth, jobs, bookings, quotations, messaging, and database persistence):

```powershell
npm test
```

To run static linting across active code:
```powershell
npx oxlint client/src server
```

---

## 🤝 Collaborative Sync Tools

To prevent merge conflicts when collaborating on GitHub, helper sync tools are included:

* **One-Click Sync (`sync.bat`)**: Pulls remote commits cleanly using `git pull --rebase` while auto-stashing any local changes.
  ```powershell
  .\sync.bat
  ```
* **Continuous Watcher (`sync-watch.bat`)**: Polls `origin/main` in the background every 60 seconds and notifies you of collaborator pushes:
  ```powershell
  .\sync-watch.bat
  ```

---

## 📄 License
This project is open-source under the MIT License. Developed for the Kalyani and Nadia informal workforce community.
