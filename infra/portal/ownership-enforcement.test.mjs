import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { DEFAULT_ACCOUNTABLE_OWNER as OWNER, isAccountableOwner, accountableOwnerError, validateOwnershipEnvironment } from './ownership.mjs';
import { validateEnvironment } from './preflight.mjs';
import { createProductionGateTemplate, validateProductionGate, evaluateProductionGate } from './production-gate.mjs';
import { validateShipPacket } from './ship-packet.mjs';
import { createStagingEvidenceTemplate, validateStagingEvidence } from './staging-evidence.mjs';
import { validateStagingPromotionApproval } from './staging-promotion-approval.mjs';
import { validateStagingPromotionAuthorization } from './staging-promotion-authorization.mjs';

const now = '2026-10-01T12:00:00.000Z';
const roles = ['release', 'platform', 'data', 'support', 'accessibility'];
const invalid = [
  ['missing', undefined], ['null', null], ['empty', ''], ['delegate', 'Unrecorded delegate'],
  ['leading space', ' ' + OWNER], ['trailing newline', OWNER + '\n'],
  ['wrong case', OWNER.toLowerCase()], ['number', 42], ['array', [OWNER]],
  ['coercible object', { toString: () => OWNER }]
];
function production() {
  const images = Object.fromEntries(['node','api','web','ollama','caddy'].map(component => [component, component + '@sha256:' + 'a'.repeat(64)]));
  const gate = createProductionGateTemplate({ candidateCommit: 'b'.repeat(40), images });
  gate.origin = 'https://portal.mgtskincare.test';
  gate.source_environment_review = 'work/production/staging-review.md';
  for (const check of gate.checks) Object.assign(check, {
    status: 'pass', captured_at: now, actual_result: 'Synthetic observed result',
    reference: 'work/production/' + check.id + '.md', checksum: 'sha256:' + 'c'.repeat(64),
    rollback_reference: 'work/production/rollback.md'
  });
  for (const approval of gate.approvals) Object.assign(approval, { decision: 'go', reviewed_at: now });
  Object.assign(gate.decision, { decision: 'go', reviewed_at: now, reference: 'work/production/decision.md' });
  return gate;
}
// The example packet is intentionally incomplete. These tests assert NEW,
// field-specific ownership failures, not an already-false overall packet result.
// Existing ship-packet tests separately prove complete canonical packets pass.
function packet() {
  return JSON.parse(fs.readFileSync(new URL('./ship-packet.example.json', import.meta.url), 'utf8'));
}
function approval(role, approver = OWNER) {
  return { version: '1.0', role, decision: 'approve', approver, approved_at: now,
    handoff_checksum: 'sha256:' + 'a'.repeat(64), reference: 'work/approvals/' + role + '.md',
    execution_window: { start: '2026-10-01T12:10:00.000Z', end: '2026-10-01T13:00:00.000Z' } };
}
function assertRejected(result, field) {
  assert.equal(result.ok, false);
  assert(result.errors.includes(accountableOwnerError(field)), result.errors.join('\n'));
}
const surfaces = [
  ...['RELEASE_OWNER_NAME', 'SUPPORT_OWNER_NAME'].map(key => ({
    name: 'preflight ' + key,
    check(value) {
      const env = { RELEASE_OWNER_NAME: OWNER, SUPPORT_OWNER_NAME: OWNER, [key]: value };
      assertRejected(validateOwnershipEnvironment(env), key);
      assertRejected(validateEnvironment(env), key);
    }
  })),
  { name: 'production role owners', check(value) {
    for (const role of roles) {
      const gate = production(); gate.owners[role] = value;
      assertRejected(validateProductionGate(gate, { now }), 'owners.' + role);
      assert.equal(evaluateProductionGate(gate, { now }).status, 'blocked');
    }
  }},
  { name: 'production check owners', check(value) {
    for (let i = 0; i < production().checks.length; i++) {
      const gate = production(); gate.checks[i].owner = value;
      assertRejected(validateProductionGate(gate, { now }), gate.checks[i].id + '.owner');
    }
  }},
  { name: 'production role approvers', check(value) {
    for (const role of roles) {
      const gate = production(); gate.approvals.find(a => a.role === role).approver = value;
      assertRejected(validateProductionGate(gate, { now }), role + '.approver');
    }
  }},
  { name: 'production release decider', check(value) {
    const gate = production(); gate.decision.decider = value;
    assertRejected(validateProductionGate(gate, { now }), 'decision.decider');
  }},
  { name: 'ship packet role owners', check(value) {
    for (const role of roles) {
      const p = packet(); p.owners[role] = value;
      assertRejected(validateShipPacket(p), 'owners.' + role);
    }
  }},
  { name: 'ship packet evidence reviewer', check(value) {
    const p = packet(); p.evidence[0].reviewer = value;
    assertRejected(validateShipPacket(p), p.evidence[0].id + '.reviewer');
  }},
  { name: 'ship packet monitoring owner', check(value) {
    const p = packet(); p.monitoring.owner = value;
    assertRejected(validateShipPacket(p), 'monitoring.owner');
  }},
  { name: 'staging promotion approver', check(value) {
    for (const role of ['release', 'platform']) assertRejected(validateStagingPromotionApproval({ ...approval(role), approver: value }, { now }), 'approver');
  }}
];
assert.equal(surfaces.length * invalid.length, 100);
for (const surface of surfaces) for (const [variant, value] of invalid) {
  test('exact ownership rejects ' + variant + ' at ' + surface.name, () => surface.check(value));
}

