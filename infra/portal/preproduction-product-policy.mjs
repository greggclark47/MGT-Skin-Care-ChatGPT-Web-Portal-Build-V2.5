// Candidate commercial policy: application workflows are implemented, but this module
// never configures Stripe, grants entitlements, or authorizes production activation.
export const PROPOSED_PLANS = Object.freeze([
  Object.freeze({ id: 'free', name: 'Free', monthly_cents: 0, annual_cents: 0, enrollment: 'available_without_billing' }),
  Object.freeze({ id: 'premium', name: 'Guided', monthly_cents: null, annual_cents: null, enrollment: 'pending_approved_stripe_prices' }),
  Object.freeze({ id: 'studio', name: 'Studio', monthly_cents: null, annual_cents: null, enrollment: 'pending_approved_stripe_prices' }),
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
    status: 'release_pending',
    commercial_policy: 'application_workflow_implemented_activation_pending',
    payment_gateway: 'stripe',
    proposed_plans: PROPOSED_PLANS,
    proposed_text_routing: PROPOSED_TEXT_ROUTING,
    blockers: [
      'stripe_price_bindings_and_sandbox_evidence_missing',
      'subscription_terms_and_provider_configuration_approval_missing',
      'qwen_and_hosted_model_selection_and_qualification_missing',
      'google_cloud_storage_access_and_restore_evidence_missing',
      'candidate_and_live_environment_evidence_missing',
    ],
  };
}
