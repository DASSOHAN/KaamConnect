# KaamConnect

KaamConnect is a local-first informal workforce platform connecting customers with verified local workers across Nadia District and the Kalyani subdivision.

The project runs completely locally with **zero external dependencies**:
- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: Local SQLite via `better-sqlite3` (`server/database/kaamconnect.sqlite`)
- **Authentication**: HTTP-only cookie-based sessions with persistent SQLite session storage and `bcryptjs` password hashing

---

## Quick Start (How to Run)

### 1. Install Dependencies

From the project root (`KaamConnect/`):

```powershell
npm run install:all
```

Or install in each directory individually:
```powershell
npm install
npm install --prefix server
npm install --prefix client
```

### 2. Configure Environment Variables

The backend requires only two environment variables in `server/.env`:

```dotenv
PORT=5000
SESSION_SECRET=CgnWohh8NPl/tV2N/o3zKLHDsFOKuz3OGEHbEORxmE27GzzBVoc0pR4CLWPTmTuj
```

Copy the example file if setting up a fresh clone:
```powershell
Copy-Item server/.env.example server/.env
```

*(Note: Never commit `server/.env` or secrets to Git. The frontend requires no `.env` file because requests are proxied locally by Vite).*

### 3. Initialize & Seed Database (Optional)

The database automatically initializes and migrates when the server starts. You can also seed explicitly at any time:

```powershell
npm run seed
```

### 4. Run the Application

To run both backend (Express on port 5000) and frontend (Vite on port 5173) together:

```powershell
npm run dev
```

Or run them in separate terminals:
- **Terminal 1 (Backend)**:
  ```powershell
  npm run server
  ```
- **Terminal 2 (Frontend)**:
  ```powershell
  npm run client
  ```

Open your browser at: **`http://localhost:5173`**

---

## Pre-seeded Demo Accounts

For testing, the database includes pre-seeded demo accounts (all with password `KaamConnect@123`):

| Role | Email | Password | Phone |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@kaamconnect.test` | `KaamConnect@123` | `9876543210` |
| **Customer** | `customer1@kaamconnect.test` | `KaamConnect@123` | `9876500001` |
| **Customer** | `customer2@kaamconnect.test` | `KaamConnect@123` | `9876500002` |
| **Worker (Electrician)** | `subrata@kaamconnect.test` | `KaamConnect@123` | `9876600001` |
| **Worker (Plumber)** | `biplab@kaamconnect.test` | `KaamConnect@123` | `9876600002` |
| **Worker (Cleaner)** | `anjali@kaamconnect.test` | `KaamConnect@123` | `9876600005` |

You can also register brand new customer and worker accounts directly from the UI.

---

## Key Features

1. **Guest Browsing**:
   - Guests can freely browse the homepage, services catalog, fair wage rates, locations, worker listings, public ratings/reviews, and open job postings without logging in.
   - Private contact info, passwords, and private messages are never exposed to guests.

2. **Secure Authentication & Sessions**:
   - Registration with separate customer and worker onboarding flows.
   - Passwords hashed with `bcryptjs` (salt rounds >= 10).
   - Sessions stored persistently in SQLite (`sessions` table) using `express-session`.
   - Secure HTTP-only cookies with `SameSite: 'lax'` protection and CSRF token verification.
   - Login rate-limiting per IP/account to prevent brute force.

3. **Customer Capabilities**:
   - Book workers immediately or schedule for a specific date and time slot.
   - Post custom jobs with descriptions, urgency level, and estimated price ranges.
   - Review job offers from workers, accept offers, and track active bookings.
   - Private messaging with assigned workers.
   - Rate and review completed services.

4. **Worker Cockpit & Dashboard**:
   - Complete worker profile with trade, skills, hourly/daily rates, experience, and bio.
   - View open job requests matching their trade in Nadia/Kalyani.
   - Submit quotations and price offers on jobs.
   - Manage duty/availability status and active bookings.
   - Coordinate with customers via private in-app messaging.

5. **Admin Hub**:
   - View system message reports and moderation queue.
   - Moderate user accounts (suspend / reinstate).
   - Inspect conversations flagged for safety.

---

## Running Tests

To run the automated 20-point test suite verifying all endpoints, guest browsing, authentication, jobs, bookings, messaging, and SQLite persistence:

```powershell
npm test
```

---

## Database Architecture

The SQLite database file is stored at `server/database/kaamconnect.sqlite`.
Schema migrations are tracked with versioning in `schema_migrations`:
- `001_initial.sql`: Normalized schema with foreign keys, checks, indexes, and tables (`users`, `services`, `service_tasks`, `locations`, `workers`, `worker_skills`, `jobs`, `bookings`, `job_offers`, `reviews`, `conversations`, `conversation_participants`, `quotations`, `messages`, `message_reports`, `admin_action_logs`, `chat_rate_limits`, `auth_rate_limits`, `sessions`).
- `002_local_imports.sql`: Migration marker tracker for runtime data imports.
- `003_seed_demo_data.sql`: Seed data for demo admin, customers, workers, jobs, bookings, and reviews.
