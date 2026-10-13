import { isCanonicalId, isHttpsUrl, type CanonicalRecord, type ProviderRecord } from '../types/anti-aging';

export const ANTI_AGING_ROADMAP_POLICY_VERSION = 'anti-aging-roadmap-1';
export const MERCHANT_REFERRAL_POLICY_VERSION = 'merchant-referral-boundary-1';
export const APPOINTMENT_HANDOFF_POLICY_VERSION = 'appointment-handoff-boundary-1';

export type ProgressStatus = 'completed' | 'skipped' | 'irritation' | 'no_change';
export type AppointmentRequestStatus = 'handoff_pending' | 'partner_acknowledged' | 'uncertain' | 'closed';
export type ProgressReminderCadence = 'daily' | 'weekly';
export type ProgressReminderState = 'paused' | 'due' | 'scheduled';

export interface MerchantReferral {
  record_id: string;
  destination_url: string;
  commercial_label: 'none' | 'sponsored' | 'partner' | 'affiliate';
  data_shared: [];
  disclosure: string;
  measurement: 'aggregate_click_only';
  policy_version: string;
}

export interface ProgressEntryInput {
  entry_id: string;
  status: ProgressStatus;
  completed_at: string;
  consent_version: string;
}

export interface ProgressEntry extends ProgressEntryInput {
  actor: string;
  created_at: string;
  policy_version: string;
}

export interface ProgressAggregate {
  entries: number;
  completed: number;
  skipped: number;
  irritation: number;
  no_change: number;
  completion_rate: number;
  note: string;
}

export interface ProgressExportSummary {
  entries: number;
  reminders: number;
  completed: number;
  paused_reminders: number;
  next_reminder_at: string | null;
  data_shared: [];
  note: string;
}

export interface ProgressReminder {
  id: string;
  actor: string;
  entry_id: string;
  cadence: ProgressReminderCadence;
  next_at: string;
  paused: boolean;
  consent_version: string;
  created_at: string;
  updated_at: string;
  policy_version: string;
}

export interface AppointmentRequestInput {
  provider_id: string;
  idempotency_key: string;
  consent: 'provider_handoff';
  requested_window?: string;
}

export interface AppointmentRequest {
  id: string;
  actor: string;
  provider_id: string;
  status: AppointmentRequestStatus;
  consent: 'provider_handoff';
  requested_window: string | null;
  data_shared: [];
  booking_supported: false;
  uncertainty: string;
  created_at: string;
  updated_at: string;
  policy_version: string;
}

export interface CatalogQualitySummary {
  total: number;
  approved: number;
  stale: number;
  unapproved: number;
  invalid_source: number;
  by_type: Record<string, number>;
  status: 'ready' | 'review_required';
}

export interface CatalogQualityIssue {
  record_id: string;
  record_type: string;
  issue: 'unapproved' | 'stale' | 'invalid_source';
  severity: 'review' | 'blocker';
  action: 'review' | 'quarantine';
}

export interface CatalogModerationSummary {
  issue_count: number;
  blocker_count: number;
  review_count: number;
  status: 'clear' | 'review_required' | 'quarantine_required';
}

export interface CatalogModerationQueueItem extends CatalogQualityIssue {
  key: string;
  owner_role: 'catalog_editor' | 'sme' | 'compliance';
}

export interface AntiAgingLaunchInput {
  live_ai_enabled: boolean;
  checkout_enabled: boolean;
  booking_enabled: boolean;
  image_analysis_enabled: boolean;
  approved_catalog_records: number;
  accessibility_verified: boolean;
  restore_verified: boolean;
  privacy_reviewed: boolean;
}

export interface AntiAgingLaunchReadiness {
  status: 'blocked' | 'conditional' | 'ready';
  blockers: string[];
  gates: Record<string, boolean>;
  policy_version: string;
}

export interface LaunchGateEvidence {
  gate: string;
  passed: boolean;
  observed_at: string;
  source: 'configuration' | 'catalog_quality' | 'operational_policy';
}

export interface ProviderSearchTelemetryEvent {
  result_count: number;
  latency_ms: number;
  fallback: boolean;
  created_at: string;
}

export interface ProviderSearchSloSummary {
  requests: number;
  empty_results: number;
  fallback_rate: number;
  p95_latency_ms: number;
  status: 'within_target' | 'review_required';
}

export interface ProviderSearchDailySummary extends ProviderSearchSloSummary {
  day: string;
}

export interface LaunchEvidenceSummary {
  total: number;
  passed: number;
  failed: number;
  blockers: string[];
  authorization: 'not_authorized';
  note: string;
}

