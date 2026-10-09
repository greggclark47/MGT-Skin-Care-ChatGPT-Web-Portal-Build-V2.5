import assert from "node:assert/strict";
import test from "node:test";
import { createProductionGateTemplate, evaluateProductionGate, PRODUCTION_GATE_CHECKS, PRODUCTION_GATE_OWNER_ROLES, validateProductionGate } from "./production-gate.mjs";

const images = {
  node: `node@sha256:${"c".repeat(64)}`,
  api: `ghcr.io/mgt/api@sha256:${"d".repeat(64)}`,
  web: `ghcr.io/mgt/web@sha256:${"e".repeat(64)}`,
  ollama: `ollama/ollama@sha256:${"a".repeat(64)}`,
  caddy: `caddy@sha256:${"b".repeat(64)}`
};

function completeGate() {
  const gate = createProductionGateTemplate({ candidateCommit: "a".repeat(40), images });
  gate.origin = "https://portal.mgtskincare.test";
  gate.source_environment_review = "work/production/staging-dossier.md";
  gate.owners = Object.fromEntries(PRODUCTION_GATE_OWNER_ROLES.map((role) => [role, `MGT ${role} owner`]));
  gate.checks = PRODUCTION_GATE_CHECKS.map((definition) => ({
    ...definition,
    owner: gate.owners[definition.owner_role],
    status: "pass",
    captured_at: "2026-10-01T00:00:00.000Z",
    actual_result: "Recorded approved production evidence",
    reference: `work/production/${definition.id}.md`,
    checksum: `sha256:${"d".repeat(64)}`,
    rollback_reference: "work/production/rollback.md"
  }));
  gate.approvals = PRODUCTION_GATE_OWNER_ROLES.map((role) => ({ role, decision: "go", approver: gate.owners[role], reviewed_at: "2026-10-01T00:00:00.000Z", reference: `work/production/approvals/${role}.md` }));
  gate.decision = { status: "recorded", decision: "go", decider: gate.owners.release, reviewed_at: "2026-10-01T00:00:00.000Z", reference: "work/production/go-no-go.md" };
  return gate;
}

test("accepts a complete production evidence matrix and records only a decision status", () => {
  const gate = completeGate();
  const validation = validateProductionGate(gate, { candidateCommit: gate.candidate_commit, images, now: "2026-10-01T01:00:00.000Z" });
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.deepEqual(evaluateProductionGate(gate, { candidateCommit: gate.candidate_commit, images, now: "2026-10-01T01:00:00.000Z" }), { status: "go_recorded", errors: [] });
});

test("blocks approvals and go decisions attributed to a different declared owner", () => {
  for (const role of PRODUCTION_GATE_OWNER_ROLES) {
    const gate = completeGate();
    gate.approvals.find(approval => approval.role === role).approver = 'Unrecorded delegate';
    const result = evaluateProductionGate(gate);
    assert.equal(result.status, 'blocked');
    assert(result.errors.some(error => error.includes(`approver must match owners.${role}`)));
  }
  const gate = completeGate();
  gate.decision.decider = 'Unrecorded delegate';
  assert(evaluateProductionGate(gate).errors.includes('decision.decider must match owners.release'));
});

test("fails closed for staging targets, incomplete evidence, secret-like text, and fabricated readiness", () => {
  const gate = completeGate();
  gate.origin = "https://staging.mgtskincare.test";
  gate.checks[0].status = "pending";
  gate.checks[0].actual_result = "pending";
  gate.decision.decision = "go";
  gate.approvals[0].decision = "pending";
  gate.checks[1].actual_result = "STRIPE_SECRET=do-not-record";
  const evaluation = evaluateProductionGate(gate, { candidateCommit: gate.candidate_commit, images, now: "2026-10-01T01:00:00.000Z" });
  assert.equal(evaluation.status, "blocked");
  assert.ok(evaluation.errors.some((error) => error.includes("production origin")));
  assert.ok(evaluation.errors.some((error) => error.includes("go decision requires")));
  assert.ok(evaluation.errors.some((error) => error.includes("credential-like")));

  const template = createProductionGateTemplate();
  assert.equal(Object.values(template.owners).every((owner) => owner === "Gregg Clark of MGT"), true);
  assert.equal(template.approvals.every((approval) => approval.approver === "Gregg Clark of MGT"), true);
  assert.equal(template.decision.decider, "Gregg Clark of MGT");
  assert.equal(evaluateProductionGate(template).status, "blocked");
});
