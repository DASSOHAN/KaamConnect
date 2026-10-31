import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessWithProviders,
  hasUrgentHazard,
  urgentSafetyAssessment,
  validateAssessment,
  assessmentSchema,
  googleAssessmentSchema,
  providerConfigs,
  parseAssessmentText,
} from '../ai-care.js';

const diy = {
  status: 'DIY',
  action: 'PROVIDE_SAFE_GUIDANCE',
  summary: 'Check that the appliance is switched on and plugged in. Stop if you notice heat, smoke or damage.',
  questions: [],
  safetyNotice: 'Do not open the appliance.',
};

const followup = {
  status: 'NEED_MORE_INFORMATION',
  action: 'ASK_FOLLOW_UP',
  summary: 'I need a little more detail before suggesting a safe next step.',
  questions: ['When did this begin?'],
  safetyNotice: '',
};

const urgent = {
  status: 'URGENT_SAFETY',
  action: 'PRIORITIZE_SAFETY',
  summary: 'Immediate hazard detected. Stop use immediately.',
  questions: [],
  safetyNotice: 'Evacuate area if needed.',
};

const providerConfig = {
  GEMINI_API_KEY: 'gemma-test',
  GROQ_API_KEY: 'groq-test',
  OPENROUTER_API_KEY: 'router-test',
  MISTRAL_API_KEY: 'mistral-test',
};

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const gemmaResponse = (assessment) =>
  jsonResponse({ candidates: [{ content: { parts: [{ text: JSON.stringify(assessment) }] } }] });

const openAIResponse = (assessment) =>
  jsonResponse({ choices: [{ message: { content: JSON.stringify(assessment) } }] });

// ============================================================================
// Core Safety & Validation Unit Tests
// ============================================================================

test('urgent safety rule overrides repair guidance for hazard descriptions', () => {
  for (const text of [
    'There are sparks from the outlet',
    'I smell a gas leak',
    'I smell gas in the kitchen',
    'smoke near the panel',
    'exposed live wire in hallway',
    'someone got an electric shock',
  ]) {
    assert.equal(hasUrgentHazard(text), true, `Failed to detect hazard in: ${text}`);
  }
  assert.equal(urgentSafetyAssessment().action, 'PRIORITIZE_SAFETY');
  assert.equal(urgentSafetyAssessment().status, 'URGENT_SAFETY');
});

test('assessment validator allows only known status and action values', () => {
  assert.equal(
    validateAssessment({ status: 'DIY', action: 'PROVIDE_SAFE_GUIDANCE', summary: 'Check switch.' }).status,
    'DIY'
  );
  assert.equal(validateAssessment({ status: 'DIY', action: 'MAKE_UP_BOOKING' }), null);
  assert.equal(validateAssessment({ status: 'URGENT_SAFETY', action: 'PROVIDE_SAFE_GUIDANCE', summary: 'Unsafe mismatch.' }), null);
  assert.equal(validateAssessment({ status: 'UNKNOWN', action: 'OFFER_BOOKING' }), null);
  assert.equal(validateAssessment({ status: 'NEED_MORE_INFORMATION', action: 'ASK_FOLLOW_UP', summary: 'Info needed', questions: [] }), null);
});

test('image assessment claim remains disabled in validated output', () => {
  const value = validateAssessment({
    status: 'PROFESSIONAL_REQUIRED',
    action: 'OFFER_BOOKING',
    summary: 'Use a professional.',
    imageAnalysis: 'AI verified the photo.',
  });
  assert.match(value.imageAnalysis, /not analyzed/);
});

test('parseAssessmentText parses clean JSON, markdown fences, and text-wrapped JSON', () => {
  assert.equal(parseAssessmentText(JSON.stringify(diy))?.status, 'DIY');
  assert.equal(parseAssessmentText(`\`\`\`json\n${JSON.stringify(diy)}\n\`\`\``)?.status, 'DIY');
  assert.equal(parseAssessmentText(`Here is the assessment:\n${JSON.stringify(followup)}\nHope this helps!`)?.status, 'NEED_MORE_INFORMATION');
  assert.equal(parseAssessmentText('Not JSON at all'), null);
});

// ============================================================================
// Phase 6 Scenarios 1 - 15
// ============================================================================

// 1. Gemma successful request
test('1. Gemma successful request', async () => {
  const result = await assessWithProviders({
    description: 'Ceiling fan is running slow',
    category: 'Electrician',
    config: { GEMINI_API_KEY: 'gemma-key' },
    fetchImpl: async (url, options) => {
      assert.match(url, /generativelanguage\.googleapis\.com/);
      assert.equal(options.headers['x-goog-api-key'], 'gemma-key');
      return gemmaResponse(diy);
    },
  });
  assert.equal(result.provider, 'gemma');
  assert.equal(result.assessment.status, 'DIY');
});

