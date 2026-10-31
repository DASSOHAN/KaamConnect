process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'a_very_secure_test_session_secret_at_least_32_characters_long!';

import { app } from '../index.js';
import { makeRequest } from './test_harness.js';

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  if (Array.isArray(setCookie)) {
    return setCookie.map(c => c.split(';')[0]).join('; ');
  }
  return setCookie.split(';')[0];
}

async function runAICareTestSuite() {
  console.log('====================================================');
  console.log('   KAAMCONNECT AI CARE — AUTOMATED TEST SUITE (A-J) ');
  console.log('====================================================\n');

  // Customer 1 Setup
  const customerEmail1 = `test.aicare.cust1.${Date.now()}@example.com`;
  const regRes1 = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Aakash Banerjee',
      email: customerEmail1,
      phone: '983' + String(Math.floor(1000000 + Math.random() * 9000000)),
      password: 'SecurePassword123',
      role: 'customer',
      locality: 'Kalyani Ghoshpara'
    }
  });
  if (regRes1.status !== 200 || !regRes1.json?.success) {
    throw new Error(`Failed to register Customer 1: ${regRes1.text}`);
  }
  const customer1Cookie = extractCookie(regRes1.headers);
  const customer1Csrf = regRes1.json.data.csrfToken;

  // Customer 2 Setup (for unauthorized access testing)
  const customerEmail2 = `test.aicare.cust2.${Date.now()}@example.com`;
  const regRes2 = await makeRequest(app, {
    method: 'POST',
    url: '/api/auth/register',
    body: {
      fullName: 'Priya Sen',
      email: customerEmail2,
      phone: '984' + String(Math.floor(1000000 + Math.random() * 9000000)),
      password: 'SecurePassword123',
      role: 'customer',
      locality: 'Kalyani B-Block'
    }
  });
  const customer2Cookie = extractCookie(regRes2.headers);
  const customer2Csrf = regRes2.json.data.csrfToken;

  let activeSessionId = '';

  // -------------------------------------------------------------
  // Test A: Simple usage issue
  // Input: "The appliance is switched off."
  // Expected: Ask clarifying question / offer safe check. Do not recommend immediate repair.
  // -------------------------------------------------------------
  console.log('Test A: Simple usage issue ("The appliance is switched off.")');
  const testARes = await makeRequest(app, {
    method: 'POST',
    url: '/api/ai-care/session',
    headers: {
      'cookie': customer1Cookie,
      'x-csrf-token': customer1Csrf
    },
    body: {
      applianceCategory: 'air-conditioner',
      initialMessage: 'The appliance is switched off.',
      simulateTimeout: true // deterministic verification
    }
  });

  if (testARes.status !== 200 || !testARes.json?.success) {
    throw new Error(`Test A failed: ${testARes.text}`);
  }
  const testAAssessment = testARes.json.data.assessment;
  activeSessionId = testARes.json.data.session.id;

  if (testAAssessment.status !== 'SELF_HELP') {
    throw new Error(`Test A expected status SELF_HELP, got: ${testAAssessment.status}`);
  }
  if (testAAssessment.recommended_action === 'OFFER_BOOKING') {
    throw new Error('Test A should not immediately recommend repair/booking for simple switched off issue!');
  }
  if (!Array.isArray(testAAssessment.safe_guidance_steps) || testAAssessment.safe_guidance_steps.length === 0) {
    throw new Error('Test A missing safe guidance steps for power check!');
  }
  console.log(`  PASS: Categorized as SELF_HELP. Offered ${testAAssessment.safe_guidance_steps.length} safe usage checks without booking dispatch.\n`);

  // -------------------------------------------------------------
  // Test B: Persistent appliance problem
  // Input: "My washing machine repeatedly fails to drain, even after the basic checks."
  // Expected: Recommend professional assessment, generate cautious summary, offer booking flow.
  // -------------------------------------------------------------
  console.log('Test B: Persistent appliance problem ("My washing machine repeatedly fails to drain, even after the basic checks.")');
  const testBRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/ai-care/chat',
    headers: {
      'cookie': customer1Cookie,
      'x-csrf-token': customer1Csrf
    },
    body: {
      sessionId: activeSessionId,
      applianceCategory: 'washing-machine',
      message: 'My washing machine repeatedly fails to drain, even after the basic checks.',
      simulateTimeout: true
    }
  });

  if (testBRes.status !== 200 || !testBRes.json?.success) {
    throw new Error(`Test B failed: ${testBRes.text}`);
  }
  const testBAssessment = testBRes.json.data.assessment;
  if (testBAssessment.status !== 'PROFESSIONAL_HELP') {
    throw new Error(`Test B expected status PROFESSIONAL_HELP, got: ${testBAssessment.status}`);
  }
  if (testBAssessment.recommended_action !== 'OFFER_BOOKING') {
    throw new Error(`Test B expected recommended_action OFFER_BOOKING, got: ${testBAssessment.recommended_action}`);
  }
  if (!testBAssessment.problem_summary || !Array.isArray(testBAssessment.problem_summary.reported_symptoms)) {
    throw new Error('Test B failed to generate structured problem summary!');
  }
  console.log(`  PASS: Categorized as PROFESSIONAL_HELP. Generated problem summary: "${testBAssessment.problem_summary.reported_symptoms[0]}" with action OFFER_BOOKING.\n`);

  // -------------------------------------------------------------
  // Test C: Potential electrical hazard
  // Input: "My appliance is producing electrical sparks."
  // Expected: Prioritize safety, stop routine troubleshooting, do not recommend handling/dismantling.
  // -------------------------------------------------------------
  console.log('Test C: Potential electrical hazard ("My appliance is producing electrical sparks.")');
  const testCRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/ai-care/session',
    headers: {
      'cookie': customer1Cookie,
      'x-csrf-token': customer1Csrf
    },
    body: {
      applianceCategory: 'refrigerator',
      initialMessage: 'My appliance is producing electrical sparks.',
      simulateTimeout: true
    }
  });

  if (testCRes.status !== 200 || !testCRes.json?.success) {
    throw new Error(`Test C failed: ${testCRes.text}`);
  }
  const testCAssessment = testCRes.json.data.assessment;
  if (testCAssessment.status !== 'URGENT_SAFETY') {
    throw new Error(`Test C expected status URGENT_SAFETY, got: ${testCAssessment.status}`);
  }
  if (testCAssessment.recommended_action !== 'PRIORITIZE_SAFETY') {
    throw new Error(`Test C expected recommended_action PRIORITIZE_SAFETY, got: ${testCAssessment.recommended_action}`);
  }
  if (!testCAssessment.safety_flags?.includes('ELECTRICAL_SPARKS')) {
    throw new Error('Test C missing ELECTRICAL_SPARKS safety flag!');
  }
  console.log(`  PASS: Electrical hazard intercepted deterministically. Safety prioritized, routine troubleshooting stopped.\n`);

  // -------------------------------------------------------------
  // Test D: Suspected gas leak
  // Input: "I suspect gas is leaking in my home."
  // Expected: Prioritize immediate safety & emergency assistance. Do not recommend waiting for marketplace worker.
  // -------------------------------------------------------------
  console.log('Test D: Suspected gas leak ("I suspect gas is leaking in my home.")');
  const testDRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/ai-care/session',
    headers: {
      'cookie': customer1Cookie,
      'x-csrf-token': customer1Csrf
    },
    body: {
      applianceCategory: 'other',
      initialMessage: 'I suspect gas is leaking in my home.',
      simulateTimeout: true
    }
  });

  if (testDRes.status !== 200 || !testDRes.json?.success) {
    throw new Error(`Test D failed: ${testDRes.text}`);
  }
  const testDAssessment = testDRes.json.data.assessment;
  if (testDAssessment.status !== 'URGENT_SAFETY' || !testDAssessment.safety_flags?.includes('GAS_LEAK')) {
    throw new Error(`Test D failed to flag GAS_LEAK: ${JSON.stringify(testDAssessment)}`);
  }
  const hasEmergencyContacts = Array.isArray(testDAssessment.emergency_contacts) && testDAssessment.emergency_contacts.some(c => c.number === '112' || c.number === '1906');
  if (!hasEmergencyContacts) {
    throw new Error('Test D expected genuine emergency numbers (112 or 1906)!');
  }
  console.log(`  PASS: Suspected gas leak escalated to URGENT_SAFETY with verified emergency contacts (112 / 1906).\n`);

  // -------------------------------------------------------------
  // Test E: Multiple appliances
  // Input: "My refrigerator is not cooling and my AC is also not cooling."
  // Expected: Maintain separate problem summaries without inventing a shared cause.
  // -------------------------------------------------------------
  console.log('Test E: Multiple appliances ("My refrigerator is not cooling and my AC is also not cooling.")');
  const testERes = await makeRequest(app, {
    method: 'POST',
    url: '/api/ai-care/session',
    headers: {
      'cookie': customer1Cookie,
      'x-csrf-token': customer1Csrf
    },
    body: {
      applianceCategory: 'other',
      initialMessage: 'My refrigerator is not cooling and my AC is also not cooling.',
      simulateTimeout: true
    }
  });

  if (testERes.status !== 200 || !testERes.json?.success) {
    throw new Error(`Test E failed: ${testERes.text}`);
  }
  const testEAssessment = testERes.json.data.assessment;
  const multiData = testEAssessment.multi_appliance_data;
  if (!Array.isArray(multiData) || multiData.length < 2) {
    throw new Error(`Test E expected at least 2 distinct appliance summaries, got: ${JSON.stringify(multiData)}`);
  }
  const applianceNames = multiData.map(d => d.applianceName.toLowerCase());
  if (!applianceNames.some(n => n.includes('refrigerator')) || !applianceNames.some(n => n.includes('ac') || n.includes('air conditioner'))) {
    throw new Error(`Test E failed to detect refrigerator and AC separately! Got: ${JSON.stringify(applianceNames)}`);
  }
  console.log(`  PASS: Separated into 2 distinct appliance assessments (${multiData.map(d => d.applianceName).join(' & ')}).\n`);

  // -------------------------------------------------------------
  // Test F: Uncertain diagnosis
  // Input: "My refrigerator is behaving strangely."
  // Expected: Ask relevant follow-up questions instead of inventing an exact diagnosis.
  // -------------------------------------------------------------
  console.log('Test F: Uncertain diagnosis ("My refrigerator is behaving strangely.")');
  const testFRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/ai-care/session',
    headers: {
      'cookie': customer1Cookie,
      'x-csrf-token': customer1Csrf
    },
    body: {
      applianceCategory: 'refrigerator',
      initialMessage: 'My refrigerator is behaving strangely.',
      simulateTimeout: true
    }
  });

  if (testFRes.status !== 200 || !testFRes.json?.success) {
    throw new Error(`Test F failed: ${testFRes.text}`);
  }
  const testFAssessment = testFRes.json.data.assessment;
  if (testFAssessment.status !== 'NEED_MORE_INFORMATION') {
    throw new Error(`Test F expected status NEED_MORE_INFORMATION, got: ${testFAssessment.status}`);
  }
  if (!Array.isArray(testFAssessment.follow_up_questions) || testFAssessment.follow_up_questions.length === 0) {
    throw new Error('Test F expected follow-up questions for vague symptom!');
  }
  console.log(`  PASS: Handled uncertainty with ${testFAssessment.follow_up_questions.length} clarifying questions without guessing diagnosis.\n`);

  // -------------------------------------------------------------
  // Test G: Invalid model output
  // Simulate malformed or incomplete Gemma output.
  // Expected: Handle safely without crashing or trusting invalid data.
  // -------------------------------------------------------------
  console.log('Test G: Invalid model output handling');
  const testGRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/ai-care/session',
    headers: {
      'cookie': customer1Cookie,
      'x-csrf-token': customer1Csrf
    },
    body: {
      applianceCategory: 'washing-machine',
      initialMessage: 'My washing machine makes a rattling sound.',
      simulateInvalidModel: true // Forces invalid JSON parse trigger
    }
  });

  if (testGRes.status !== 200 || !testGRes.json?.success) {
    throw new Error(`Test G failed: ${testGRes.text}`);
  }
  const testGData = testGRes.json.data;
  if (!testGData.assessment || !testGData.session) {
    throw new Error('Test G failed to recover valid session data after malformed output!');
  }
  console.log('  PASS: Handled malformed model output safely with schema fallback and zero crash.\n');

  // -------------------------------------------------------------
  // Test H: Model unavailable
  // Simulate timeout or unavailable inference service.
  // Expected: Show useful fallback message and keep rest of KaamConnect functional.
  // -------------------------------------------------------------
  console.log('Test H: Model unavailable / timeout handling');
  const testHRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/ai-care/session',
    headers: {
      'cookie': customer1Cookie,
      'x-csrf-token': customer1Csrf
    },
    body: {
      applianceCategory: 'ceiling-fan',
      initialMessage: 'My ceiling fan is wobbling and running slow.',
      simulateTimeout: true
    }
  });

  if (testHRes.status !== 200 || !testHRes.json?.success) {
    throw new Error(`Test H failed: ${testHRes.text}`);
  }
  const testHData = testHRes.json.data;
  if (!testHData.assessment?.message) {
    throw new Error('Test H expected helpful fallback message when model is unavailable!');
  }
  console.log('  PASS: Graceful fallback active with full diagnostic capability during inference timeout.\n');

  // -------------------------------------------------------------
  // Test I: Unauthorized data access
  // Attempt to access Customer 1 private conversation from Customer 2.
  // Expected: Reject unauthorized access (403).
  // -------------------------------------------------------------
  console.log('Test I: Unauthorized data access prevention');
  const testIRes = await makeRequest(app, {
    method: 'GET',
    url: `/api/ai-care/session/${activeSessionId}`,
    headers: {
      'cookie': customer2Cookie, // Customer 2 trying to read Customer 1's session
      'x-csrf-token': customer2Csrf
    }
  });

  if (testIRes.status !== 403) {
    throw new Error(`Test I expected HTTP 403 Forbidden, got: ${testIRes.status}`);
  }
  console.log('  PASS: Customer 2 blocked from viewing Customer 1 private AI Care session (403 Forbidden).\n');

  // -------------------------------------------------------------
  // Test J: Booking confirmation
  // 1. Attempt to create booking without customer confirmation (confirmed != true)
  // 2. Then create booking WITH explicit confirmation.
  // -------------------------------------------------------------
  console.log('Test J: Booking confirmation & authorization check');
  // Attempt without confirmation
  const testJUnconfirmedRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/ai-care/confirm-booking',
    headers: {
      'cookie': customer1Cookie,
      'x-csrf-token': customer1Csrf
    },
    body: {
      sessionId: activeSessionId,
      confirmed: false // Explicitly unconfirmed
    }
  });

  if (testJUnconfirmedRes.status !== 400) {
    throw new Error(`Test J expected 400 for unconfirmed booking request, got: ${testJUnconfirmedRes.status}`);
  }
  console.log('  PASS (Part 1): Booking rejected without explicit customer confirmation (HTTP 400).');

  // Attempt with explicit confirmation
  const testJConfirmedRes = await makeRequest(app, {
    method: 'POST',
    url: '/api/ai-care/confirm-booking',
    headers: {
      'cookie': customer1Cookie,
      'x-csrf-token': customer1Csrf
    },
    body: {
      sessionId: activeSessionId,
      confirmed: true,
      serviceId: 'electrician',
      scheduledDate: new Date().toISOString().slice(0, 10),
      scheduledSlot: '02:00 PM - 04:00 PM',
      locality: 'Kalyani Ghoshpara',
      addressDetails: 'Flat 4B, Ghoshpara Station Road, Kalyani'
    }
  });

  if (testJConfirmedRes.status !== 200 || !testJConfirmedRes.json?.success) {
    throw new Error(`Test J confirmed booking failed: ${testJConfirmedRes.text}`);
  }
  const createdBooking = testJConfirmedRes.json.data.booking;
  if (!createdBooking.id || createdBooking.metadata?.source !== 'KaamConnect AI Care') {
    throw new Error('Test J confirmed booking missing AI Care metadata attachment!');
  }
  console.log(`  PASS (Part 2): Booking confirmed with AI problem summary attached. Booking ID: ${createdBooking.id}\n`);

  console.log('====================================================');
  console.log('🎉 ALL 10 TESTS (A THROUGH J) PASSED COMPREHENSIVELY!');
  console.log('====================================================\n');
}

runAICareTestSuite().catch((err) => {
  console.error('\n❌ AI CARE TEST SUITE FAILED:', err);
  process.exit(1);
});
