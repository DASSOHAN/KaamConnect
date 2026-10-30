# KaamConnect

KaamConnect uses a React/Vite client and an Express API. When Supabase credentials are configured, Express reads and writes marketplace records in Supabase PostgreSQL. The service role key stays on the server. Without credentials, the original mock-backed worker and booking experience remains available; job posting and other database-only features return a friendly setup error.

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`server/database/schema.sql`](server/database/schema.sql).
3. Copy `server/.env.example` to `server/.env` and enter the project URL and **service role** key. Never add these values to the React client or commit `server/.env`.
4. From the KaamConnect project directory install server dependencies and seed the current demo marketplace:

   ```powershell
   npm.cmd install --prefix server
   npm.cmd run seed --prefix server
   ```

5. Start both apps from the project directory:

   ```powershell
   npm.cmd run dev
   ```

   Or run the backend and frontend in separate terminals with `npm.cmd run server` and `npm.cmd run client`.

The seed command can be run again safely. It preserves the existing service and task IDs used by the UI and maps the existing demo workers into UUID-backed database rows. It adds five fictional demo customers; all demo accounts use placeholder email-like phone identifiers, not real phone numbers.

## Useful commands

```powershell
npm.cmd install --prefix server
npm.cmd run seed --prefix server
npm.cmd run server
npm.cmd run client
npm.cmd run build
```

The Supabase schema includes users, workers, worker skills, services, service tasks, locations, jobs, job offers, bookings, and reviews. Worker ratings are recalculated by a PostgreSQL trigger after a review is inserted. Job photo upload is left as an extension point; `jobs.photo_url` is ready for a Supabase Storage URL.

## Persistence check

After applying the schema and seed, start the backend and visit `http://localhost:5000/api/health`, `http://localhost:5000/api/services`, and `http://localhost:5000/api/workers`. Then use the UI/API to change worker duty or rates, create a booking or job, stop and restart the backend, and fetch the records again. The API health response indicates whether Supabase is configured. A live persistence check requires valid credentials for a Supabase project.

## Environment variables

The Express server reads these values from `server/.env`:

```dotenv
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=5000
```