// 2. Gemma HTTP 400 rejection
test('2. Gemma HTTP 400 rejection', async () => {
  await assert.rejects(
    assessWithProviders({
      description: 'Ceiling fan is running slow',
      category: 'Electrician',
      config: { GEMINI_API_KEY: 'gemma-key' },
      fetchImpl: async () => jsonResponse({ error: { code: 400, message: 'Invalid payload' } }, 400),
    }),
    (error) => {
      assert.equal(error.code, 'AI_PROVIDER_REQUEST_REJECTED');
      assert.equal(error.attempted[0].provider, 'gemma');
      assert.equal(error.attempted[0].reason, 'http_400');
      return true;
    }
  );
});

// 3. Groq successful request
test('3. Groq successful request', async () => {
  const result = await assessWithProviders({
    description: 'Faucet is dripping',
    category: 'Plumber',
    config: { GROQ_API_KEY: 'groq-key' },
    fetchImpl: async (url, options) => {
      assert.match(url, /api\.groq\.com/);
      assert.equal(options.headers.Authorization, 'Bearer groq-key');
      return openAIResponse(diy);
    },
  });
  assert.equal(result.provider, 'groq');
  assert.equal(result.assessment.status, 'DIY');
});

// 4. OpenRouter successful request
test('4. OpenRouter successful request', async () => {
  const result = await assessWithProviders({
    description: 'Faucet is dripping',
    category: 'Plumber',
    config: { OPENROUTER_API_KEY: 'router-key' },
    fetchImpl: async (url, options) => {
      assert.match(url, /openrouter\.ai/);
      assert.equal(options.headers.Authorization, 'Bearer router-key');
      return openAIResponse(diy);
    },
  });
  assert.equal(result.provider, 'openrouter');
  assert.equal(result.assessment.status, 'DIY');
});

// 5. Mistral successful request
test('5. Mistral successful request', async () => {
  const result = await assessWithProviders({
    description: 'Faucet is dripping',
    category: 'Plumber',
    config: { MISTRAL_API_KEY: 'mistral-key' },
    fetchImpl: async (url, options) => {
      assert.match(url, /api\.mistral\.ai/);
      assert.equal(options.headers.Authorization, 'Bearer mistral-key');
      return openAIResponse(diy);
    },
  });
  assert.equal(result.provider, 'mistral');
  assert.equal(result.assessment.status, 'DIY');
});

// 6. Gemma failure followed by Groq success
test('6. Gemma failure followed by Groq success', async () => {
  const calls = [];
  const result = await assessWithProviders({
    description: 'Kitchen tap dripping',
    category: 'Plumber',
    config: { GEMINI_API_KEY: 'gemma-key', GROQ_API_KEY: 'groq-key' },
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (calls.length === 1) {
        return jsonResponse({ error: 'Gemma 400 error' }, 400);
      }
      return openAIResponse(diy);
    },
  });
  assert.equal(result.provider, 'groq');
  assert.equal(result.attempted[0].provider, 'gemma');
  assert.equal(result.attempted[0].reason, 'http_400');
  assert.equal(result.assessment.status, 'DIY');
});

// 7. Groq failure followed by OpenRouter success
test('7. Groq failure followed by OpenRouter success', async () => {
  const calls = [];
  const result = await assessWithProviders({
    description: 'Kitchen tap dripping',
    category: 'Plumber',
    config: { GROQ_API_KEY: 'groq-key', OPENROUTER_API_KEY: 'router-key' },
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (calls.length === 1) {
        return jsonResponse({ error: 'Groq unavailable' }, 503);
      }
      return openAIResponse(followup);
    },
  });
  assert.equal(result.provider, 'openrouter');
  const configuredAttempts = result.attempted.filter((a) => a.reason !== 'not_configured');
  assert.equal(configuredAttempts[0].provider, 'groq');
  assert.equal(configuredAttempts[0].reason, 'http_503');
  assert.equal(result.assessment.status, 'NEED_MORE_INFORMATION');
});

// 8. OpenRouter failure followed by Mistral success
test('8. OpenRouter failure followed by Mistral success', async () => {
  const calls = [];
  const result = await assessWithProviders({
    description: 'Kitchen tap dripping',
    category: 'Plumber',
    config: { OPENROUTER_API_KEY: 'router-key', MISTRAL_API_KEY: 'mistral-key' },
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (calls.length === 1) {
        return jsonResponse({ error: 'OpenRouter internal error' }, 500);
      }
      return openAIResponse(diy);
    },
  });
  assert.equal(result.provider, 'mistral');
  const configuredAttempts = result.attempted.filter((a) => a.reason !== 'not_configured');
  assert.equal(configuredAttempts[0].provider, 'openrouter');
  assert.equal(configuredAttempts[0].reason, 'http_500');
  assert.equal(result.assessment.status, 'DIY');
});

