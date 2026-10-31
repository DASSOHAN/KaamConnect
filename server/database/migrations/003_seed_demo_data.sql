-- 003_seed_demo_data.sql: Pre-seed demo users, workers, jobs, bookings, and reviews

-- Password hash for 'KaamConnect@123'
-- Generated using bcryptjs with 10 salt rounds: $2b$10$zi6gymLOmDtyX.MkUxmI7uDBB5FWZllFj8TWU423AKpIvZIR.pmba

-- 1. Admin account
INSERT OR IGNORE INTO users (id, full_name, email, phone, password_hash, role, is_suspended, language, locality, created_at, updated_at)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'System Admin',
  'admin@kaamconnect.test',
  '9876543210',
  '$2b$10$zi6gymLOmDtyX.MkUxmI7uDBB5FWZllFj8TWU423AKpIvZIR.pmba',
  'admin',
  0,
  'en',
  'Kalyani',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
);

-- 2. Demo Customers
INSERT OR IGNORE INTO users (id, full_name, email, phone, password_hash, role, is_suspended, language, locality, created_at, updated_at)
VALUES
(
  '11111111-0000-4000-8000-000000000001',
  'Suman Chatterjee',
  'customer1@kaamconnect.test',
  '9876500001',
  '$2b$10$zi6gymLOmDtyX.MkUxmI7uDBB5FWZllFj8TWU423AKpIvZIR.pmba',
  'customer',
  0,
  'bn',
  'Kalyani Central Park',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
),
(
  '11111111-0000-4000-8000-000000000002',
  'Priya Mukherjee',
  'customer2@kaamconnect.test',
  '9876500002',
  '$2b$10$zi6gymLOmDtyX.MkUxmI7uDBB5FWZllFj8TWU423AKpIvZIR.pmba',
  'customer',
  0,
  'bn',
  'Ghoshpara Station Rd',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
),
(
  '11111111-0000-4000-8000-000000000003',
  'Anirban Roy',
  'customer3@kaamconnect.test',
  '9876500003',
  '$2b$10$zi6gymLOmDtyX.MkUxmI7uDBB5FWZllFj8TWU423AKpIvZIR.pmba',
  'customer',
  0,
  'bn',
  'B-Block Market & More',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
),
(
  '11111111-0000-4000-8000-000000000004',
  'Rupa Sen',
  'customer4@kaamconnect.test',
  '9876500004',
  '$2b$10$zi6gymLOmDtyX.MkUxmI7uDBB5FWZllFj8TWU423AKpIvZIR.pmba',
  'customer',
  0,
  'bn',
  'Kalyani University Gate 1',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
),
(
  '11111111-0000-4000-8000-000000000005',
  'Debjit Saha',
  'customer5@kaamconnect.test',
  '9876500005',
  '$2b$10$zi6gymLOmDtyX.MkUxmI7uDBB5FWZllFj8TWU423AKpIvZIR.pmba',
  'customer',
  0,
  'bn',
  'Saguna Silpanchal',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
);

-- 3. Demo Worker Accounts
INSERT OR IGNORE INTO users (id, full_name, email, phone, password_hash, role, is_suspended, language, locality, created_at, updated_at)
VALUES
(
  '22222222-0000-4000-8000-000000000001',
  'Subrata Das',
  'subrata@kaamconnect.test',
  '9876600001',
  '$2b$10$zi6gymLOmDtyX.MkUxmI7uDBB5FWZllFj8TWU423AKpIvZIR.pmba',
  'worker',
  0,
  'bn',
  'Ghoshpara Station Rd',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
),
(
  '22222222-0000-4000-8000-000000000002',
  'Biplab Roy',
  'biplab@kaamconnect.test',
  '9876600002',
  '$2b$10$zi6gymLOmDtyX.MkUxmI7uDBB5FWZllFj8TWU423AKpIvZIR.pmba',
  'worker',
  0,
  'bn',
  'Kalyani Central Park',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
),
(
  '22222222-0000-4000-8000-000000000003',
  'Sanjit Biswas',
  'sanjit@kaamconnect.test',
  '9876600003',
  '$2b$10$zi6gymLOmDtyX.MkUxmI7uDBB5FWZllFj8TWU423AKpIvZIR.pmba',
  'worker',
  0,
  'bn',
  'B-Block Market & More',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
),
(
  '22222222-0000-4000-8000-000000000004',
  'Debashis Halder',
  'debashis@kaamconnect.test',
  '9876600004',
  '$2b$10$zi6gymLOmDtyX.MkUxmI7uDBB5FWZllFj8TWU423AKpIvZIR.pmba',
  'worker',
  0,
  'bn',
  'Kalyani Main Railway Station',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
),
(
  '22222222-0000-4000-8000-000000000005',
  'Anjali Mondal',
  'anjali@kaamconnect.test',
  '9876600005',
  '$2b$10$zi6gymLOmDtyX.MkUxmI7uDBB5FWZllFj8TWU423AKpIvZIR.pmba',
  'worker',
  0,
  'bn',
  'Kalyani Central Park',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
);

