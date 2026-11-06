export const BILLING_CYCLES = ['monthly', 'annual'] as const;
export type BillingCycle = typeof BILLING_CYCLES[number];

export type PlanDefinition = {
  id: 'premium' | 'studio';
  name: string;
  summary: string;
  best_for: string;
  features: string[];
  comparison: Record<string, string>;
  env_prefix: 'PREMIUM' | 'STUDIO';
};

export type AccessLevelDefinition = {
  id: 'free';
  name: string;
  summary: string;
  features: string[];
  comparison: Record<string, string>;
};

export const PLAN_COMPARISON_ROWS = [
  { id: 'skin_match', label: 'Profile and Skin Match' },
  { id: 'routine_guidance', label: 'Routine guidance' },
  { id: 'ai_depth', label: 'AI guidance depth' },
  { id: 'progress', label: 'Progress and photo journal' },
  { id: 'style', label: 'Color, wardrobe, and retail' },
  { id: 'experience', label: 'Membership experience' },
  { id: 'support', label: 'Support' },
] as const;

// Free is the non-billable baseline, not a Stripe plan. Keeping it outside
// PLAN_DEFINITIONS preserves one paid product while making the comparison clear.
export const FREE_ACCESS: AccessLevelDefinition = {
  id: 'free',
  name: 'Free',
  summary: 'A practical starting point for building a profile, exploring core care guidance, and learning without a recurring charge.',
  features: ['Saved profile and core Skin Match', 'Starter routine and reviewed education', 'Clearly labeled sponsor-supported experience'],
  comparison: {
    skin_match: 'Saved profile and core match',
    routine_guidance: 'Starter routine',
    ai_depth: 'Basic guidance preview',
    progress: 'Current profile and routine',
    style: 'Core color and retail discovery',
    experience: 'Clearly labeled sponsor-supported experience',
    support: 'Standard self-service support',
  },
};

// The existing `premium` identifier and PREMIUM environment prefix are retained
// for billing continuity; its customer-facing name is Guided. Studio is a second
// paid tier and remains fail-closed until both approved prices are configured.
export const PLAN_DEFINITIONS: readonly PlanDefinition[] = [
  {
    id: 'premium', name: 'Guided',
    summary: 'Ongoing personalized support that connects routines, progress, color, wardrobe, and retail discovery.',
    best_for: 'Customers who want consistent guidance, biweekly routine refinement, and an ad-free membership experience.',
    features: ['Full personalized routines and biweekly updates', 'Progress and image-journal history', 'Connected color, wardrobe, reminders, and enhanced exports'],
    comparison: { skin_match: 'Full personalized match', routine_guidance: 'Personalized with biweekly updates', ai_depth: 'Standard account-aware guidance', progress: 'Progress history and image journal', style: 'Connected color, wardrobe, and retail guidance', experience: 'Ad-free membership experience', support: 'Enhanced customer support' },
    env_prefix: 'PREMIUM',
  },
  {
    id: 'studio', name: 'Studio',
    summary: 'The most complete Team 47 Studio experience, with the highest available output depth and end-to-end coordination.',
    best_for: 'Customers who want optimal-quality mode, deeper cross-domain synthesis, and priority support within reviewed safeguards.',
    features: ['Everything in Guided', 'Highest available AI depth and cross-domain synthesis', 'Advanced exports, trusted guest access, priority support, and early features'],
    comparison: { skin_match: 'Full match with deeper synthesis', routine_guidance: 'Advanced end-to-end coordination', ai_depth: 'Highest available depth and optimal-quality mode', progress: 'Advanced history, journal, and exports', style: 'Complete care, color, style, and retail orchestration', experience: 'Most complete experience and early features', support: 'Priority customer support' },
    env_prefix: 'STUDIO',
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
    reason: 'Guided is a balanced starting point for ongoing support. Compare every tier before choosing; this is not an automatic enrollment or personalized pricing decision.',
  };
}
