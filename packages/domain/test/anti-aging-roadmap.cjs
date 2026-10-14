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
const queue = domain.buildCatalogModerationQueue(qualityIssues);
assert.equal(queue.length, qualityIssues.length);
assert.equal(queue[0].key.includes('ingredient-test'), true);
assert.equal(queue.find(item => item.issue === 'invalid_source').owner_role, 'compliance');
const evidenceSummary = domain.summarizeLaunchGateEvidence(domain.buildLaunchGateEvidence(readiness, now));
assert.equal(evidenceSummary.authorization, 'not_authorized');
assert.equal(evidenceSummary.failed, 0);
const dailySlo = domain.aggregateProviderSearchSloByDay([
  { result_count: 1, latency_ms: 100, fallback: false, created_at: '2026-10-12T12:00:00.000Z' },
  { result_count: 0, latency_ms: 800, fallback: true, created_at: '2026-10-13T12:00:00.000Z' },
]);
assert.deepEqual(dailySlo.map(item => item.day), ['2026-10-12', '2026-10-13']);
const manifest = domain.buildProgressExportManifest(entries, [reminder]);
assert.equal(manifest.export_format, 'json');
assert.deepEqual(manifest.scopes, ['progress_tracking', 'reminders']);
assert.deepEqual(manifest.data_shared, []);
assert.equal(manifest.retention, 'user_controlled');
assert.equal(manifest.external_delivery, 'disabled');
const reminderPreview = domain.previewProgressReminder(reminder, Date.parse(now));
assert.equal(reminderPreview.delivery, 'in_app_only');
assert.equal(reminderPreview.next_action, 'pause');
assert.deepEqual(reminderPreview.data_shared, []);
const controlSummary = domain.buildProgressControlSummary(entries, [reminder], Date.parse(now));
assert.equal(controlSummary.deletion_supported, true);
assert.equal(controlSummary.actor_scope, 'current_actor');
assert.equal(controlSummary.reminders[0].delivery, 'in_app_only');
const queueSummary = domain.summarizeCatalogModerationQueue(queue);
assert.equal(queueSummary.total, queue.length);
assert.equal(queueSummary.by_owner_role.compliance, 1);
assert.equal(queueSummary.filter_options.severities.includes('blocker'), true);
assert.equal(domain.filterCatalogModerationQueue(queue, { severity: 'blocker' }).length, 1);
assert.equal(domain.paginateCatalogModerationQueue(queue, 1, 0).has_more, true);
const freshness = domain.assessLaunchEvidenceFreshness(domain.buildLaunchGateEvidence(readiness, now), Date.parse(now) + (86400 + 1) * 1000, 86400);
assert.equal(freshness.stale, true);
assert.equal(freshness.status, 'stale');
assert.equal(freshness.next_review, 'refresh_evidence');
assert.equal(domain.summarizeProviderSearchWindow(dailySlo, 1).truncated, true);
assert.equal(domain.summarizeProviderSearchWindow(dailySlo, 2).review_required_days, 1);
const reviewPlan = domain.buildAntiAgingReviewPlan({
  queue,
  search: domain.aggregateProviderSearchSlo([{ result_count: 0, latency_ms: 900, fallback: true, created_at: now }]),
  readiness,
  evidence: evidenceSummary,
  evidence_freshness: freshness,
}, now);
assert.equal(reviewPlan.authorization, 'not_authorized');
assert.equal(reviewPlan.first_action, 'quarantine_catalog');
assert.equal(reviewPlan.blockers >= 1, true);
assert.equal(reviewPlan.items.some(item => item.action === 'quarantine_catalog'), true);
assert.equal(reviewPlan.items.some(item => item.action === 'refresh_evidence'), true);
assert.equal(reviewPlan.items.some(item => item.action === 'review_search_slo'), true);
const clearPlan = domain.buildAntiAgingReviewPlan({
  queue: [],
  search: domain.aggregateProviderSearchSlo([]),
  readiness,
  evidence: { ...evidenceSummary, failed: 0, blockers: [] },
  evidence_freshness: { ...freshness, status: 'fresh', stale: false, next_review: 'none_required' },
}, now);
assert.equal(clearPlan.first_action, 'no_action');
assert.equal(clearPlan.blockers, 0);
const reviewSummary = domain.summarizeAntiAgingReviewPlan(reviewPlan);
assert.equal(reviewSummary.requires_attention, true);
assert.equal(reviewSummary.highest_priority, 'blocker');
assert.equal(reviewSummary.by_action.quarantine_catalog, 1);
assert.equal(reviewSummary.by_owner_role.operations >= 1, true);
const reviewSession = domain.paginateAntiAgingReviewPlan(reviewPlan, 2, 0);
assert.equal(reviewSession.authorization, 'not_authorized');
assert.equal(reviewSession.limit, 2);
assert.equal(reviewSession.items.length, 2);
assert.equal(reviewSession.has_more, true);
assert.equal(reviewSession.session_id.startsWith('anti-aging-review:'), true);
const boundedReviewSession = domain.paginateAntiAgingReviewPlan(reviewPlan, 100, -4);
assert.equal(boundedReviewSession.limit, 25);
assert.equal(boundedReviewSession.offset, 0);
const packet = domain.buildAntiAgingDecisionPacket(reviewPlan, reviewSummary, reviewSession, now);
assert.equal(packet.status, 'pending_human_review');
assert.equal(packet.packet_version, 'anti-aging-decision-packet-2');
assert.equal(packet.publication_authorized, false);
assert.equal(packet.selected_decision, null);
assert.deepEqual(packet.decision_options, ['hold', 'defer', 'request_more_evidence']);
assert.equal(packet.accountability, 'human_owner_required');
assert.equal(packet.evidence_refs.length, reviewSession.items.length);
assert.equal(packet.evidence_refs[0].ref_id.startsWith(reviewSession.session_id + ':'), true);
assert.deepEqual(packet.scope, { plan_total: reviewPlan.total, session_total: 2, offset: 0, limit: 2, has_more: true, complete_plan: false });
assert.equal(packet.fingerprint_algorithm, 'fnv1a32-utf16');
assert.match(packet.content_fingerprint, /^[a-f0-9]{8}$/);
assert.equal(domain.buildAntiAgingDecisionPacket(reviewPlan, reviewSummary, reviewSession, new Date(Date.parse(now) + 1000).toISOString()).content_fingerprint, packet.content_fingerprint);
const nextReviewSession = domain.paginateAntiAgingReviewPlan(reviewPlan, 2, 2);
const nextPacket = domain.buildAntiAgingDecisionPacket(reviewPlan, reviewSummary, nextReviewSession, now);
assert.notEqual(nextReviewSession.session_id, reviewSession.session_id);
assert.notEqual(nextPacket.packet_id, packet.packet_id);
assert.notEqual(nextPacket.content_fingerprint, packet.content_fingerprint);
const completeSession = domain.paginateAntiAgingReviewPlan(reviewPlan, 25, 0);
assert.equal(domain.buildAntiAgingDecisionPacket(reviewPlan, reviewSummary, completeSession, now).scope.complete_plan, true);
assert.equal(packet.note.includes('cannot approve launch'), true);
const digest = domain.buildAntiAgingOperationsDigest({ moderation, queue, search: domain.aggregateProviderSearchSlo([]), daily_search: [], readiness, evidence: evidenceSummary }, now);
assert.equal(digest.authorization, 'not_authorized');
assert.equal(digest.moderation_queue_items, queue.length);
assert.equal(digest.moderation_by_owner.compliance, 1);
assert.equal(digest.readiness_status, 'ready');
console.log('anti-aging-roadmap: ok');
