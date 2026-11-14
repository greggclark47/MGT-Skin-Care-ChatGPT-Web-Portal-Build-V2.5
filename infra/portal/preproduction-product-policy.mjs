// Proposed commercial policy only: it does not configure Stripe or grant entitlements.
export const PROPOSED_PLANS = Object.freeze([
  Object.freeze({ id: 'free', monthly_cents: 0, annual_cents: 0 }),
  Object.freeze({ id: 'guided', monthly_cents: 1499, annual_cents: 14999 }),
  Object.freeze({ id: 'studio', monthly_cents: 2999, annual_cents: 29999 }),
]);

// Text guidance proposal. Vision, embeddings, safety gates, and entitlement checks
// remain separate; model availability and quality must be verified before activation.
export const PROPOSED_TEXT_ROUTING = Object.freeze([
  Object.freeze({ provider: 'ollama', model: 'deepseek-r1:8b', role: 'primary' }),
  Object.freeze({ provider: 'ollama', model: null, family: 'qwen', role: 'fallback', requires_model_selection: true }),
  Object.freeze({ provider: 'openai', model: null, role: 'hosted_fallback', requires_model_selection: true }),
]);

export function preproductionPolicyStatus() {
  return {
    status: 'not_ready',
    commercial_policy: 'proposal_only',
    payment_gateway: 'stripe',
    proposed_plans: PROPOSED_PLANS,
    proposed_text_routing: PROPOSED_TEXT_ROUTING,
    blockers: [
      'three_tier_entitlements_and_migration_not_implemented',
      'stripe_price_bindings_and_sandbox_evidence_missing',
      'qwen_and_hosted_model_selection_and_qualification_missing',
      'google_cloud_storage_access_and_restore_evidence_missing',
      'candidate_and_live_environment_evidence_missing',
    ],
  };
}