const STATUSES: readonly ProgressStatus[] = ['completed', 'skipped', 'irritation', 'no_change'];
const APPOINTMENT_STATUSES: readonly AppointmentRequestStatus[] = ['handoff_pending', 'partner_acknowledged', 'uncertain', 'closed'];

export function isProgressStatus(value: unknown): value is ProgressStatus { return typeof value === 'string' && STATUSES.includes(value as ProgressStatus); }
export function isAppointmentRequestStatus(value: unknown): value is AppointmentRequestStatus { return typeof value === 'string' && APPOINTMENT_STATUSES.includes(value as AppointmentRequestStatus); }
export function isProgressReminderCadence(value: unknown): value is ProgressReminderCadence { return value === 'daily' || value === 'weekly'; }

export function buildMerchantReferral(record: { id: string; external_url: string; commercial_label: MerchantReferral['commercial_label'] }, allowedHosts: string[] = ['example.org']): MerchantReferral {
  if (!isCanonicalId(record.id) || !isHttpsUrl(record.external_url)) throw new Error('referral_destination_invalid');
  const target = new URL(record.external_url);
  if (!allowedHosts.includes(target.hostname.toLowerCase()) || target.username || target.password || target.hash) throw new Error('referral_destination_not_allowlisted');
  target.search = '';
  return { record_id: record.id, destination_url: target.toString(), commercial_label: record.commercial_label, data_shared: [],
    disclosure: 'You are leaving MGT Skin Care for an independent retailer destination. MGT does not receive or send your profile in this link.',
    measurement: 'aggregate_click_only', policy_version: MERCHANT_REFERRAL_POLICY_VERSION };
}

export function validateProgressEntry(input: unknown): { ok: boolean; value: ProgressEntryInput | null; reason: string | null } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, value: null, reason: 'shape' };
  const item = input as Record<string, unknown>;
  if (!isCanonicalId(item.entry_id) || !isProgressStatus(item.status) || typeof item.consent_version !== 'string' || item.consent_version.length < 1 || item.consent_version.length > 80) return { ok: false, value: null, reason: 'fields' };
  if (typeof item.completed_at !== 'string' || !Number.isFinite(Date.parse(item.completed_at))) return { ok: false, value: null, reason: 'completed_at' };
  const timestamp = Date.parse(item.completed_at);
  if (timestamp > Date.now() + 86400000 || timestamp < Date.now() - 366 * 86400000) return { ok: false, value: null, reason: 'completed_at_range' };
  return { ok: true, value: { entry_id: item.entry_id, status: item.status, completed_at: new Date(timestamp).toISOString(), consent_version: item.consent_version }, reason: null };
}

export function aggregateProgress(entries: ProgressEntry[]): ProgressAggregate {
  const count = (status: ProgressStatus) => entries.filter(item => item.status === status).length;
  const completed = count('completed');
  return { entries: entries.length, completed, skipped: count('skipped'), irritation: count('irritation'), no_change: count('no_change'), completion_rate: entries.length ? Number((completed / entries.length).toFixed(4)) : 0,
    note: 'Aggregate adherence signal only. It is not a measure of health, treatment response, or diagnosis.' };
}

export function summarizeProgressExport(entries: ProgressEntry[], reminders: ProgressReminder[]): ProgressExportSummary {
  const aggregate = aggregateProgress(entries);
  const active = reminders.filter(item => !item.paused).sort((a, b) => Date.parse(a.next_at) - Date.parse(b.next_at));
  return {
    entries: entries.length,
    reminders: reminders.length,
    completed: aggregate.completed,
    paused_reminders: reminders.filter(item => item.paused).length,
    next_reminder_at: active[0]?.next_at || null,
    data_shared: [],
    note: 'Private control summary only. It is not a diagnosis, treatment record, or health outcome.',
  };
}

export function buildProgressReminder(input: { entry_id: string; cadence: ProgressReminderCadence; days_from_now: number; consent_version: string }, actor: string, id: string, now = new Date().toISOString()): ProgressReminder {
  if (!isCanonicalId(input.entry_id) || !isProgressReminderCadence(input.cadence) || !Number.isInteger(input.days_from_now) || input.days_from_now < 1 || input.days_from_now > 365 || typeof input.consent_version !== 'string' || input.consent_version.length < 1 || input.consent_version.length > 80) throw new Error('progress_reminder_invalid');
  const next = new Date(Date.parse(now) + input.days_from_now * 86400000);
  if (!Number.isFinite(next.getTime())) throw new Error('progress_reminder_invalid');
  return { id, actor, entry_id: input.entry_id, cadence: input.cadence, next_at: next.toISOString(), paused: false, consent_version: input.consent_version, created_at: now, updated_at: now, policy_version: ANTI_AGING_ROADMAP_POLICY_VERSION };
}

