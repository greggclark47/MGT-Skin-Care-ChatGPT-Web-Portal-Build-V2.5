const assert = require('node:assert/strict');
const test = require('node:test');
const { MEMBERSHIP_CHANGE_POLICY, MEMBERSHIP_COMPARISON_ROWS, MEMBERSHIP_TIER_CONTENT } = require('../dist');

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
