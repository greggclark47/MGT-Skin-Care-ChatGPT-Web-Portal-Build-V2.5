import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createProductionGateTemplate, PRODUCTION_GATE_CHECKS, PRODUCTION_GATE_OWNER_ROLES } from "./production-gate.mjs";
import { buildProductionEvidence, validateProductionEvidence, verifyProductionEvidence } from "./production-evidence.mjs";

const candidateCommit = "a".repeat(40);
const images = { node: `node@sha256:${"c".repeat(64)}`, api: `ghcr.io/mgt/api@sha256:${"d".repeat(64)}`, web: `ghcr.io/mgt/web@sha256:${"e".repeat(64)}`, ollama: `ollama/ollama@sha256:${"a".repeat(64)}`, caddy: `caddy@sha256:${"b".repeat(64)}` };

function writeArtifact(root, reference, content) {
  const destination = path.join(root, reference);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

function checksum(root, reference) {
  return `sha256:${createHash("sha256").update(fs.readFileSync(path.join(root, reference))).digest("hex")}`;
}

function completeGate(root) {
  const gate = createProductionGateTemplate({ candidateCommit, images });
  gate.origin = "https://portal.mgtskincare.test";
  gate.source_environment_review = "work/production/staging-dossier.md";
  writeArtifact(root, gate.source_environment_review, "Staging dossier evidence\n");
  gate.owners = Object.fromEntries(PRODUCTION_GATE_OWNER_ROLES.map((role) => [role, `MGT ${role} owner`]));
  gate.checks = PRODUCTION_GATE_CHECKS.map((definition) => {
    const reference = `work/production/${definition.id}.md`;
    const rollbackReference = `work/production/rollback/${definition.id}.md`;
    writeArtifact(root, reference, `${definition.id} production evidence\n`);
    writeArtifact(root, rollbackReference, `${definition.id} rollback evidence\n`);
    return { ...definition, owner: gate.owners[definition.owner_role], status: "pass", captured_at: "2026-10-01T00:00:00.000Z", actual_result: "Recorded production evidence", reference, checksum: `sha256:${"d".repeat(64)}`, rollback_reference: rollbackReference };
  });
  gate.approvals = PRODUCTION_GATE_OWNER_ROLES.map((role) => {
    const reference = `work/production/approvals/${role}.md`;
    writeArtifact(root, reference, `${role} approval decision\n`);
    return { role, decision: "go", approver: `MGT ${role} approver`, reviewed_at: "2026-10-01T00:00:00.000Z", reference };
  });
  gate.decision = { status: "recorded", decision: "go", decider: "MGT Release Decider", reviewed_at: "2026-10-01T00:00:00.000Z", reference: "work/production/go-no-go.md" };
  writeArtifact(root, gate.decision.reference, "Go no-go decision\n");
  for (const check of gate.checks) check.checksum = checksum(root, check.reference);
  return gate;
}

test("binds a complete production gate to inspectable local evidence", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-production-evidence-"));
  try {
    const gate = completeGate(root);
    const evidence = buildProductionEvidence({ root, gate, now: "2026-10-01T01:00:00.000Z" });
    const validation = validateProductionEvidence(evidence, { gate, now: "2026-10-01T01:00:00.000Z" });
    assert.equal(validation.ok, true, validation.errors.join("\n"));
    const verification = verifyProductionEvidence({ root, evidence });
    assert.equal(verification.ok, true, verification.errors.join("\n"));
    assert.equal(verification.verified.length, 23);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("fails closed when a production artifact changes, is secret-like, or is detached from the gate", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-production-evidence-"));
  try {
    const gate = completeGate(root);
    const evidence = buildProductionEvidence({ root, gate, now: "2026-10-01T01:00:00.000Z" });
    writeArtifact(root, gate.checks[0].reference, "Changed production evidence\n");
    const changed = verifyProductionEvidence({ root, evidence });
    assert.equal(changed.ok, false);
    assert.ok(changed.errors.some((error) => error.includes("evidence:target_identity checksum")));

    writeArtifact(root, gate.checks[1].reference, "STRIPE_SECRET=must-not-be-recorded\n");
    assert.throws(() => buildProductionEvidence({ root, gate, now: "2026-10-01T01:00:00.000Z" }), /credential-like/);

    const detached = { ...evidence, gate_checksum: `sha256:${"0".repeat(64)}` };
    const validation = validateProductionEvidence(detached, { gate, now: "2026-10-01T01:00:00.000Z" });
    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => error.includes("gate_checksum")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
