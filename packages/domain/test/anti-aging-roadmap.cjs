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
const qualityIssues = domain.catalogQualityIssues([{ type: 'ingredient', record: { id: 'ingredient-test', provenance: { reviewed_status: 'draft', source_url: 'http://bad', freshness_until: '2020-01-01T00:00:00.000Z' } } }], Date.now());
assert.deepEqual(qualityIssues.map(item => item.issue), ['invalid_source', 'stale', 'unapproved']);
const readiness = domain.buildLaunchReadiness({ live_ai_enabled: false, checkout_enabled: false, booking_enabled: false, image_analysis_enabled: false, approved_catalog_records: 1, accessibility_verified: true, restore_verified: true, privacy_reviewed: true });
assert.equal(readiness.status, 'ready');
assert.equal(domain.buildLaunchGateEvidence(readiness, now).length, Object.keys(readiness.gates).length);
assert.equal(domain.buildLaunchGateEvidence(readiness, now).find(item => item.gate === 'catalog_approved').source, 'catalog_quality');
assert.equal(domain.providerMatchesCity({ city: 'New York' }, ' new   york '), true);
const reminder = domain.buildProgressReminder({ entry_id: 'routine-step-1', cadence: 'weekly', days_from_now: 7, consent_version: 'reminders-1' }, 'user-1', 'aa_rem_1', now);
assert.equal(reminder.paused, false);
assert.equal(domain.advanceProgressReminder(reminder, Date.parse(now)).next_at > reminder.next_at, true);
assert.equal(domain.progressReminderState(reminder, Date.parse(now)), 'scheduled');
assert.equal(domain.progressReminderState({ ...reminder, paused: true }, Date.parse(now)), 'paused');
assert.equal(Date.parse(domain.snoozeProgressReminder(reminder, 3, Date.parse(now)).next_at) > Date.parse(now), true);
const moderation = domain.summarizeCatalogModeration(qualityIssues);
assert.equal(moderation.status, 'quarantine_required');
assert.equal(domain.aggregateProviderSearchSlo([{ result_count: 1, latency_ms: 100, fallback: false, created_at: now }, { result_count: 0, latency_ms: 900, fallback: true, created_at: now }], 750, 0.4).status, 'review_required');
const exportSummary = domain.summarizeProgressExport(entries, [reminder, { ...reminder, id: 'aa_rem_2', paused: true }]);
assert.equal(exportSummary.entries, 2);
assert.equal(exportSummary.reminders, 2);
assert.equal(exportSummary.paused_reminders, 1);
assert.deepEqual(exportSummary.data_shared, []);
assert.equal(domain.withdrawAppointmentRequest(request, now).status, 'closed');
console.log('anti-aging-roadmap: ok');
