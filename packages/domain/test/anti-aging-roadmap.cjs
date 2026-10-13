const assert = require('node:assert/strict');
const domain = require('../dist');

const product = { id: 'product-c-brightening-serum', external_url: 'https://example.org/mgt/products/c-brightening-serum?utm_source=unsafe', commercial_label: 'none' };
const referral = domain.buildMerchantReferral(product);
assert.equal(referral.destination_url, 'https://example.org/mgt/products/c-brightening-serum');
assert.deepEqual(referral.data_shared, []);
assert.throws(() => domain.buildMerchantReferral({ ...product, external_url: 'https://not-allowed.example/buy' }), /allowlisted/);

const now = new Date().toISOString();
const progress = domain.validateProgressEntry({ entry_id: 'routine-step-1', status: 'completed', completed_at: now, consent_version: 'progress-1' });
assert.equal(progress.ok, true);
const entries = [
  { ...progress.value, actor: 'user-1', created_at: now, policy_version: 'anti-aging-roadmap-1' },
  { entry_id: 'routine-step-2', status: 'irritation', completed_at: now, consent_version: 'progress-1', actor: 'user-1', created_at: now, policy_version: 'anti-aging-roadmap-1' },
];
assert.equal(domain.aggregateProgress(entries).completion_rate, 0.5);
assert.equal(domain.aggregateProgress(entries).note.includes('diagnosis'), true);

const request = domain.buildAppointmentRequest({ provider_id: 'provider-example-dermatology', idempotency_key: 'request-001', consent: 'provider_handoff' }, 'user-1', 'aa_req_1', now);
assert.equal(request.booking_supported, false);
assert.deepEqual(request.data_shared, []);
assert.equal(domain.applyAppointmentStatusWebhook(request, 'uncertain', now).status, 'uncertain');

const quality = domain.summarizeCatalogQuality([{ type: 'ingredient', record: { provenance: { reviewed_status: 'draft', source_url: 'http://bad' } } }], Date.now());
assert.equal(quality.status, 'review_required');
const readiness = domain.buildLaunchReadiness({ live_ai_enabled: false, checkout_enabled: false, booking_enabled: false, image_analysis_enabled: false, approved_catalog_records: 1, accessibility_verified: true, restore_verified: true, privacy_reviewed: true });
assert.equal(readiness.status, 'ready');
assert.equal(domain.providerMatchesCity({ city: 'New York' }, ' new   york '), true);
console.log('anti-aging-roadmap: ok');
