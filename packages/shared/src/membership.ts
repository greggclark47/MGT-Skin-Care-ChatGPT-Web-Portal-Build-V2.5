export const MEMBERSHIP_COMPARISON_ROWS = [
  { id: 'skin_match', label: 'Profile and Skin Match' },
  { id: 'routine_guidance', label: 'Routine guidance' },
  { id: 'ai_depth', label: 'AI guidance depth' },
  { id: 'progress', label: 'Progress and photo journal' },
  { id: 'style', label: 'Color, wardrobe, and retail' },
  { id: 'experience', label: 'Membership experience' },
  { id: 'support', label: 'Support' },
] as const;

export type MembershipComparisonId = typeof MEMBERSHIP_COMPARISON_ROWS[number]['id'];
export type MembershipTierId = 'free' | 'premium' | 'studio';

export const MEMBERSHIP_TIER_CONTENT: ReadonlyArray<{
  id: MembershipTierId;
  name: string;
  summary: string;
  best_for: string;
  features: readonly string[];
  comparison: Readonly<Record<MembershipComparisonId, string>>;
}> = [
  {
    id: 'free',
    name: 'Free',
    summary: 'A practical starting point for building a profile, exploring core care guidance, and learning without a recurring charge.',
    best_for: 'Customers who want to explore the core experience without a recurring charge.',
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
  },
  {
    id: 'premium',
    name: 'Guided',
    summary: 'Ongoing personalized support that connects routines, progress, color, wardrobe, and retail discovery.',
    best_for: 'Customers who want consistent guidance, biweekly routine refinement, and an ad-free membership experience.',
    features: ['Full personalized routines and biweekly updates', 'Progress and image-journal history', 'Connected color, wardrobe, reminders, and enhanced exports'],
    comparison: {
      skin_match: 'Full personalized match',
      routine_guidance: 'Personalized with biweekly updates',
      ai_depth: 'Standard account-aware guidance',
      progress: 'Progress history and image journal',
      style: 'Connected color, wardrobe, and retail guidance',
      experience: 'Ad-free membership experience',
      support: 'Enhanced customer support',
    },
  },
  {
    id: 'studio',
    name: 'Studio',
    summary: 'The most complete Team 47 Studio experience, with the highest available output depth and end-to-end coordination.',
    best_for: 'Customers who want optimal-quality mode, deeper cross-domain synthesis, and priority support within reviewed safeguards.',
    features: ['Everything in Guided', 'Highest available AI depth and cross-domain synthesis', 'Advanced exports, trusted guest access, priority support, and early features'],
    comparison: {
      skin_match: 'Full match with deeper synthesis',
      routine_guidance: 'Advanced end-to-end coordination',
      ai_depth: 'Highest available depth and optimal-quality mode',
      progress: 'Advanced history, journal, and exports',
      style: 'Complete care, color, style, and retail orchestration',
      experience: 'Most complete experience and early features',
      support: 'Priority customer support',
    },
  },
] as const;

export const MEMBERSHIP_CHANGE_POLICY = {
  period_end: 'Plan changes and downgrades normally begin after the current paid billing period.',
  annual_upgrade: 'An equal or higher annual prepaid upgrade can begin immediately. Unused paid time is applied as credit toward the annual balance.',
  confirmation: 'Pricing, credit, timing, and any amount due are shown in the secure account portal before confirmation.',
} as const;