// 9. All providers failing
test('9. All providers failing', async () => {
  const calls = [];
  await assert.rejects(
    assessWithProviders({
      description: 'Fan is slow',
      category: 'Electrician',
      config: providerConfig,
      fetchImpl: async (url) => {
        calls.push(url);
        return jsonResponse({ error: 'Server unavailable' }, 503);
      },
    }),
    (error) => {
      assert.equal(error.code, 'AI_PROVIDERS_UNAVAILABLE');
      assert.equal(calls.length, 4);
      assert.equal(error.attempted.length, 4);
      return true;
    }
  );
});

// 10. Missing API keys
test('10. Missing API keys', async () => {
  let calls = 0;
  await assert.rejects(
    assessWithProviders({
      description: 'Fan stopped',
      category: 'Electrician',
      config: {},
      fetchImpl: async () => {
        calls++;
      },
    }),
    { code: 'AI_NOT_CONFIGURED' }
  );
  assert.equal(calls, 0);
});

// 11. Invalid model IDs
test('11. Invalid model IDs', async () => {
  const calls = [];
  const result = await assessWithProviders({
    description: 'Fan stopped',
    category: 'Electrician',
    config: { GEMINI_API_KEY: 'gemma-key', GROQ_API_KEY: 'groq-key' },
    fetchImpl: async (url) => {
      calls.push(url);
      if (calls.length === 1) {
        return jsonResponse({ error: 'Model not found' }, 404);
      }
      return openAIResponse(diy);
    },
  });
  assert.equal(result.provider, 'groq');
  assert.equal(result.attempted[0].provider, 'gemma');
  assert.equal(result.attempted[0].reason, 'http_404');
});

// 12. Rate limits
test('12. Rate limits', async () => {
  const calls = [];
  const result = await assessWithProviders({
    description: 'Fan stopped',
    category: 'Electrician',
    config: { GEMINI_API_KEY: 'gemma-key', GROQ_API_KEY: 'groq-key' },
    fetchImpl: async (url) => {
      calls.push(url);
      if (calls.length === 1) {
        return jsonResponse({ error: { message: 'Rate limit exceeded' } }, 429);
      }
      return openAIResponse(diy);
    },
  });
  assert.equal(result.provider, 'groq');
  assert.equal(result.attempted[0].provider, 'gemma');
  assert.equal(result.attempted[0].reason, 'http_429');
});

// 13. Provider timeouts
test('13. Provider timeouts', async () => {
  let calls = 0;
  const result = await assessWithProviders({
    description: 'Fan stopped',
    category: 'Electrician',
    config: { GEMINI_API_KEY: 'gemma-key', GROQ_API_KEY: 'groq-key' },
    fetchImpl: async () => {
      calls++;
      if (calls === 1) {
        const timeoutErr = new Error('The operation was aborted due to timeout');
        timeoutErr.name = 'TimeoutError';
        throw timeoutErr;
      }
      return openAIResponse(diy);
    },
  });
  assert.equal(result.provider, 'groq');
  assert.equal(result.attempted[0].provider, 'gemma');
  assert.equal(result.attempted[0].reason, 'timeout');
});

// 14. Malformed provider responses
test('14. Malformed provider responses', async () => {
  let calls = 0;
  const result = await assessWithProviders({
    description: 'Fan stopped',
    category: 'Electrician',
    config: { GEMINI_API_KEY: 'gemma-key', GROQ_API_KEY: 'groq-key' },
    fetchImpl: async () => {
      calls++;
      if (calls === 1) {
        return jsonResponse({ candidates: [{ content: { parts: [{ text: 'This is not JSON at all' }] } }] });
      }
      return openAIResponse(diy);
    },
  });
  assert.equal(result.provider, 'groq');
  assert.equal(result.attempted[0].provider, 'gemma');
  assert.equal(result.attempted[0].reason, 'unavailable');
});

// 15. Urgent safety validation after fallback
test('15. Urgent safety validation after fallback', async () => {
  let calls = 0;
  const result = await assessWithProviders({
    description: 'Switch sparked and makes humming sound',
    category: 'Electrician',
    config: { GEMINI_API_KEY: 'gemma-key', GROQ_API_KEY: 'groq-key' },
    fetchImpl: async () => {
      calls++;
      if (calls === 1) {
        return jsonResponse({ error: 'Gemma 500 error' }, 500);
      }
      return openAIResponse(urgent);
    },
  });
  assert.equal(result.provider, 'groq');
  assert.equal(result.assessment.status, 'URGENT_SAFETY');
  assert.equal(result.assessment.action, 'PRIORITIZE_SAFETY');
  assert.match(result.assessment.summary, /immediate safety hazard/i);
});
