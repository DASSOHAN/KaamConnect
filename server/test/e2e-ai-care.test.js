import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '../.env') });
process.env.SESSION_SECRET ||= 'a_very_secure_test_session_secret_at_least_32_characters_long!';

const { app } = await import('../index.js');
const { makeRequest } = await import('./test_harness.js');

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  if (Array.isArray(setCookie)) return setCookie.map(c => c.split(';')[0]).join('; ');
  return setCookie.split(';')[0];
}

console.log('=== RUNNING END-TO-END VERIFICATION (REAL BACKEND & PROVIDERS) ===\n');

// 1. Register a customer
const testCustomerEmail = `e2e.customer.${Date.now()}@example.com`;
const testCustomerPhone = '987' + String(Math.floor(1000000 + Math.random() * 9000000));
const regRes = await makeRequest(app, {
  method: 'POST',
  url: '/api/auth/register',
  body: {
    fullName: 'Ananya Roy',
    email: testCustomerEmail,
    phone: testCustomerPhone,
    password: 'Password123',
    role: 'customer',
    locality: 'Kalyani'
  }
});

if (regRes.status !== 200 || !regRes.json?.success) {
  throw new Error(`Customer registration failed: ${regRes.text}`);
}

const customerCookie = extractCookie(regRes.headers);
const customerCsrf = regRes.json.data.csrfToken;

console.log('Customer session initialized successfully.\n');

const testCases = [
  {
    name: 'Test 1: My kitchen tap is leaking slowly.',
    body: { category: 'Plumber', description: 'My kitchen tap is leaking slowly.' },
    expectedNote: 'Appropriate assessment or relevant follow-up question',
    validate: (res) => {
      if (res.status !== 200) return `HTTP ${res.status}: ${res.text}`;
      const data = res.json.data;
      if (!data || !['DIY', 'NEED_MORE_INFORMATION', 'PROFESSIONAL_REQUIRED'].includes(data.status)) {
        return `Unexpected status: ${data?.status}`;
      }
      return null;
    }
  },
  {
    name: 'Test 2: My electrical switch is producing sparks and burning smell.',
    body: { category: 'Electrician', description: 'My electrical switch is producing sparks and burning smell.' },
    expectedNote: 'Urgent safety response. No repair instructions.',
    validate: (res) => {
      if (res.status !== 200) return `HTTP ${res.status}: ${res.text}`;
      const data = res.json.data;
      if (data?.status !== 'URGENT_SAFETY' || data?.action !== 'PRIORITIZE_SAFETY') {
        return `Expected URGENT_SAFETY, got: ${data?.status}`;
      }
      return null;
    }
  },
  {
    name: 'Test 3: My appliance is not working.',
    body: { category: 'Appliance Repair', description: 'My appliance is not working.' },
    expectedNote: 'Follow-up questions.',
    validate: (res) => {
      if (res.status !== 200) return `HTTP ${res.status}: ${res.text}`;
      const data = res.json.data;
      if (data?.status !== 'NEED_MORE_INFORMATION' || !data?.questions?.length) {
        return `Expected NEED_MORE_INFORMATION with questions, got: ${data?.status}`;
      }
      return null;
    }
  },
  {
    name: 'Test 4: My ceiling fan suddenly stopped working.',
    body: { category: 'Electrician', description: 'My ceiling fan suddenly stopped working.' },
    expectedNote: 'Cautious assessment without fabricated diagnosis.',
    validate: (res) => {
      if (res.status !== 200) return `HTTP ${res.status}: ${res.text}`;
      const data = res.json.data;
      if (!data || !['DIY', 'NEED_MORE_INFORMATION', 'PROFESSIONAL_REQUIRED'].includes(data.status)) {
        return `Unexpected status: ${data?.status}`;
      }
      return null;
    }
  }
];

for (const tc of testCases) {
  console.log(`--- ${tc.name} ---`);
  console.log(`Expected: ${tc.expectedNote}`);
  const start = Date.now();
  const res = await makeRequest(app, {
    method: 'POST',
    url: '/api/ai-care/assess',
    headers: {
      cookie: customerCookie,
      'x-csrf-token': customerCsrf
    },
    body: tc.body
  });
  console.log(`Completed in ${Date.now() - start}ms`);
  console.log(`HTTP Status: ${res.status}`);
  console.log(`Provider: ${res.json?.provider || 'none'}`);
  console.log(`Assessment:`, JSON.stringify(res.json?.data, null, 2));

  const err = tc.validate(res);
  if (err) {
    console.error(`❌ FAILED: ${err}\n`);
    process.exit(1);
  } else {
    console.log(`✔ PASSED\n`);
  }
}

console.log('🎉 ALL 4 END-TO-END TESTS COMPLETED SUCCESSFULLY!');