-- Link existing workers to their user records and mark registration complete in metadata
UPDATE workers SET user_id = '22222222-0000-4000-8000-000000000001' WHERE (id = 'w-subrata-das' OR legacy_id = 'w-subrata-das') AND user_id IS NULL;
UPDATE workers SET user_id = '22222222-0000-4000-8000-000000000002' WHERE (id = 'w-biplab-roy' OR legacy_id = 'w-biplab-roy') AND user_id IS NULL;
UPDATE workers SET user_id = '22222222-0000-4000-8000-000000000003' WHERE (id = 'w-sanjit-biswas' OR legacy_id = 'w-sanjit-biswas') AND user_id IS NULL;
UPDATE workers SET user_id = '22222222-0000-4000-8000-000000000004' WHERE (id = 'w-debashis-halder' OR legacy_id = 'w-debashis-halder') AND user_id IS NULL;
UPDATE workers SET user_id = '22222222-0000-4000-8000-000000000005' WHERE (id = 'w-anjali-mondal' OR legacy_id = 'w-anjali-mondal') AND user_id IS NULL;

-- 4. Demo Jobs
INSERT OR IGNORE INTO jobs (id, customer_id, service_id, task_id, title, description, locality, urgency, estimated_price_min, estimated_price_max, status, created_at, updated_at)
VALUES
(
  '10000000-0000-4000-8000-000000000001',
  '11111111-0000-4000-8000-000000000001',
  'electrician',
  'el-fan',
  'Fan is not working',
  'Ceiling fan suddenly stopped working. Needs inspection and regulator check.',
  'Kalyani Central Park',
  'urgent',
  350,
  450,
  'completed',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
),
(
  '10000000-0000-4000-8000-000000000002',
  '11111111-0000-4000-8000-000000000002',
  'plumber',
  'pl-tap',
  'Kitchen tap leakage',
  'Water drips continuously from the tap even after tightening.',
  'Ghoshpara Station Rd',
  'normal',
  250,
  350,
  'completed',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
),
(
  '10000000-0000-4000-8000-000000000003',
  '11111111-0000-4000-8000-000000000003',
  'carpenter',
  'cp-door',
  'Bedroom door latch repair',
  'The latch is loose and the door will not close properly.',
  'B-Block Market & More',
  'normal',
  300,
  400,
  'open',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
),
(
  '10000000-0000-4000-8000-000000000004',
  '11111111-0000-4000-8000-000000000004',
  'cleaner',
  'cl-floor',
  'One room deep clean',
  'Please clean the bedroom, windows and attached balcony thoroughly.',
  'Kalyani University Gate 1',
  'normal',
  650,
  850,
  'completed',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
),
(
  '10000000-0000-4000-8000-000000000005',
  '11111111-0000-4000-8000-000000000005',
  'mason',
  'ms-tile',
  'Replace two cracked tiles',
  'Bathroom floor tiles need replacing. Tiles are already purchased.',
  'Saguna Silpanchal',
  'urgent',
  500,
  650,
  'open',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T10:00:00.000Z'
);

