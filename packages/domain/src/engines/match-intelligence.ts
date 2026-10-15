import type { ProductExplanation, ProfileVector, SkinProfileInput } from '../types/skin-profile';
import type { Routine, RoutineStep } from './routine-engine';
import { ROUTINE_ENGINE_VERSION } from './routine-engine';
import type { CandidateProduct, ExclusionResult, ScoreResult } from './scoring-engine';
import { SCORING_ENGINE_VERSION } from './scoring-engine';
import type { RoutineSlot } from '../types/enums';

export const MATCH_INTELLIGENCE_VERSION = '1.0.0';

export interface MatchDataPoint {
  id: keyof SkinProfileInput;
  label: string;
  value: string;
  effect: string;
}

export interface MatchCoverage {
  required_slots_matched: number;
  required_slots_total: number;
  optional_slots_matched: number;
  eligible_products_considered: number;
  excluded_products: number;
  confidence: 'strong' | 'balanced' | 'limited';
}

export interface RetailDiscoveryPath {
  segment: 'skincare';
  label: string;
  query_terms: string[];
  disclosure: string;
}

export interface MatchIntelligence {
  version: string;
  generated_by: 'deterministic_rules';
  ai_narrative_status: 'not_requested';
  scoring_engine_version: string;
  routine_engine_version: string;
  safety_matrix_version: string;
  data_points: MatchDataPoint[];
  coverage: MatchCoverage;
  product_matches: ProductExplanation[];
  retail_discovery: RetailDiscoveryPath;
  limitations: string[];
}

const REQUIRED_SLOTS: RoutineSlot[] = ['cleanser', 'treatment', 'moisturizer', 'sunscreen'];
const CAUTION_INGREDIENTS = new Set(['retinol', 'retinoid', 'retinal', 'salicylic_acid', 'aha_bha', 'benzoyl_peroxide']);

const labels: Record<keyof SkinProfileInput, string> = {
  skin_type: 'Skin type',
  concerns: 'Primary concerns',
  sensitivity: 'Sensitivity',
  age_band: 'Age range',
  current_routine: 'Routine experience',
  desired_outcome: 'Desired outcome',
  budget_range: 'Budget range',
  ingredient_avoidances: 'Ingredient avoidances',
};

const effects: Record<keyof SkinProfileInput, string> = {
  skin_type: 'Weights hydration and oil-control fit.',
  concerns: 'Prioritizes the concerns selected first.',
  sensitivity: 'Sets the reviewed ingredient-safety ceiling.',
  age_band: 'Adjusts ageing and firmness focus without storing an exact age.',
  current_routine: 'Controls whether optional steps are included.',
  desired_outcome: 'Adds emphasis to the requested routine outcome.',
  budget_range: 'Weights products within the selected price band.',
  ingredient_avoidances: 'Removes products containing declared avoidances.',
};

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function displayValue(value: string | string[]): string {
  return (Array.isArray(value) ? value : [value]).map(humanize).join(', ');
}

function dataPoints(input: SkinProfileInput): MatchDataPoint[] {
  return (Object.keys(labels) as (keyof SkinProfileInput)[])
    .filter((id) => id !== 'ingredient_avoidances' || input.ingredient_avoidances.length > 0)
    .map((id) => ({ id, label: labels[id], value: displayValue(input[id]), effect: effects[id] }));
}

function ingredientRole(ingredient: string): string {
  const roles: Record<string, string> = {
    glycerin: 'humectant',
    hyaluronic_acid: 'humectant',
    ceramides: 'barrier support',
    niacinamide: 'conditioning active',
    salicylic_acid: 'exfoliating active',
    retinol: 'renewal active',
    zinc_oxide: 'UV filter',
    titanium_dioxide: 'UV filter',
  };
  return roles[ingredient] ?? 'formula ingredient';
}

function alternativeReason(product: CandidateProduct, alternative: CandidateProduct): 'cheaper' | 'premium' | 'cleaner' | 'gentler' {
  if (alternative.price_cents < product.price_cents) return 'cheaper';
  if (alternative.ingredients.length < product.ingredients.length) return 'gentler';
  return alternative.price_cents > product.price_cents ? 'premium' : 'cleaner';
}

