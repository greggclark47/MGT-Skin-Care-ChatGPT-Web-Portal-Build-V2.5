import type { IngredientRecord, ProductRecord, ProviderRecord, TreatmentRecord } from '@mgt/domain';
import { isApprovedProvenance, isCanonicalId, isHttpsUrl } from '@mgt/domain';
import type { AntiAgingCatalog } from './catalog';

export type CatalogRecord = IngredientRecord | ProductRecord | TreatmentRecord | ProviderRecord;
export type CatalogRecordType = 'ingredient' | 'product' | 'treatment' | 'provider';

export interface CatalogImportBatch {
  import_run_id: string;
  observed_at: string;
  records: Array<{ type: CatalogRecordType; record: CatalogRecord }>;
}
export interface AdapterConflict {
  record_id: string;
  type: CatalogRecordType;
  existing_fingerprint: string;
  incoming_fingerprint: string;
  action: 'quarantine';
}

export interface AdapterQuarantine {
  record_id: string;
  type: CatalogRecordType;
  reason: 'invalid_id' | 'invalid_source' | 'not_approved' | 'stale' | 'duplicate' | 'shape_error';
}

export interface CatalogImportReport {
  import_run_id: string;
  replay_key: string;
  accepted: string[];
  quarantined: AdapterQuarantine[];
  conflicts: AdapterConflict[];
  moderation_queue: string[];
}

export interface CatalogAdapter {
  import(batch: CatalogImportBatch): CatalogImportReport;
  replay(importRunId: string): CatalogImportReport | undefined;
}

export type ProviderVerificationState = 'pending' | 'verified' | 'rejected';
export interface ProviderSubmission {
  provider: ProviderRecord;
  qualification_verification_state: ProviderVerificationState;
  normalized_city: string;
  normalized_region: string;
}

export interface ProviderDirectoryAdapter extends CatalogAdapter {
  submitProvider(submission: ProviderSubmission, observedAt: string): CatalogImportReport;
}

export function normalizeProviderLocation(city: string, region: string): { city: string; region: string } {
  return { city: city.trim().replace(/\s+/g, ' ').toLowerCase(), region: region.trim().replace(/\s+/g, ' ').toUpperCase() };
}

function fingerprint(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

function typeShape(type: CatalogRecordType, record: CatalogRecord): boolean {
  if (record.provenance?.reviewed_status !== 'approved' || !isApprovedProvenance(record.provenance)) return false;
  if (!isCanonicalId(record.id) || !record.name || !record.slug || !isHttpsUrl(record.provenance.source_url)) return false;
  if (type === 'ingredient') return 'educational_summary' in record && Array.isArray(record.compatibility_notes);
  if (type === 'product') return 'external_url' in record && Array.isArray(record.ingredient_ids);
  if (type === 'treatment') return 'description' in record && Array.isArray(record.expected_questions);
  return 'website_url' in record && typeof record.city === 'string' && typeof record.region === 'string';
}

function stale(record: CatalogRecord, observedAt: string): boolean {
  const freshness = record.provenance.freshness_until;
  return !!freshness && Date.parse(freshness) < Date.parse(observedAt);
}

export class FixtureCatalogAdapter implements CatalogAdapter {
  private readonly runs = new Map<string, CatalogImportReport>();
  constructor(private readonly catalog: AntiAgingCatalog) {}

  import(batch: CatalogImportBatch): CatalogImportReport {
    const accepted: string[] = [], quarantined: AdapterQuarantine[] = [], conflicts: AdapterConflict[] = [];
    const seen = new Map<string, { fingerprint: string; type: CatalogRecordType }>();
    for (const item of batch.records) {
      const key = `${item.type}:${item.record.id}`;
      const existing = seen.get(key);
      if (existing) {
        const incoming = fingerprint(item.record);
        if (existing.fingerprint !== incoming) conflicts.push({ record_id: item.record.id, type: item.type, existing_fingerprint: existing.fingerprint, incoming_fingerprint: incoming, action: 'quarantine' });
        else quarantined.push({ record_id: item.record.id, type: item.type, reason: 'duplicate' });
        continue;
      }
      seen.set(key, { fingerprint: fingerprint(item.record), type: item.type });
      if (!typeShape(item.type, item.record)) { quarantined.push({ record_id: item.record.id, type: item.type, reason: item.record.provenance?.reviewed_status !== 'approved' ? 'not_approved' : 'shape_error' }); continue; }
      if (stale(item.record, batch.observed_at)) { quarantined.push({ record_id: item.record.id, type: item.type, reason: 'stale' }); continue; }
      const current = this.current(item.type, item.record.id);
      if (current && fingerprint(current) !== fingerprint(item.record)) {
        conflicts.push({ record_id: item.record.id, type: item.type, existing_fingerprint: fingerprint(current), incoming_fingerprint: fingerprint(item.record), action: 'quarantine' });
        continue;
      }
      accepted.push(key);
    }
    const report = { import_run_id: batch.import_run_id, replay_key: `fixture:${batch.import_run_id}`, accepted: accepted.sort(), quarantined, conflicts, moderation_queue: [] };
    this.runs.set(batch.import_run_id, report);
    return report;
  }

  replay(importRunId: string): CatalogImportReport | undefined {
    const report = this.runs.get(importRunId);
    return report ? { ...report, accepted: [...report.accepted], quarantined: [...report.quarantined], conflicts: [...report.conflicts], moderation_queue: [...report.moderation_queue] } : undefined;
  }

  protected current(type: CatalogRecordType, id: string): CatalogRecord | undefined {
    if (type === 'ingredient') return this.catalog.getIngredient(id);
    if (type === 'product') return this.catalog.getProduct(id);
    if (type === 'treatment') return this.catalog.getTreatment(id);
    return this.catalog.getProvider(id);
  }
}

export class FixtureProviderDirectoryAdapter extends FixtureCatalogAdapter implements ProviderDirectoryAdapter {
  submitProvider(submission: ProviderSubmission, observedAt: string): CatalogImportReport {
    const location = normalizeProviderLocation(submission.provider.city, submission.provider.region);
    if (submission.qualification_verification_state === 'rejected') {
      return { import_run_id: `provider:${submission.provider.id}:${observedAt}`, replay_key: `fixture:provider:${submission.provider.id}:${observedAt}`, accepted: [], quarantined: [{ record_id: submission.provider.id, type: 'provider', reason: 'not_approved' }], conflicts: [], moderation_queue: [] };
    }
    const queue = submission.qualification_verification_state === 'pending' ? [submission.provider.id] : [];
    const base = this.import({ import_run_id: `provider:${submission.provider.id}:${observedAt}`, observed_at: observedAt, records: [{ type: 'provider', record: { ...submission.provider, city: location.city, region: location.region } }] });
    return { ...base, moderation_queue: queue };
  }
}
