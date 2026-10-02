export const BILLING_CYCLES = ['monthly', 'annual'] as const;
export type BillingCycle = typeof BILLING_CYCLES[number];

export type PlanDefinition = {
  id: 'premium';
  name: string;
  summary: string;
  best_for: string;
  features: string[];
  comparison: Record<string, string>;
  env_prefix: 'PREMIUM';
};

export const PLAN_COMPARISON_ROWS = [
  { id: 'skin_match', label: 'Skin Match' },
  { id: 'routine_guidance', label: 'Routine guidance' },
  { id: 'coach', label: 'Skin Coach' },
  { id: 'shared_access', label: 'Shared access' },
  { id: 'business_tools', label: 'Business tools' },
] as const;

// C1: the released catalog has one consumer Premium membership. Stripe prices stay
// fail-closed until both approved monthly and annual prices are configured.
export const PLAN_DEFINITIONS: readonly PlanDefinition[] = [
  {
    id: 'premium', name: 'Premium',
    summary: 'One membership for personalized routine guidance, reviewed education, and Skin Coach support.',
    best_for: 'People who want a connected skincare guidance experience in one membership.',
    features: ['Skin Match and saved profile', 'Personalized routine guidance', 'Skin Coach guidance with account controls'],
    comparison: { skin_match: 'Included', routine_guidance: 'Personalized guidance', coach: 'Included with safeguards', shared_access: 'Not included', business_tools: 'Not included' },
    env_prefix: 'PREMIUM',
  },
] as const;

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
    reason: 'Premium is the single available membership and is not a personalized pricing recommendation.',
  };
}
