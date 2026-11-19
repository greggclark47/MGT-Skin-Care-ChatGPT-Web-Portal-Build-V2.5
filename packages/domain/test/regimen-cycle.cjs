const assert = require('node:assert/strict');
const domain = require('../dist');

const now = '2026-10-16T12:00:00.000Z';
const cycle = domain.createRegimenCycle({ focus: 'steady_routine', consent_version: domain.REGIMEN_CYCLE_POLICY_VERSION }, 'account-1', 'cycle_1', now);
assert.equal(cycle.cycle_days, 14);
assert.equal(cycle.ends_at, '2026-10-30T12:00:00.000Z');

const checkIn = domain.createRegimenCycleCheckIn({ cycle_id: cycle.id, status: 'comfortable', completed_at: '2026-10-17T12:00:00.000Z' }, cycle, 'account-1', 'cycle_checkin_1', now);
const active = domain.summarizeRegimenCycle(cycle, [checkIn], Date.parse('2026-10-17T12:00:00.000Z'));
assert.equal(active.rotation_state, 'in_progress');
assert.equal(active.days_remaining, 13);
assert.equal(active.comfortable, 1);
assert.equal(active.deterministic_guidance.routine_changes, 'never_automatic');
assert.equal(active.ai_boundary.can_change_routine, false);

const ready = domain.summarizeRegimenCycle(cycle, [checkIn], Date.parse(cycle.ends_at));
assert.equal(ready.rotation_state, 'ready_for_review');
assert.equal(ready.deterministic_guidance.next_step, 'review_before_next_cycle');
assert.throws(() => domain.createRegimenCycle({ focus: 'unsupported', consent_version: 'regimen-cycle-1' }, 'account-1', 'cycle_2', now), /regimen_cycle_invalid/);
assert.throws(() => domain.createRegimenCycleCheckIn({ cycle_id: cycle.id, status: 'comfortable', completed_at: '2026-11-01T12:00:00.000Z' }, cycle, 'account-1', 'cycle_checkin_2', now), /out_of_range/);

console.log('regimen cycle domain checks passed');