export function advanceProgressReminder(reminder: ProgressReminder, now = Date.now()): ProgressReminder {
  const interval = reminder.cadence === 'daily' ? 86400000 : 7 * 86400000;
  return { ...reminder, next_at: new Date(Math.max(Date.parse(reminder.next_at) + interval, now + interval)).toISOString(), updated_at: new Date(now).toISOString(), paused: false };
}

export function snoozeProgressReminder(reminder: ProgressReminder, days: number, now = Date.now()): ProgressReminder {
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('progress_reminder_snooze_invalid');
  return { ...reminder, next_at: new Date(now + days * 86400000).toISOString(), paused: false, updated_at: new Date(now).toISOString() };
}

export function progressReminderState(reminder: ProgressReminder, now = Date.now()): ProgressReminderState {
  if (reminder.paused) return 'paused';
  return Date.parse(reminder.next_at) <= now ? 'due' : 'scheduled';
}

export function buildAppointmentRequest(input: AppointmentRequestInput, actor: string, id: string, now = new Date().toISOString()): AppointmentRequest {
  if (!isCanonicalId(input.provider_id) || input.consent !== 'provider_handoff' || !/^[a-zA-Z0-9_-]{8,120}$/.test(input.idempotency_key)) throw new Error('appointment_request_invalid');
  if (input.requested_window !== undefined && (typeof input.requested_window !== 'string' || input.requested_window.length > 120)) throw new Error('appointment_window_invalid');
  return { id, actor, provider_id: input.provider_id, status: 'handoff_pending', consent: 'provider_handoff', requested_window: input.requested_window?.trim() || null,
    data_shared: [], booking_supported: false, uncertainty: 'No appointment has been booked. An independent provider must confirm availability outside this portal.', created_at: now, updated_at: now, policy_version: APPOINTMENT_HANDOFF_POLICY_VERSION };
}

export function applyAppointmentStatusWebhook(request: AppointmentRequest, status: AppointmentRequestStatus, now = new Date().toISOString()): AppointmentRequest {
  if (status === 'partner_acknowledged') return { ...request, status, updated_at: now, uncertainty: 'The independent provider acknowledged the handoff; availability and booking remain outside this portal.' };
  if (status === 'uncertain') return { ...request, status, updated_at: now, uncertainty: 'The external provider status could not be confirmed. Contact the provider directly.' };
  return { ...request, status, updated_at: now };
}

export function withdrawAppointmentRequest(request: AppointmentRequest, now = new Date().toISOString()): AppointmentRequest {
  return { ...request, status: 'closed', updated_at: now, uncertainty: 'The provider handoff was withdrawn. Contact the independent provider directly if you still want to arrange care.' };
}

export function summarizeCatalogQuality(records: Array<{ type: string; record: CanonicalRecord }>, observedAt = Date.now()): CatalogQualitySummary {
  const summary: CatalogQualitySummary = { total: records.length, approved: 0, stale: 0, unapproved: 0, invalid_source: 0, by_type: {}, status: 'ready' };
  for (const item of records) {
    summary.by_type[item.type] = (summary.by_type[item.type] || 0) + 1;
    if (item.record.provenance.reviewed_status === 'approved') summary.approved++; else summary.unapproved++;
    if (!isHttpsUrl(item.record.provenance.source_url)) summary.invalid_source++;
    if (item.record.provenance.freshness_until && Date.parse(item.record.provenance.freshness_until) < observedAt) summary.stale++;
  }
  if (summary.unapproved || summary.stale || summary.invalid_source || summary.approved === 0) summary.status = 'review_required';
  return summary;
}

export function catalogQualityIssues(records: Array<{ type: string; record: CanonicalRecord }>, observedAt = Date.now()): CatalogQualityIssue[] {
  const issues: CatalogQualityIssue[] = [];
  for (const item of records) {
    if (item.record.provenance.reviewed_status !== 'approved') issues.push({ record_id: item.record.id, record_type: item.type, issue: 'unapproved', severity: 'review', action: 'review' });
    if (!isHttpsUrl(item.record.provenance.source_url)) issues.push({ record_id: item.record.id, record_type: item.type, issue: 'invalid_source', severity: 'blocker', action: 'quarantine' });
    if (item.record.provenance.freshness_until && Date.parse(item.record.provenance.freshness_until) < observedAt) issues.push({ record_id: item.record.id, record_type: item.type, issue: 'stale', severity: 'review', action: 'review' });
  }
  return issues.sort((a, b) => `${a.severity}:${a.record_type}:${a.record_id}:${a.issue}`.localeCompare(`${b.severity}:${b.record_type}:${b.record_id}:${b.issue}`));
}

