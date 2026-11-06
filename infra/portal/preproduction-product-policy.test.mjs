import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preproductionPolicyStatus } from './preproduction-product-policy.mjs';

test('proposed policy stays held while commercial and provider integration is incomplete', () => {
  const status = preproductionPolicyStatus();
  assert.equal(status.status, 'not_ready');
  assert.equal(status.payment_gateway, 'stripe');
  assert.deepEqual(status.proposed_plans.map(p => [p.id, p.monthly_cents, p.annual_cents]), [
    ['free', 0, 0], ['guided', 1499, 14999], ['studio', 2999, 29999],
  ]);
  assert.deepEqual(status.proposed_text_routing.map(p => p.role), ['primary', 'fallback', 'hosted_fallback']);
  assert.equal(status.proposed_text_routing[1].model, null);
  assert.ok(status.blockers.includes('three_tier_entitlements_and_migration_not_implemented'));
});