test('canonical ownership preserves valid synthetic decisions without changing decisions or role labels', () => {
  assert.equal(isAccountableOwner(OWNER), true);
  assert.deepEqual(validateOwnershipEnvironment({ RELEASE_OWNER_NAME: OWNER, SUPPORT_OWNER_NAME: OWNER }), { ok: true, errors: [] });
  const gate = production();
  assert.equal(validateProductionGate(gate, { now }).ok, true);
  assert.equal(evaluateProductionGate(gate, { now }).status, 'go_recorded');
  for (const role of ['release','platform']) assert.equal(validateStagingPromotionApproval(approval(role), { now }).ok, true);
  const errors = validateShipPacket(packet()).errors;
  assert(!errors.some(error => error.includes('must equal ' + OWNER)));
  const draft = createProductionGateTemplate();
  assert.equal(draft.decision.decision, 'hold');
  assert(draft.approvals.every(a => a.decision === 'pending'));
  assert.deepEqual(draft.approvals.map(a => a.role).sort(), roles.toSorted());
});

test('ship approvers and staging evidence owners use the same exact policy', () => {
  for (const [,value] of invalid) {
    for (const role of roles) {
      const p = packet(); p.approvals.find(a => a.role === role).approver = value;
      assertRejected(validateShipPacket(p), role + '.approver');
    }
    for (let i = 0; i < 4; i++) {
      const ledger = createStagingEvidenceTemplate();
      ledger.records[i].owner = value;
      assertRejected(validateStagingEvidence(ledger), ledger.records[i].id + '.owner');
    }
  }
});

test('a ready authorization cannot bypass owner checks through its embedded summary', () => {
  const good = {
    version: '1.0', created_at: now, status: 'pending_operator_execution',
    candidate_commit: 'a'.repeat(40), staging_origin: 'https://staging.mgtskincare.test',
    handoff: { checksum: 'sha256:' + 'a'.repeat(64), canonical_checksum: 'sha256:' + 'b'.repeat(64) },
    approvals: ['release','platform'].map(role => ({ role, approver: OWNER })),
    checks: ['handoff_integrity','release_approval','platform_approval','shared_execution_window','operator_execution']
      .map(id => ({ id, status: id === 'operator_execution' ? 'pending' : 'pass', error_count: 0 })),
    operator_execution: { status: 'pending' }, blockers: []
  };
  assert.equal(validateStagingPromotionAuthorization(good, { now }).ok, true);
  for (const [,value] of invalid) {
    const changed = structuredClone(good);
    changed.approvals[0].approver = value;
    assertRejected(validateStagingPromotionAuthorization(changed, { now }), 'approvals.approver');
  }
});

test('canonical diagnostic never repeats an invalid submitted name', () => {
  const submitted = 'Untrusted diagnostic sentinel';
  const env = { RELEASE_OWNER_NAME: submitted, SUPPORT_OWNER_NAME: OWNER };
  const result = validateOwnershipEnvironment(env);
  assert.equal(JSON.stringify(result).includes(submitted), false);
  assert.equal(env.RELEASE_OWNER_NAME, submitted, 'validation must not rewrite the input');
});
