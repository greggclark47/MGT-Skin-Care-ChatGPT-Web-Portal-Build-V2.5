import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preproductionPolicyStatus } from './preproduction-product-policy.mjs';

test('candidate policy keeps implemented membership workflows held until external activation evidence exists', () => {
  const status = preproductionPolicyStatus();
  assert.equal(status.status, 'release_pending');
  assert.equal(status.payment_gateway, 'stripe');
  assert.deepEqual(status.proposed_plans.map(p => [p.id, p.name, p.monthly_cents, p.annual_cents]), [
    ['free', 'Free', 0, 0], ['premium', 'Guided', null, null], ['studio', 'Studio', null, null],
  ]);
  assert.deepEqual(status.proposed_text_routing.map(p => p.role), ['primary', 'fallback', 'hosted_fallback']);
  assert.equal(status.proposed_text_routing[1].model, null);
  assert.ok(status.blockers.includes('stripe_price_bindings_and_sandbox_evidence_missing'));
  assert.ok(!status.blockers.includes('three_tier_entitlements_and_migration_not_implemented'));
});
