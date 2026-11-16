const assert = require('node:assert/strict');
const test = require('node:test');
const { MEMBERSHIP_CHANGE_POLICY, MEMBERSHIP_COMPARISON_ROWS, MEMBERSHIP_TIER_CONTENT, MEMBERSHIP_TRIAL_POLICY } = require('../dist');

test('shared membership contract keeps all three tiers complete across platforms', () => {
  assert.deepEqual(MEMBERSHIP_TIER_CONTENT.map(tier => tier.id), ['free', 'premium', 'studio']);
  assert.deepEqual(MEMBERSHIP_TIER_CONTENT.map(tier => tier.name), ['Free', 'Guided', 'Studio']);
  const rowIds = MEMBERSHIP_COMPARISON_ROWS.map(row => row.id);
  assert.equal(rowIds.length, 7);
  for (const tier of MEMBERSHIP_TIER_CONTENT) {
    assert.ok(tier.summary.length > 40);
    assert.equal(tier.features.length, 3);
    assert.deepEqual(Object.keys(tier.comparison), rowIds);
    assert.ok(Object.values(tier.comparison).every(value => typeof value === 'string' && value.length > 5));
  }
});

test('shared plan-change copy preserves renewal timing and annual paid credit', () => {
  assert.match(MEMBERSHIP_CHANGE_POLICY.period_end, /current paid billing period/i);
  assert.match(MEMBERSHIP_CHANGE_POLICY.annual_upgrade, /annual prepaid upgrade/i);
  assert.match(MEMBERSHIP_CHANGE_POLICY.annual_upgrade, /unused paid time.*credit/i);
  assert.match(MEMBERSHIP_CHANGE_POLICY.confirmation, /before confirmation/i);
});

test('shared trial policy is 14 days and Free never becomes a paid trial', () => {
  assert.equal(MEMBERSHIP_TRIAL_POLICY.days, 14);
  assert.deepEqual(MEMBERSHIP_TRIAL_POLICY.eligible_tiers, ['premium', 'studio']);
  assert.equal(MEMBERSHIP_TRIAL_POLICY.once_per_account, true);
  assert.equal(MEMBERSHIP_TRIAL_POLICY.payment_method_required, true);
  assert.equal(MEMBERSHIP_TRIAL_POLICY.charge_at_start, false);
  assert.equal(MEMBERSHIP_TRIAL_POLICY.missing_payment_method_behavior, 'cancel');
  assert.match(MEMBERSHIP_TRIAL_POLICY.conversion, /trial ends.*unless.*cancels/i);
  const free = MEMBERSHIP_TIER_CONTENT.find(tier => tier.id === 'free');
  assert.match(free.summary, /permanent \$0/i);
  assert.match(free.summary, /without a payment card, trial deadline, or recurring charge/i);
});