function explanationFor(
  step: RoutineStep,
  results: (ScoreResult | ExclusionResult)[],
  products: Map<string, CandidateProduct>,
  input: SkinProfileInput,
): ProductExplanation | null {
  const result = results.find((item): item is ScoreResult => !item.excluded && item.product_id === step.product_id);
  const product = products.get(step.product_id);
  if (!result || !product) return null;
  const alternatives = results.filter((item): item is ScoreResult => !item.excluded && item.product_id !== product.id)
    .slice(0, 2)
    .map((item) => products.get(item.product_id))
    .filter((item): item is CandidateProduct => Boolean(item))
    .map((item) => ({ product_id: item.id, reason: alternativeReason(product, item) }));
  const caution = product.ingredients.some((ingredient) => CAUTION_INGREDIENTS.has(ingredient));
  const cautions = [...step.conflict_notes];
  if (caution && ['moderate', 'high'].includes(input.sensitivity)) {
    cautions.push('Your saved sensitivity calls for a gradual introduction. Follow the current product label and stop if irritation occurs.');
  }
  return {
    product_id: product.id,
    match_score: result.score,
    why_matched: result.reasons.length ? result.reasons : ['eligible:safety_filters'],
    ingredients: product.ingredients.slice(0, 6).map((ingredient) => ({ name: humanize(ingredient), role: ingredientRole(ingredient) })),
    sensitivity_compatibility: caution && ['moderate', 'high'].includes(input.sensitivity) ? 'caution' : 'safe',
    routine_placement: { slot: step.slot, time: step.time, frequency: step.frequency },
    cautions,
    alternatives,
    blurb: null,
  };
}

export function buildMatchIntelligence(input: {
  profile_input: SkinProfileInput;
  profile_vector: ProfileVector;
  routine: Routine;
  slot_results: Map<RoutineSlot, (ScoreResult | ExclusionResult)[]>;
  products: CandidateProduct[];
  safety_matrix_version: string;
  excluded_products?: number;
}): MatchIntelligence {
  const products = new Map(input.products.map((product) => [product.id, product]));
  const productMatches = input.routine.steps
    .map((step) => explanationFor(step, input.slot_results.get(step.slot) ?? [], products, input.profile_input))
    .filter((item): item is ProductExplanation => Boolean(item));
  const requiredMatched = REQUIRED_SLOTS.filter((slot) => input.routine.steps.some((step) => step.slot === slot)).length;
  const allResults = [...input.slot_results.values()].flat();
  const eligible = allResults.filter((result) => !result.excluded).length;
  const excluded = Math.max(allResults.length - eligible, input.excluded_products ?? 0);
  const confidence: MatchCoverage['confidence'] = requiredMatched === REQUIRED_SLOTS.length && productMatches.length >= 4
    ? 'strong' : requiredMatched >= 3 ? 'balanced' : 'limited';
  return {
    version: MATCH_INTELLIGENCE_VERSION,
    generated_by: 'deterministic_rules',
    ai_narrative_status: 'not_requested',
    scoring_engine_version: SCORING_ENGINE_VERSION,
    routine_engine_version: ROUTINE_ENGINE_VERSION,
    safety_matrix_version: input.safety_matrix_version,
    data_points: dataPoints(input.profile_input),
    coverage: {
      required_slots_matched: requiredMatched,
      required_slots_total: REQUIRED_SLOTS.length,
      optional_slots_matched: input.routine.steps.filter((step) => step.is_optional).length,
      eligible_products_considered: eligible,
      excluded_products: excluded,
      confidence,
    },
    product_matches: productMatches,
    retail_discovery: {
      segment: 'skincare',
      label: 'Explore skincare retailers for this routine',
      query_terms: [...new Set(input.routine.steps.map((step) => step.slot))],
      disclosure: 'Retailer listings are discovery links, not personal suitability, price, availability, or purchase recommendations.',
    },
    limitations: [
      'Matches use saved questionnaire answers and reviewed catalog data; they do not diagnose a condition.',
      'Photos are not analyzed by this matching version.',
      'AI-generated text does not select, rank, include, or exclude products.',
      'Product formulas and availability can change; review the current label and retailer details.',
    ],
  };
}

export function projectMatchIntelligenceToRoutine(intelligence: MatchIntelligence, routine: Routine): MatchIntelligence {
  const productIds = new Set(routine.steps.map((step) => step.product_id));
  const requiredMatched = REQUIRED_SLOTS.filter((slot) => routine.steps.some((step) => step.slot === slot)).length;
  const productMatches = intelligence.product_matches.filter((match) => productIds.has(match.product_id));
  const confidence: MatchCoverage['confidence'] = requiredMatched === REQUIRED_SLOTS.length && productMatches.length >= 4
    ? 'strong' : requiredMatched >= 3 ? 'balanced' : 'limited';
  return {
    ...intelligence,
    coverage: {
      ...intelligence.coverage,
      required_slots_matched: requiredMatched,
      optional_slots_matched: routine.steps.filter((step) => step.is_optional).length,
      confidence,
    },
    product_matches: productMatches,
    retail_discovery: {
      ...intelligence.retail_discovery,
      query_terms: [...new Set(routine.steps.map((step) => step.slot))],
    },
  };
}
