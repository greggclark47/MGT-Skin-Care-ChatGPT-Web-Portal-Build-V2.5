const assert = require('node:assert/strict');
const domain = require('../dist');

assert.equal(domain.isCanonicalId('ingredient-retinol'), true);
assert.equal(domain.isCanonicalId('../private'), false);
assert.equal(domain.isHttpsUrl('https://example.org/source'), true);
assert.equal(domain.isHttpsUrl('http://example.org/source'), false);
assert.equal(domain.isConsentPurpose('provider_handoff'), true);
assert.equal(domain.isConsentPurpose('medical_diagnosis'), false);
assert.equal(domain.isApprovedProvenance({
  source_type: 'editorial', source_url: 'https://example.org/source', observed_at: '2026-10-13T00:00:00.000Z',
  imported_at: '2026-10-13T00:00:00.000Z', reviewed_status: 'approved',
}), true);
