import assert from 'node:assert/strict';
import test from 'node:test';
import { assessStripeSubscriptionReadiness } from './stripe-subscription-readiness.mjs';

function candidate(overrides = {}) {
  return {
    schema_version: 1,
    candidate: 'aa4a382',
    environment: 'staging',
    portal_origin: 'https://staging.team47studio.com',
    webhook_url: 'https://staging.team47studio.com/webhooks/subscriptions',
    subscriptions_enabled: true,
    stripe_live_mode: false,
    subscription_terms_approved: true,
    stripe_product_id: 'prod_team47',
    premium_monthly_price_id: 'price_guidedmonthly',
    premium_annual_price_id: 'price_guidedannual',
    studio_monthly_price_id: 'price_studiomonthly',
    studio_annual_price_id: 'price_studioannual',
    customer_portal: { payment_method_update: true, invoice_history: true, subscription_cancel: true, subscription_update: false },
    event_destination: { configured: true, signature_verified: true },
    secret_manager: { api_key_reference: 'projects/team47/secrets/stripe-key/versions/4', webhook_secret_reference: 'projects/team47/secrets/stripe-webhook/versions/3' },
    sandbox_checkout_verified: true,
    live_mode_reviewed: false,
    release_evidence: { account_management_verified: true, checkout_verified: true, webhook_verified: true, customer_portal_verified: true },
    ...overrides,
  };
}

test('accepts a complete staging candidate without rendering identifiers', () => {
  const result = assessStripeSubscriptionReadiness(candidate());
  assert.equal(result.ready, true);
  assert.equal(result.holds.length, 0);
  assert.match(result.posture.ids.stripe_product_id, /^[a-f0-9]{12}$/);
  assert.notEqual(result.posture.ids.stripe_product_id, 'prod_team47');
});

test('requires the exact signed webhook boundary and secret references only', () => {
  const result = assessStripeSubscriptionReadiness(candidate({
    webhook_url: 'https://evil.example/webhooks/subscriptions',
    secret_manager: { api_key_reference: 'sk_test_this_must_not_be_here', webhook_secret_reference: 'projects/team47/secrets/stripe-webhook/versions/3' },
  }));
  assert.equal(result.ready, false);
  assert.ok(result.holds.some(item => item.includes('exact /webhooks/subscriptions path')));
  assert.ok(result.holds.some(item => item.includes('references only')));
});

test('requires a separate reviewed live-mode production candidate', () => {
  const result = assessStripeSubscriptionReadiness(candidate({ environment: 'production', stripe_live_mode: true, live_mode_reviewed: false, sandbox_checkout_verified: false }));
  assert.equal(result.ready, false);
  assert.ok(result.holds.some(item => item.includes('live_mode_reviewed')));
});