export function summarizeCatalogModeration(issues: CatalogQualityIssue[]): CatalogModerationSummary {
  const blocker_count = issues.filter(item => item.severity === 'blocker').length;
  const review_count = issues.filter(item => item.severity === 'review').length;
  return { issue_count: issues.length, blocker_count, review_count, status: blocker_count ? 'quarantine_required' : review_count ? 'review_required' : 'clear' };
}

export function catalogModerationKey(issue: CatalogQualityIssue): string {
  return `${issue.record_type}:${issue.record_id}:${issue.issue}`;
}

export function buildCatalogModerationQueue(issues: CatalogQualityIssue[]): CatalogModerationQueueItem[] {
  return issues.map(issue => ({ ...issue, key: catalogModerationKey(issue), owner_role: issue.severity === 'blocker' ? 'compliance' : issue.issue === 'unapproved' ? 'sme' : 'catalog_editor' }));
}

export function buildLaunchReadiness(input: AntiAgingLaunchInput): AntiAgingLaunchReadiness {
  const gates = { referral_only_commerce: !input.checkout_enabled, no_live_booking: !input.booking_enabled, no_image_analysis: !input.image_analysis_enabled,
    grounded_ai_gate: !input.live_ai_enabled, catalog_approved: input.approved_catalog_records > 0, accessibility: input.accessibility_verified,
    restore: input.restore_verified, privacy: input.privacy_reviewed };
  const blockers = Object.entries(gates).filter(([, value]) => !value).map(([key]) => key);
  const status = blockers.length === 0 ? 'ready' : blockers.every(key => ['grounded_ai_gate', 'no_live_booking', 'referral_only_commerce', 'no_image_analysis'].includes(key)) ? 'conditional' : 'blocked';
  return { status, blockers, gates, policy_version: ANTI_AGING_ROADMAP_POLICY_VERSION };
}

export function buildLaunchGateEvidence(readiness: AntiAgingLaunchReadiness, observedAt = new Date().toISOString()): LaunchGateEvidence[] {
  return Object.entries(readiness.gates).map(([gate, passed]) => ({
    gate,
    passed,
    observed_at: observedAt,
    source: ['catalog_approved'].includes(gate) ? 'catalog_quality' : ['referral_only_commerce', 'no_live_booking', 'no_image_analysis', 'grounded_ai_gate'].includes(gate) ? 'operational_policy' : 'configuration',
  }));
}

export function summarizeLaunchGateEvidence(evidence: LaunchGateEvidence[]): LaunchEvidenceSummary {
  const blockers = evidence.filter(item => !item.passed).map(item => item.gate);
  return { total: evidence.length, passed: evidence.length - blockers.length, failed: blockers.length, blockers, authorization: 'not_authorized', note: 'Evidence summarizes gates only; it is not launch authorization.' };
}

export function providerMatchesCity(provider: ProviderRecord, city: string): boolean {
  return provider.city.trim().toLowerCase() === city.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function aggregateProviderSearchSlo(events: ProviderSearchTelemetryEvent[], latencyTargetMs = 750, fallbackTarget = 0.5): ProviderSearchSloSummary {
  const latencies = events.map(item => item.latency_ms).filter(item => Number.isFinite(item) && item >= 0).sort((a, b) => a - b);
  const empty = events.filter(item => item.result_count === 0).length;
  const fallbackCount = events.filter(item => item.fallback).length;
  const fallbackRate = events.length ? fallbackCount / events.length : 0;
  const p95 = latencies.length ? latencies[Math.floor((latencies.length - 1) * 0.95)] : 0;
  return { requests: events.length, empty_results: empty, fallback_rate: Number(fallbackRate.toFixed(4)), p95_latency_ms: p95, status: p95 <= latencyTargetMs && fallbackRate <= fallbackTarget ? 'within_target' : 'review_required' };
}

export function aggregateProviderSearchSloByDay(events: ProviderSearchTelemetryEvent[], latencyTargetMs = 750, fallbackTarget = 0.5): ProviderSearchDailySummary[] {
  const grouped = new Map<string, ProviderSearchTelemetryEvent[]>();
  for (const event of events) {
    const timestamp = Date.parse(event.created_at);
    const day = Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : event.created_at.slice(0, 10);
    const list = grouped.get(day) || [];
    list.push(event);
    grouped.set(day, list);
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, dayEvents]) => ({ day, ...aggregateProviderSearchSlo(dayEvents, latencyTargetMs, fallbackTarget) }));
}
