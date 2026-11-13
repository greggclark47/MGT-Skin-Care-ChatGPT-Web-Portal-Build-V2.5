import { MEMBERSHIP_COMPARISON_ROWS, MEMBERSHIP_TIER_CONTENT } from '@mgt/shared';

export const BILLING_CYCLES = ['monthly', 'annual'] as const;
export type BillingCycle = typeof BILLING_CYCLES[number];

export type PlanDefinition = {
  id: 'premium' | 'studio';
  name: string;
  summary: string;
  best_for: string;
  features: readonly string[];
  comparison: Readonly<Record<string, string>>;
  env_prefix: 'PREMIUM' | 'STUDIO';
};

export type AccessLevelDefinition = {
  id: 'free';
  name: string;
  summary: string;
  features: readonly string[];
  comparison: Readonly<Record<string, string>>;
};

export const PLAN_COMPARISON_ROWS = MEMBERSHIP_COMPARISON_ROWS;

// Free is the non-billable baseline, not a Stripe plan. Keeping it outside
// PLAN_DEFINITIONS preserves one paid product while making the comparison clear.
const FREE_CONTENT = MEMBERSHIP_TIER_CONTENT.find(plan => plan.id === 'free')!;
export const FREE_ACCESS: AccessLevelDefinition = { ...FREE_CONTENT, id: 'free' };

// The existing `premium` identifier and PREMIUM environment prefix are retained
// for billing continuity; its customer-facing name is Guided. Studio is a second
// paid tier and remains fail-closed until both approved prices are configured.
export const PLAN_DEFINITIONS: readonly PlanDefinition[] = MEMBERSHIP_TIER_CONTENT
  .filter((plan): plan is typeof plan & { id: 'premium' | 'studio' } => plan.id !== 'free')
  .map(plan => ({ ...plan, env_prefix: plan.id === 'premium' ? 'PREMIUM' : 'STUDIO' }));

export function planById(value: unknown) {
  return PLAN_DEFINITIONS.find(plan => plan.id === value);
}

export function defaultPlan() {
  return planById('premium')!;
}

export function priceIdFor(env: NodeJS.ProcessEnv, plan: PlanDefinition, cycle: BillingCycle) {
  return env[`STRIPE_${plan.env_prefix}_${cycle.toUpperCase()}_PRICE_ID`];
}

export function planPriceMatch(env: NodeJS.ProcessEnv, priceId: unknown) {
  if (typeof priceId !== 'string') return undefined;
  for (const plan of PLAN_DEFINITIONS) {
    for (const cycle of BILLING_CYCLES) if (priceIdFor(env, plan, cycle) === priceId) return { plan, cycle };
  }
  return undefined;
}

type SavedProfile = { input?: { current_routine?: string; budget_range?: string } } | null | undefined;

export function recommendPlan(profile: SavedProfile) {
  return {
    plan_id: 'premium' as const,
    basis: profile?.input ? 'saved_preferences' as const : 'general_starting_point' as const,
    reason: 'Guided is a balanced starting point for ongoing support. Compare every tier before choosing; this is not an automatic enrollment or personalized pricing decision.',
  };
}
