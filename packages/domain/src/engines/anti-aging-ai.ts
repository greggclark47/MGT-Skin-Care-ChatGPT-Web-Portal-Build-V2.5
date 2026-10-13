import { scanBlockedTerms } from './eval-harness';
import { isApprovedProvenance, type CanonicalRecord } from '../types/anti-aging';

export const ANTI_AGING_AI_POLICY_VERSION = 'anti-aging-grounded-ai-1';
export const ANTI_AGING_AI_TASKS = {
  explanation: { task_type: 'anti_aging_explanation', prompt_version: 'v1.0.0', grounded: true },
  search: { task_type: 'anti_aging_search', prompt_version: 'v1.0.0', grounded: true },
  comparison: { task_type: 'anti_aging_comparison', prompt_version: 'v1.0.0', grounded: true },
  provider_summary: { task_type: 'anti_aging_provider_summary', prompt_version: 'v1.0.0', grounded: true },
} as const;

export type AntiAgingAiTask = typeof ANTI_AGING_AI_TASKS[keyof typeof ANTI_AGING_AI_TASKS]['task_type'];
export type ExplanationConfidence = 'low' | 'moderate' | 'high';
export type FeedbackRating = 'helpful' | 'not_helpful';
export type FeedbackReason = 'inaccurate' | 'unclear' | 'unsafe' | 'not_relevant' | 'other';

export function isAntiAgingAiTask(value: unknown): value is AntiAgingAiTask {
  return typeof value === 'string' && Object.values(ANTI_AGING_AI_TASKS).some(item => item.task_type === value);
}
export function isFeedbackRating(value: unknown): value is FeedbackRating {
  return value === 'helpful' || value === 'not_helpful';
}
export function isFeedbackReason(value: unknown): value is FeedbackReason {
  return value === 'inaccurate' || value === 'unclear' || value === 'unsafe' || value === 'not_relevant' || value === 'other';
}
export interface GroundedCitation {
  source_id: string;
  title: string;
  source_url: string;
  excerpt: string;
  review_status: 'approved';
}

export interface GroundedAntiAgingExplanation {
  kind: 'education';
  summary: string;
  limitations: string[];
  safety_notes: string[];
  citations: GroundedCitation[];
  professional_assessment_required: boolean;
  confidence: ExplanationConfidence;
}

export interface GroundedSearchResult {
  record_id: string;
  record_type: 'ingredient' | 'product' | 'treatment' | 'provider';
  title: string;
  match_reason: string;
  source_id: string;
  source_url: string;
  reviewed_status: 'approved';
}

export interface AntiAgingAiFeedback {
  response_id: string;
  task: AntiAgingAiTask;
  rating: FeedbackRating;
  reason?: FeedbackReason;
  comment?: string;
  created_at: string;
}

export interface AntiAgingAiEvaluationResult {
  case_id: string;
  task: AntiAgingAiTask;
  passed: boolean;
  category: 'allowed_education' | 'medical_boundary' | 'procedural_escalation' | 'unsupported_claim' | 'prompt_injection';
  failure_reason: string | null;
}

export interface AntiAgingAiMetrics {
  responses: number;
  passed: number;
  blocked: number;
  citation_failures: number;
  schema_failures: number;
  helpful: number;
  not_helpful: number;
  average_latency_ms: number;
  total_cost_cents: number;
}

export interface AntiAgingAiTelemetryEvent {
  response_id: string;
  task: AntiAgingAiTask;
  latency_ms: number;
  cost_cents: number;
  validation: 'passed' | 'blocked' | 'citation_failed' | 'schema_failed';
  created_at: string;
}

export interface AntiAgingExplanationSource {
  record: CanonicalRecord;
  summary: string;
  safety_notes: string[];
  limitations: string[];
}

const MIN_SUMMARY = 20;
const MAX_SUMMARY = 1200;
const MAX_LIST_ITEM = 360;
const UNSAFE_CLAIMS = /\b(guarantee|guaranteed|will remove|permanently remove|cure|diagnos(?:e|is)|prescribe|prescription|stop taking|replace your medication|ignore your clinician|medical advice)\b/i;
const INJECTION = /ignore.{0,40}(instruction|rule|policy)|system prompt|developer message|reveal.{0,40}(instruction|prompt)|jailbreak|override.{0,40}(safety|rule)/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function boundedString(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

function stringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 12 && value.every(item => boundedString(item, 3, MAX_LIST_ITEM));
}

