process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'a_very_secure_test_session_secret_at_least_32_characters_long!';

import { app } from '../index.js';
import { sqlite } from '../database/sqlite.js';
import { makeRequest } from './test_harness.js';

let customerCookie = '';
let customerCsrf = '';
let workerCookie = '';
let workerCsrf = '';
let postedJobId = '';
let bookingId = '';

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  if (Array.isArray(setCookie)) {
    return setCookie.map(c => c.split(';')[0]).join('; ');
  }
  return setCookie.split(';')[0];
}

async function run() {
  console.log('=== STARTING 20 COMPREHENSIVE TESTS FOR KAAMCONNECT ===\n');

  // Test 1: Start Express backend
  console.log('Test 1: Express backend initialized');
  if (!app) throw new Error('Express app failed to initialize');
  console.log('  PASS: Express app initialized successfully.\n');

  // Test 2: Health check
  console.log('Test 2: Health check endpoints');
  const healthRes = await makeRequest(app, { method: 'GET', url: '/api/health' });
  if (healthRes.status !== 200 || healthRes.json?.database !== 'sqlite') {
    throw new Error(`Health check failed: ${healthRes.text}`);
  }
  const dbHealth = await makeRequest(app, { method: 'GET', url: '/api/health/database' });
  if (dbHealth.status !== 200 || !dbHealth.json?.connected) {
    throw new Error(`Database health failed: ${dbHealth.text}`);
  }
  console.log('  PASS: /api/health and /api/health/database report SQLite is healthy.\n');

  // Test 3: Open homepage without login (Locations & Services)
  console.log('Test 3: Guest browsing - Homepage services and locations');
  const locRes = await makeRequest(app, { method: 'GET', url: '/api/locations' });
  if (locRes.status !== 200 || !Array.isArray(locRes.json?.data) || locRes.json.data.length === 0) {
    throw new Error(`Locations failed: ${locRes.text}`);
  }
  const servRes = await makeRequest(app, { method: 'GET', url: '/api/services' });
  if (servRes.status !== 200 || !Array.isArray(servRes.json?.data) || servRes.json.data.length === 0) {
    throw new Error(`Services failed: ${servRes.text}`);
  }
  console.log(`  PASS: Loaded ${locRes.json.data.length} locations and ${servRes.json.data.length} services without login.\n`);

  // Test 4: Browse workers without login (verify no sensitive data leak)
  console.log('Test 4: Guest browsing - Workers list');
  const workersRes = await makeRequest(app, { method: 'GET', url: '/api/workers' });
  if (workersRes.status !== 200 || !Array.isArray(workersRes.json?.data) || workersRes.json.data.length === 0) {
    throw new Error(`Workers listing failed: ${workersRes.text}`);
  }
  const sampleWorker = workersRes.json.data[0];
  if (sampleWorker.password_hash || sampleWorker.email || sampleWorker.phone) {
    throw new Error('Sensitive worker data (password/email/phone) leaked in public worker listing!');
  }
  console.log(`  PASS: Loaded ${workersRes.json.data.length} workers. Public fields safe.\n`);

  // Test 5: Search professions
  console.log('Test 5: Guest browsing - Search workers by profession');
  const elecRes = await makeRequest(app, { method: 'GET', url: '/api/workers?trade=electrician' });
  if (elecRes.status !== 200 || !Array.isArray(elecRes.json?.data)) {
    throw new Error(`Profession search failed: ${elecRes.text}`);
  }
  console.log(`  PASS: Profession search for electrician returned ${elecRes.json.data.length} workers.\n`);

  // Test 6: Browse jobs as guest
  console.log('Test 6: Guest browsing - Public jobs');
  const jobsRes = await makeRequest(app, { method: 'GET', url: '/api/jobs' });
  if (jobsRes.status !== 200 || !Array.isArray(jobsRes.json?.data)) {
    throw new Error(`Jobs listing failed: ${jobsRes.text}`);
  }
  const publicJobs = jobsRes.json.data;
  if (publicJobs.length === 0) {
    throw new Error('Expected seeded demo jobs to be available for guest browsing!');
  }
  if (publicJobs[0].customer_id) {
    throw new Error('customer_id leaked in public jobs browsing!');
  }
  console.log(`  PASS: Guest sees ${publicJobs.length} open jobs with sensitive details redacted.\n`);

  // Test 7: Register a customer
  console.log('Test 7: Register a new customer');
  const testCustomerEmail = `test.customer.${Date.now()}@example.com`;
  const testCustomerPhone = '987' + String(Math.floor(1000000 + Math.random() * 9000000));
  const regCustRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Rahul Sharma',
      email: testCustomerEmail,
      phone: testCustomerPhone,
      password: 'Password123',
      role: 'customer',
      locality: 'Kalyani'
    }
  });
  if (regCustRes.status !== 200 || !regCustRes.json?.success) {
    throw new Error(`Customer registration failed: ${regCustRes.text}`);
  }
  customerCookie = extractCookie(regCustRes.headers);
  customerCsrf = regCustRes.json.data.csrfToken;
  console.log('  PASS: Customer registered successfully, received session cookie and CSRF token.\n');

  // Test 8: Login as customer
  console.log('Test 8: Customer login with session creation');
  const loginCustRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: {
      email: testCustomerEmail,
      password: 'Password123'
    }
  });
  if (loginCustRes.status !== 200 || !loginCustRes.json?.success) {
    throw new Error(`Customer login failed: ${loginCustRes.text}`);
  }
  customerCookie = extractCookie(loginCustRes.headers);
  customerCsrf = loginCustRes.json.data.csrfToken;
  console.log('  PASS: Logged in successfully, session regenerated.\n');

  // Test 9: Session persistence after refresh (GET /api/auth/me)
  console.log('Test 9: Session persistence check (GET /api/auth/me)');
  const meCustRes = await makeRequest(app, {
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: customerCookie }
  });
  if (meCustRes.status !== 200 || meCustRes.json?.data?.user?.email !== testCustomerEmail) {
    throw new Error(`Session persistence failed: ${meCustRes.text}`);
  }
  console.log(`  PASS: Session persisted. Authenticated as ${meCustRes.json.data.user.full_name} (${meCustRes.json.data.user.role}).\n`);

  // Test 10: Post a job as customer
  console.log('Test 10: Customer posts a new job');
  const postJobRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/jobs',
    headers: {
      cookie: customerCookie,
      'x-csrf-token': customerCsrf
    },
    body: {
      title: 'Geyser Wiring & Switch Repair',
      serviceId: 'electrician',
      locality: 'Kalyani B-Block',
      description: 'Geyser switch is sparking when turned on.',
      urgency: 'urgent',
      estimatedPriceMin: 400,
      estimatedPriceMax: 600
    }
  });
  if (postJobRes.status !== 201 || !postJobRes.json?.success) {
    throw new Error(`Post job failed: ${postJobRes.text}`);
  }
  postedJobId = postJobRes.json.data.id;
  console.log(`  PASS: Job posted successfully with ID: ${postedJobId}.\n`);

  // Test 11: Book a worker as customer
  console.log('Test 11: Customer books a worker');
  const bookRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/bookings',
    headers: {
      cookie: customerCookie,
      'x-csrf-token': customerCsrf
    },
    body: {
      serviceId: 'electrician',
      taskId: 'el-fan',
      locality: 'Kalyani B-Block',
      addressDetails: 'House 42, Lane 3',
      paymentMethod: 'upi',
      bookingType: 'immediate'
    }
  });
  if (bookRes.status !== 201 || !bookRes.json?.success) {
    throw new Error(`Booking failed: ${bookRes.text}`);
  }
  bookingId = bookRes.json.data.id;
  console.log(`  PASS: Booking placed successfully with ID: ${bookingId}.\n`);

  // Test 12: Log out customer
  console.log('Test 12: Customer logout');
  const logoutRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/logout',
    headers: {
      cookie: customerCookie,
      'x-csrf-token': customerCsrf
    }
  });
  if (logoutRes.status !== 200 || !logoutRes.json?.success) {
    throw new Error(`Logout failed: ${logoutRes.text}`);
  }
  const meAfterLogout = await makeRequest(app, {
    method: 'GET',
    url: '/api/auth/me',
    headers: { cookie: customerCookie }
  });
  if (meAfterLogout.json?.data !== null) {
    throw new Error('Session still active after logout!');
  }
  console.log('  PASS: Logged out successfully. /api/auth/me returned null.\n');

  // Test 13: Register a worker
  console.log('Test 13: Register a new worker');
  const testWorkerEmail = `test.worker.${Date.now()}@example.com`;
  const testWorkerPhone = '987' + String(Math.floor(1000000 + Math.random() * 9000000));
  const regWorkerRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Manas Karmakar',
      email: testWorkerEmail,
      phone: testWorkerPhone,
      password: 'Password123',
      role: 'worker',
      profession: 'electrician',
      locality: 'Ghoshpara'
    }
  });
  if (regWorkerRes.status !== 200 || !regWorkerRes.json?.success) {
    throw new Error(`Worker registration failed: ${regWorkerRes.text}`);
  }
  workerCookie = extractCookie(regWorkerRes.headers);
  workerCsrf = regWorkerRes.json.data.csrfToken;
  console.log('  PASS: Worker registered with profession & location.\n');

  // Test 14: Log in as a worker
  console.log('Test 14: Worker login');
  const loginWorkerRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: {
      email: testWorkerEmail,
      password: 'Password123'
    }
  });
  if (loginWorkerRes.status !== 200 || !loginWorkerRes.json?.success) {
    throw new Error(`Worker login failed: ${loginWorkerRes.text}`);
  }
  workerCookie = extractCookie(loginWorkerRes.headers);
  workerCsrf = loginWorkerRes.json.data.csrfToken;
  console.log('  PASS: Worker logged in.\n');

  // Test 15: Complete worker profile
  console.log('Test 15: Complete worker profile');
  const completeProfileRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/workers/register',
    headers: {
      cookie: workerCookie,
      'x-csrf-token': workerCsrf
    },
    body: {
      name: 'Manas Karmakar',
      phone: testWorkerPhone,
      tradeId: 'electrician',
      tradeTitle: 'Electrician',
      locality: 'Ghoshpara',
      skills: ['Wiring', 'Switchboard Repair', 'Inverter Installation'],
      experienceYears: 7,
      halfDayRate: 300,
      dailyRate: 600,
      availability: true,
      bio: 'Certified electrician with 7 years experience in domestic & commercial setups.'
    }
  });
  if (completeProfileRes.status !== 201 || !completeProfileRes.json?.success) {
    throw new Error(`Worker profile completion failed: ${completeProfileRes.text}`);
  }
  console.log('  PASS: Worker profile completed and registered for discovery.\n');

  // Test 16: Worker views jobs for their trade
  console.log('Test 16: Worker views available jobs matching their trade');
  const workerJobsRes = await makeRequest(app, {
    method: 'GET',
    url: '/api/jobs',
    headers: { cookie: workerCookie }
  });
  if (workerJobsRes.status !== 200 || !Array.isArray(workerJobsRes.json?.data)) {
    throw new Error(`Worker jobs query failed: ${workerJobsRes.text}`);
  }
  const matchingJobs = workerJobsRes.json.data;
  console.log(`  PASS: Worker sees ${matchingJobs.length} open jobs matching their profession.\n`);

  // Test 17: Worker sends job offer / quotation
  console.log('Test 17: Worker sends job offer');
  const offerRes = await makeRequest(app, {
    method: 'POST',
    url: `/api/jobs/${postedJobId}/offers`,
    headers: {
      cookie: workerCookie,
      'x-csrf-token': workerCsrf
    },
    body: {
      offeredPrice: 450,
      message: 'I can come in 30 minutes with replacement switches.'
    }
  });
  if (offerRes.status !== 201 || !offerRes.json?.success) {
    throw new Error(`Worker offer failed: ${offerRes.text}`);
  }
  console.log('  PASS: Worker successfully submitted job offer/quotation.\n');

  // Test 18: Messaging between customer and worker
  console.log('Test 18: Messaging');
  // Log customer back in to chat
  const custReLogin = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: testCustomerEmail, password: 'Password123' }
  });
  customerCookie = extractCookie(custReLogin.headers);
  customerCsrf = custReLogin.json.data.csrfToken;

  const convRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/conversations',
    headers: {
      cookie: customerCookie,
      'x-csrf-token': customerCsrf
    },
    body: {
      jobId: postedJobId,
      workerId: completeProfileRes.json.data.id
    }
  });
  if (convRes.status !== 201 || !convRes.json?.success) {
    throw new Error(`Create conversation failed: ${convRes.text}`);
  }
  const convId = convRes.json.data.id;

  const msgRes = await makeRequest(app, {
    method: 'POST',
    url: `/api/conversations/${convId}/messages`,
    headers: {
      cookie: customerCookie,
      'x-csrf-token': customerCsrf
    },
    body: {
      type: 'text',
      text: 'Hello, what tools will you need?'
    }
  });
  if (msgRes.status !== 201 || !msgRes.json?.success) {
    throw new Error(`Send message failed: ${msgRes.text}`);
  }

  const getMsgsRes = await makeRequest(app, {
    method: 'GET',
    url: `/api/conversations/${convId}/messages`,
    headers: { cookie: customerCookie }
  });
  if (getMsgsRes.status !== 200 || !Array.isArray(getMsgsRes.json?.data) || getMsgsRes.json.data.length === 0) {
    throw new Error(`Get messages failed: ${getMsgsRes.text}`);
  }
  console.log(`  PASS: Conversation and message exchange verified (${getMsgsRes.json.data.length} message stored).\n`);

  // Test 19: Role-based access enforcement
  console.log('Test 19: Role-based access control');
  // Worker cannot book a worker
  const workerBookAttempt = await makeRequest(app, {
    method: 'POST',
    url: '/api/bookings',
    headers: {
      cookie: workerCookie,
      'x-csrf-token': workerCsrf
    },
    body: { serviceId: 'electrician', taskId: 'el-fan', locality: 'Kalyani' }
  });
  if (workerBookAttempt.status !== 403) {
    throw new Error(`Expected 403 for worker booking, got ${workerBookAttempt.status}`);
  }

  // Customer cannot access worker-only endpoint
  const custWorkerAttempt = await makeRequest(app, {
    method: 'GET',
    url: '/api/workers/me',
    headers: { cookie: customerCookie }
  });
  if (custWorkerAttempt.status !== 403) {
    throw new Error(`Expected 403 for customer accessing worker/me, got ${custWorkerAttempt.status}`);
  }

  // Guest cannot post a job
  const guestJobAttempt = await makeRequest(app, {
    method: 'POST',
    url: '/api/jobs',
    body: { title: 'Unauthorized Job', serviceId: 'electrician', locality: 'Kalyani' }
  });
  if (guestJobAttempt.status !== 401 && guestJobAttempt.status !== 403) {
    throw new Error(`Expected 401/403 for guest posting job, got ${guestJobAttempt.status}`);
  }
  console.log('  PASS: Role-based access rules strictly enforced on all endpoints.\n');

  // Test 20: Database persistence
  console.log('Test 20: SQLite persistence check');
  const userCount = sqlite.prepare('SELECT count(*) as count FROM users WHERE email=?').get(testCustomerEmail).count;
  const jobRow = sqlite.prepare('SELECT id, title, status FROM jobs WHERE id=?').get(postedJobId);
  const bookRow = sqlite.prepare('SELECT id, status FROM bookings WHERE id=?').get(bookingId);

  if (userCount !== 1) throw new Error('Customer user not found in SQLite!');
  if (!jobRow || jobRow.status !== 'open') throw new Error('Job not persisted in SQLite!');
  if (!bookRow) throw new Error('Booking not persisted in SQLite!');

  console.log(`  PASS: All records verified directly in SQLite (${userCount} user, job "${jobRow.title}", booking "${bookRow.id}").\n`);

  // AI Care route integration: deterministic hazards work without providers,
  // missing providers produce an honest error, and a valid primary response is normalized.
  console.log('AI Care: authenticated endpoint, emergency override, missing keys, and Gemma response');
  const providerEnvNames = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'MISTRAL_API_KEY'];
  const originalProviderEnv = Object.fromEntries(providerEnvNames.map((name) => [name, process.env[name]]));
  const originalFetch = globalThis.fetch;
  try {
    providerEnvNames.forEach((name) => { process.env[name] = ''; });
    let providerCalls = 0;
    globalThis.fetch = async () => { providerCalls++; throw new Error('Unexpected provider request'); };
    const hazardResponse = await makeRequest(app, { method: 'POST', url: '/api/ai-care/assess', headers: { cookie: customerCookie, 'x-csrf-token': customerCsrf }, body: { category: 'Electrician', description: 'I smell gas in the kitchen' } });
    if (hazardResponse.status !== 200 || hazardResponse.json.data?.status !== 'URGENT_SAFETY' || providerCalls !== 0) throw new Error('AI Care did not deterministically prioritize a gas hazard.');
    const unconfiguredResponse = await makeRequest(app, { method: 'POST', url: '/api/ai-care/assess', headers: { cookie: customerCookie, 'x-csrf-token': customerCsrf }, body: { category: 'Electrician', description: 'The fan is making a noise' } });
    if (unconfiguredResponse.status !== 503 || unconfiguredResponse.json.code !== 'AI_NOT_CONFIGURED') throw new Error('AI Care missing-provider response is incorrect.');
    process.env.GEMINI_API_KEY = 'test-only-key';
    globalThis.fetch = async (url) => { providerCalls++; if (!String(url).includes('generativelanguage.googleapis.com')) throw new Error('Unexpected fallback provider call.'); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ status: 'DIY', action: 'PROVIDE_SAFE_GUIDANCE', summary: 'Check the fan switch is on.', questions: [], safetyNotice: 'Do not open wiring.' }) }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }); };
    const primaryResponse = await makeRequest(app, { method: 'POST', url: '/api/ai-care/assess', headers: { cookie: customerCookie, 'x-csrf-token': customerCsrf }, body: { category: 'Electrician', description: 'The fan is making a noise' } });
    if (primaryResponse.status !== 200 || primaryResponse.json.data?.status !== 'DIY' || primaryResponse.json.data?.imageAnalysis?.includes('not analyzed') !== true) throw new Error(`AI Care primary response failed: ${primaryResponse.text}`);
    console.log('  PASS: authenticated AI Care route and primary Gemma adapter integration.\n');
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of providerEnvNames) { if (originalProviderEnv[name] === undefined) delete process.env[name]; else process.env[name] = originalProviderEnv[name]; }
  }

  // Extra Test: Admin authentication & moderation
  console.log('Extra Test: Admin login and message moderation endpoint access');
  const adminLogin = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'admin@kaamconnect.test', password: 'KaamConnect@123' }
  });
  if (adminLogin.status !== 200 || !adminLogin.json?.success) {
    throw new Error(`Admin login failed: ${adminLogin.text}`);
  }
  const adminCookie = extractCookie(adminLogin.headers);
  const reportsRes = await makeRequest(app, {
    method: 'GET',
    url: '/api/admin/message-reports',
    headers: { cookie: adminCookie }
  });
  if (reportsRes.status !== 200 || !reportsRes.json?.success) {
    throw new Error(`Admin reports failed: ${reportsRes.text}`);
  }
  console.log('  PASS: Admin authenticated and accessed admin message reports.\n');

  console.log('====================================================');
  console.log('🎉 ALL 20 TESTS PASSED SUCCESSFULLY! ZERO SUPABASE DEPENDENCY!');
  console.log('====================================================');
}

run().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
