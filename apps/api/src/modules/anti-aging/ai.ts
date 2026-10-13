import {
  ANTI_AGING_AI_POLICY_VERSION, ANTI_AGING_AI_TASKS, buildGroundedExplanation,
  screenAntiAgingQuestion, type GroundedSearchResult,
} from '@mgt/domain';
import type { AntiAgingCatalog, AntiAgingListQuery } from './catalog';
import { NoopAntiAgingAiTelemetry, type AntiAgingAiTelemetry } from './telemetry';

export const ANTI_AGING_AI_DISCLAIMER = 'Educational, reviewed-source discovery only. This portal does not diagnose, prescribe, book care, or replace professional advice.';

export function explanationForIngredient(catalog: AntiAgingCatalog, id: string) {
  const record = catalog.getIngredient(id);
  if (!record) return undefined;
  return buildGroundedExplanation({ record, summary: record.educational_summary,
    limitations: ['Evidence and formula performance vary; this is not a personal treatment plan.'],
    safety_notes: [...record.compatibility_notes, 'Patch test new products and stop if persistent irritation occurs.'] });
}

export function explanationForProduct(catalog: AntiAgingCatalog, id: string) {
  const record = catalog.getProduct(id);
  if (!record) return undefined;
  return buildGroundedExplanation({ record, summary: `${record.name} is a ${record.category} sample record for educational comparison of its listed ingredients and concern tags.`,
    limitations: ['This sample record is not a recommendation, endorsement, or purchase offer.', 'Formula details can change; check the current label.'],
    safety_notes: ['Follow the product label and patch test new products.', 'Do not use this preview to assess a medical symptom.'] });
}

export function searchAntiAging(catalog: AntiAgingCatalog, question: string, limit: number): { blocked: boolean; message?: string; uncertainty?: string; results: GroundedSearchResult[] } {
  const screening = screenAntiAgingQuestion(question);
  if (screening.blocked) return { blocked: true, message: screening.message || undefined, results: [] };
  const query: AntiAgingListQuery = { q: question, limit };
  const results: GroundedSearchResult[] = [
    ...catalog.listIngredients(query).items.map(item => ({ record_id: item.id, record_type: 'ingredient' as const, title: item.name, match_reason: 'Matched a reviewed ingredient record.', source_id: item.id, source_url: item.provenance.source_url, reviewed_status: 'approved' as const })),
    ...catalog.listProducts(query).items.map(item => ({ record_id: item.id, record_type: 'product' as const, title: item.name, match_reason: 'Matched a reviewed sample product record.', source_id: item.id, source_url: item.provenance.source_url, reviewed_status: 'approved' as const })),
    ...catalog.listTreatments(query).items.map(item => ({ record_id: item.id, record_type: 'treatment' as const, title: item.name, match_reason: 'Matched a reviewed provider-led education record.', source_id: item.id, source_url: item.provenance.source_url, reviewed_status: 'approved' as const })),
    ...catalog.listProviders(query).items.map(item => ({ record_id: item.id, record_type: 'provider' as const, title: item.name, match_reason: 'Matched a reviewed independent-provider record.', source_id: item.id, source_url: item.provenance.source_url, reviewed_status: 'approved' as const })),
  ].slice(0, limit);
  return { blocked: false, uncertainty: results.length ? 'Results are bounded to reviewed fixture records; no diagnosis or ranking is implied.' : 'No directly matching reviewed record was found.', results };
}

export function createAntiAgingAiTelemetry(telemetry?: AntiAgingAiTelemetry) {
  return telemetry || new NoopAntiAgingAiTelemetry();
}

export { ANTI_AGING_AI_POLICY_VERSION, ANTI_AGING_AI_TASKS };