export function screenAntiAgingQuestion(question: string): { blocked: boolean; category: 'medical_boundary' | 'prompt_injection' | 'procedural_escalation' | null; message: string | null } {
  if (INJECTION.test(question)) return { blocked: true, category: 'prompt_injection', message: 'Please ask an educational skincare question from the reviewed library.' };
  if (/\b(diagnos|prescri|prescription|eczema|rosacea|cancer|infection|pregnan|breastfeed|lesion|mole|wound|bleed|severe pain|allerg|rash|hives|swelling|burn|urgent|emergency)\b/i.test(question)) {
    return { blocked: true, category: 'medical_boundary', message: 'A qualified clinician or pharmacist should help with that question. This portal can explain cosmetic skincare education but cannot diagnose or prescribe.' };
  }
  if (/\b(laser|peel|injectable|injection|microneedl|procedure|downtime)\b/i.test(question)) {
    return { blocked: true, category: 'procedural_escalation', message: 'Procedural options require assessment by a qualified professional. This portal can show reviewed educational records but cannot recommend a procedure for you.' };
  }
  return { blocked: false, category: null, message: null };
}

export function validateGroundedExplanation(value: unknown, allowedSourceIds: string[], now = Date.now()): { ok: boolean; value: GroundedAntiAgingExplanation | null; reason: string | null } {
  if (!isObject(value) || value.kind !== 'education') return { ok: false, value: null, reason: 'schema:kind' };
  if (!boundedString(value.summary, MIN_SUMMARY, MAX_SUMMARY)) return { ok: false, value: null, reason: 'schema:summary' };
  if (!stringList(value.limitations) || !stringList(value.safety_notes)) return { ok: false, value: null, reason: 'schema:lists' };
  if (!Array.isArray(value.citations) || value.citations.length < 1 || value.citations.length > 8) return { ok: false, value: null, reason: 'citation:required' };
  if (typeof value.professional_assessment_required !== 'boolean' || !['low', 'moderate', 'high'].includes(String(value.confidence))) return { ok: false, value: null, reason: 'schema:flags' };
  const allowed = new Set(allowedSourceIds);
  for (const item of value.citations) {
    if (!isObject(item) || typeof item.source_id !== 'string' || !allowed.has(item.source_id) || item.review_status !== 'approved') return { ok: false, value: null, reason: 'citation:source_not_approved' };
    if (!boundedString(item.title, 2, 200) || !boundedString(item.excerpt, 10, 1400)) return { ok: false, value: null, reason: 'citation:shape' };
    if (typeof item.source_url !== 'string' || !/^https:\/\//.test(item.source_url) || item.source_url.length > 2048) return { ok: false, value: null, reason: 'citation:url' };
  }
  const text = [value.summary, ...value.limitations, ...value.safety_notes, ...value.citations.map(item => item.excerpt)].join('\n');
  const blocked = scanBlockedTerms(text);
  if (!blocked.passed) return { ok: false, value: null, reason: `claim:blocked_term:${blocked.matches[0].term}` };
  if (UNSAFE_CLAIMS.test(text) || INJECTION.test(text)) return { ok: false, value: null, reason: 'claim:unsafe_or_injected' };
  return { ok: true, value: value as unknown as GroundedAntiAgingExplanation, reason: null };
}

export function buildGroundedExplanation(source: AntiAgingExplanationSource): GroundedAntiAgingExplanation {
  if (!isApprovedProvenance(source.record.provenance)) throw new Error('grounded_explanation_source_not_approved');
  const result: GroundedAntiAgingExplanation = {
    kind: 'education', summary: source.summary, limitations: source.limitations, safety_notes: source.safety_notes,
    citations: [{ source_id: source.record.id, title: source.record.name, source_url: source.record.provenance.source_url,
      excerpt: source.summary, review_status: 'approved' }],
    professional_assessment_required: source.record.professional_assessment_required,
    confidence: source.record.evidence_level === 'strong' ? 'high' : source.record.evidence_level === 'moderate' ? 'moderate' : 'low',
  };
  const validated = validateGroundedExplanation(result, [source.record.id]);
  if (!validated.ok || !validated.value) throw new Error(`grounded_explanation_invalid:${validated.reason}`);
  return validated.value;
}

export function aggregateAntiAgingAiMetrics(events: AntiAgingAiTelemetryEvent[], feedback: AntiAgingAiFeedback[]): AntiAgingAiMetrics {
  const responses = events.length;
  const totalLatency = events.reduce((sum, item) => sum + (Number.isFinite(item.latency_ms) ? item.latency_ms : 0), 0);
  return { responses, passed: events.filter(item => item.validation === 'passed').length,
    blocked: events.filter(item => item.validation === 'blocked').length,
    citation_failures: events.filter(item => item.validation === 'citation_failed').length,
    schema_failures: events.filter(item => item.validation === 'schema_failed').length,
    helpful: feedback.filter(item => item.rating === 'helpful').length,
    not_helpful: feedback.filter(item => item.rating === 'not_helpful').length,
    average_latency_ms: responses ? Math.round(totalLatency / responses) : 0,
    total_cost_cents: Number(events.reduce((sum, item) => sum + (Number.isFinite(item.cost_cents) ? item.cost_cents : 0), 0).toFixed(4)),
  };
}
