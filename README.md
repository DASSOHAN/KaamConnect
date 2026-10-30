# KaamConnect

KaamConnect uses a React/Vite client and an Express API. When Supabase credentials are configured, Express reads and writes marketplace records in Supabase PostgreSQL. The Supabase secret/service key stays on the server. Without credentials, the original mock-backed worker and booking experience remains available; job posting and other database-only features return a friendly setup error.

## Supabase setup

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`server/database/schema.sql`](server/database/schema.sql).
3. Then run [`server/database/messaging.sql`](server/database/messaging.sql) to add account links, private conversations, messages, quotations, reports, rate limits, RLS and the private chat photo bucket.
4. Enable Email authentication in Supabase Auth. Copy `server/.env.example` to `server/.env` and enter the project URL and **secret/service** key. Never add these values to the React client or commit `server/.env`.
5. Copy [`client/.env.example`](client/.env.example) to `client/.env` and set `VITE_SUPABASE_URL` plus the project's **anon/publishable** key. The Supabase secret/service key must only be present in `server/.env`.
6. From the KaamConnect project directory install server dependencies and seed the current demo marketplace:

   ```powershell
   npm.cmd install --prefix server
   npm.cmd run seed --prefix server
   ```

7. Start both apps from the project directory:

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

## Private messaging setup and use

Messaging requires Supabase Auth accounts; legacy demo identities cannot access private conversations. Create a customer account and a worker account through **Sign in**. A worker must also register a worker profile while signed in. To enable an administrator, promote the intended user's `public.users.role` to `admin` in the Supabase SQL editor; admin promotion is never available through public signup.

Customers post a job from **Post a job**. A worker signs in, opens **Available jobs**, and sends an offer. That creates the job conversation. The customer can review offers on the job details page and accept one, which creates a booking and connects it to the conversation. For regular bookings, the customer and assigned worker can open **Messages** from the booking. Photos use the private `chat-attachments` bucket and short lived signed URLs. Contact sharing checks run in Express and rejected text stays in the editor so it can be edited.

Run the SQL files once against the same Supabase project used by the server and browser. The repository does not include live project credentials, so real Auth, realtime delivery, storage policies, and database persistence still need verification against your project. Messages also refresh periodically as a fallback if a Realtime subscription cannot connect.

## Persistence check

After applying the schema and seed, start the backend and visit `http://localhost:5000/api/health`, `http://localhost:5000/api/services`, and `http://localhost:5000/api/workers`. Then use the UI/API to change worker duty or rates, create a booking or job, stop and restart the backend, and fetch the records again. The API health response indicates whether Supabase is configured. A live persistence check requires valid credentials for a Supabase project.

## Environment variables

The Express server reads these values from `server/.env`:

```dotenv
SUPABASE_URL=https://mgqejqdxpdiwdsqvmjpx.supabase.co
SUPABASE_SECRET_KEY=your_supabase_secret_key
PORT=5000
```

Keep `SUPABASE_SECRET_KEY` only in `server/.env`. It is ignored by Git and must never be added to client environment variables. The server also accepts the previous `SUPABASE_SERVICE_ROLE_KEY` variable name for existing deployments.

To verify the live server-to-Supabase connection, start the server and request `http://localhost:5000/api/health/supabase`. The route runs a read-only query against `public.users` and returns HTTP 200 only if that query succeeds; missing credentials, a network/API error, or a missing schema returns an explicit error response.