-- 5. Demo Bookings
INSERT OR IGNORE INTO bookings (id, legacy_id, job_id, customer_id, worker_id, service_id, task_id, booking_type, scheduled_date, scheduled_slot, locality, address_details, estimated_price_min, estimated_price_max, final_price, payment_method, payment_status, status, otp, metadata, created_at, updated_at, completed_at)
VALUES
(
  '33333333-0000-4000-8000-000000000001',
  'DEMO-BOOKING-1',
  '10000000-0000-4000-8000-000000000001',
  '11111111-0000-4000-8000-000000000001',
  'w-subrata-das',
  'electrician',
  'el-fan',
  'immediate',
  NULL,
  NULL,
  'Kalyani Central Park',
  'Flat 2B, Greenview Enclave',
  350,
  450,
  350,
  'upi',
  'paid',
  'completed',
  '1234',
  '{"customerId":"11111111-0000-4000-8000-000000000001","customerName":"Suman Chatterjee"}',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T11:00:00.000Z',
  '2026-10-30T11:00:00.000Z'
),
(
  '33333333-0000-4000-8000-000000000002',
  'DEMO-BOOKING-2',
  '10000000-0000-4000-8000-000000000002',
  '11111111-0000-4000-8000-000000000002',
  'w-biplab-roy',
  'plumber',
  'pl-tap',
  'immediate',
  NULL,
  NULL,
  'Ghoshpara Station Rd',
  'Near Station Road Tea Stall',
  250,
  350,
  250,
  'cash',
  'paid',
  'completed',
  '2345',
  '{"customerId":"11111111-0000-4000-8000-000000000002","customerName":"Priya Mukherjee"}',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T11:30:00.000Z',
  '2026-10-30T11:30:00.000Z'
),
(
  '33333333-0000-4000-8000-000000000003',
  'DEMO-BOOKING-3',
  '10000000-0000-4000-8000-000000000004',
  '11111111-0000-4000-8000-000000000004',
  'w-anjali-mondal',
  'cleaner',
  'cl-floor',
  'immediate',
  NULL,
  NULL,
  'Kalyani University Gate 1',
  'Staff Quarters B-3',
  650,
  850,
  650,
  'upi',
  'paid',
  'completed',
  '3456',
  '{"customerId":"11111111-0000-4000-8000-000000000004","customerName":"Rupa Sen"}',
  '2026-10-30T10:00:00.000Z',
  '2026-10-30T12:00:00.000Z',
  '2026-10-30T12:00:00.000Z'
);

-- 6. Demo Reviews
INSERT OR IGNORE INTO reviews (id, booking_id, customer_id, worker_id, rating, review_text, created_at)
VALUES
(
  '44444444-0000-4000-8000-000000000001',
  '33333333-0000-4000-8000-000000000001',
  '11111111-0000-4000-8000-000000000001',
  'w-subrata-das',
  5,
  'Prompt arrival and solved the fan issue within 20 minutes. Excellent workmanship!',
  '2026-10-30T11:15:00.000Z'
),
(
  '44444444-0000-4000-8000-000000000002',
  '33333333-0000-4000-8000-000000000002',
  '11111111-0000-4000-8000-000000000002',
  'w-biplab-roy',
  5,
  'Very polite and replaced the tap washer quickly. Fair pricing.',
  '2026-10-30T11:45:00.000Z'
),
(
  '44444444-0000-4000-8000-000000000003',
  '33333333-0000-4000-8000-000000000003',
  '11111111-0000-4000-8000-000000000004',
  'w-anjali-mondal',
  5,
  'Extremely thorough cleaning. Everything looks brand new. Highly recommend Anjali!',
  '2026-10-30T12:15:00.000Z'
);

-- Update worker ratings and review counts from reviews
UPDATE workers SET rating_average = 5.0, rating_count = rating_count + 1 WHERE id = 'w-subrata-das';
UPDATE workers SET rating_average = 5.0, rating_count = rating_count + 1 WHERE id = 'w-biplab-roy';
UPDATE workers SET rating_average = 5.0, rating_count = rating_count + 1 WHERE id = 'w-anjali-mondal';

-- Track migration version 3
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (3, datetime('now'));
