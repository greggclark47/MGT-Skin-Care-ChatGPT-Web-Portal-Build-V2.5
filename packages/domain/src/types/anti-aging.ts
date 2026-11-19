/**
 * Shared, provider-neutral contracts for the anti-aging skincare discovery track.
 *
 * These are deliberately descriptive records, not diagnostic or treatment orders.
 * The API may explain educational content and link to independent destinations; it
 * does not infer a diagnosis, prescribe a treatment, or process a purchase.
 */

export const COMMERCIAL_LABELS = ['none', 'sponsored', 'partner', 'affiliate'] as const;
export type CommercialLabel = typeof COMMERCIAL_LABELS[number];

export const EVIDENCE_LEVELS = ['limited', 'emerging', 'moderate', 'strong'] as const;
export type AntiAgingEvidenceLevel = typeof EVIDENCE_LEVELS[number];

export const REVIEW_STATUSES = ['draft', 'in_review', 'approved', 'retired'] as const;
export type ReviewStatus = typeof REVIEW_STATUSES[number];

export const CONSENT_PURPOSES = [
  'personalization', 'sensitive_skin_information', 'treatment_interest',
  'progress_tracking', 'reminders', 'provider_handoff', 'commercial_attribution', 'photo_analysis',
] as const;
export type ConsentPurpose = typeof CONSENT_PURPOSES[number];

export const ANTI_AGING_GOALS = ['visible_signs_of_aging', 'texture', 'brightening', 'barrier_support', 'antioxidant_education'] as const;
export type AntiAgingGoal = typeof ANTI_AGING_GOALS[number];
export const ANTI_AGING_SENSITIVITIES = ['none', 'mild', 'moderate', 'high'] as const;
export type AntiAgingSensitivity = typeof ANTI_AGING_SENSITIVITIES[number];

export const INGREDIENT_CATEGORIES = ['antioxidant', 'retinoid', 'peptide', 'hydrator', 'barrier', 'brightener'] as const;
export type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];

export const TREATMENT_CATEGORIES = ['consultation', 'facial', 'laser', 'peel', 'injectable', 'device'] as const;
export type TreatmentCategory = typeof TREATMENT_CATEGORIES[number];

export const PROVIDER_TYPES = ['clinic', 'dermatology_practice', 'aesthetic_practice', 'medspa'] as const;
export type ProviderType = typeof PROVIDER_TYPES[number];

export interface Provenance {
  source_type: 'editorial' | 'manufacturer' | 'provider' | 'public_registry' | 'partner_feed';
  source_url: string;
  external_id?: string;
  observed_at: string;
  imported_at: string;
  freshness_until?: string;
  import_run_id?: string;
  reviewed_status: ReviewStatus;
  reviewed_by?: string;
}

export interface CanonicalRecord {
  id: string;
  slug: string;
  name: string;
  provenance: Provenance;
  evidence_level: AntiAgingEvidenceLevel;
  commercial_label: CommercialLabel;
  professional_assessment_required: boolean;
  updated_at: string;
}

export interface IngredientRecord extends CanonicalRecord {
  category: IngredientCategory;
  aliases: string[];
  educational_summary: string;
  compatibility_notes: string[];
  avoid_for_sensitivity?: boolean;
}

export interface ProductRecord extends CanonicalRecord {
  brand: string;
  merchant_name: string;
  category: 'cleanser' | 'serum' | 'moisturizer' | 'sunscreen' | 'eye' | 'treatment';
  ingredient_ids: string[];
  concern_tags: string[];
  external_url: string;
  price_band: 'under_25' | '25_50' | '50_100' | 'over_100';
  sample_only: boolean;
}

export interface TreatmentRecord extends CanonicalRecord {
  category: TreatmentCategory;
  description: string;
  expected_questions: string[];
  aftercare_note: string;
}

export interface ProviderRecord extends CanonicalRecord {
  provider_type: ProviderType;
  city: string;
  region: string;
  services: string[];
  website_url: string;
  independent_provider: boolean;
}

export interface ConsentRecord {
  purpose: ConsentPurpose;
  version: string;
  granted: boolean;
  captured_at: string;
  revoked_at: string | null;
}

export interface AntiAgingOnboardingInput {
  goals: AntiAgingGoal[];
  sensitivity: AntiAgingSensitivity;
  avoid_ingredient_ids: string[];
  consent: ConsentPurpose | null;
}

export interface AntiAgingOnboardingPreview {
  status: 'consent_required' | 'ready';
  next_step: 'ingredient_explorer' | 'routine_preview';
  goals: AntiAgingGoal[];
  sensitivity: AntiAgingSensitivity;
  safety_notes: string[];
}

export interface RoutinePreviewRequest {
  product_ids: string[];
  avoid_ingredient_ids: string[];
  sensitivity: AntiAgingSensitivity;
}

export interface RoutinePreviewStep {
  order: number;
  time: 'am' | 'pm';
  category: ProductRecord['category'];
  product_id: string;
  product_name: string;
  cautions: string[];
}

export interface RoutinePreview {
  status: 'preview_only';
  steps: RoutinePreviewStep[];
  excluded_product_ids: string[];
  safety_notes: string[];
  confirmation_required: true;
}

export interface ReadOnlyPage<T> {
  items: T[];
  next_cursor: string | null;
}

export interface AntiAgingResponseMeta {
  api_version: 'v1';
  policy_version: string;
  mode: 'read_only_referral';
  disclaimer: string;
}

export function isConsentPurpose(value: unknown): value is ConsentPurpose {
  return typeof value === 'string' && (CONSENT_PURPOSES as readonly string[]).includes(value);
}

export function isAntiAgingGoal(value: unknown): value is AntiAgingGoal {
  return typeof value === 'string' && (ANTI_AGING_GOALS as readonly string[]).includes(value);
}

export function isAntiAgingSensitivity(value: unknown): value is AntiAgingSensitivity {
  return typeof value === 'string' && (ANTI_AGING_SENSITIVITIES as readonly string[]).includes(value);
}

export function isCanonicalId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(value);
}

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash;
  } catch {
    return false;
  }
}

export function isApprovedProvenance(value: Provenance): boolean {
  return value.reviewed_status === 'approved' && isHttpsUrl(value.source_url) &&
    Number.isFinite(Date.parse(value.observed_at)) && Number.isFinite(Date.parse(value.imported_at));
}
