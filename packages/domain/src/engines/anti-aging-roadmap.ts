import { isCanonicalId, isHttpsUrl, type CanonicalRecord, type ProviderRecord } from '../types/anti-aging';

export const ANTI_AGING_ROADMAP_POLICY_VERSION = 'anti-aging-roadmap-1';
export const MERCHANT_REFERRAL_POLICY_VERSION = 'merchant-referral-boundary-1';
export const APPOINTMENT_HANDOFF_POLICY_VERSION = 'appointment-handoff-boundary-1';

export type ProgressStatus = 'completed' | 'skipped' | 'irritation' | 'no_change';
export type AppointmentRequestStatus = 'handoff_pending' | 'partner_acknowledged' | 'uncertain' | 'closed';

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

const STATUSES: readonly ProgressStatus[] = ['completed', 'skipped', 'irritation', 'no_change'];
const APPOINTMENT_STATUSES: readonly AppointmentRequestStatus[] = ['handoff_pending', 'partner_acknowledged', 'uncertain', 'closed'];

export function isProgressStatus(value: unknown): value is ProgressStatus { return typeof value === 'string' && STATUSES.includes(value as ProgressStatus); }
export function isAppointmentRequestStatus(value: unknown): value is AppointmentRequestStatus { return typeof value === 'string' && APPOINTMENT_STATUSES.includes(value as AppointmentRequestStatus); }

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

export function buildLaunchReadiness(input: AntiAgingLaunchInput): AntiAgingLaunchReadiness {
  const gates = { referral_only_commerce: !input.checkout_enabled, no_live_booking: !input.booking_enabled, no_image_analysis: !input.image_analysis_enabled,
    grounded_ai_gate: !input.live_ai_enabled, catalog_approved: input.approved_catalog_records > 0, accessibility: input.accessibility_verified,
    restore: input.restore_verified, privacy: input.privacy_reviewed };
  const blockers = Object.entries(gates).filter(([, value]) => !value).map(([key]) => key);
  const status = blockers.length === 0 ? 'ready' : blockers.every(key => ['grounded_ai_gate', 'no_live_booking', 'referral_only_commerce', 'no_image_analysis'].includes(key)) ? 'conditional' : 'blocked';
  return { status, blockers, gates, policy_version: ANTI_AGING_ROADMAP_POLICY_VERSION };
}

export function providerMatchesCity(provider: ProviderRecord, city: string): boolean {
  return provider.city.trim().toLowerCase() === city.trim().replace(/\s+/g, ' ').toLowerCase();
}
