import assert from "node:assert/strict";
import test from "node:test";
import { STAGING_EVIDENCE_GATES, validateStagingEvidence } from "./staging-evidence.mjs";

const candidateCommit = "a".repeat(40);
const images = {
  node: `node@sha256:${"c".repeat(64)}`,
  ollama: `ollama/ollama@sha256:${"a".repeat(64)}`,
  caddy: `caddy@sha256:${"b".repeat(64)}`
};
const owners = { release: "MGT Release Owner", platform: "MGT Platform Owner" };

function validLedger() {
  const target = {
    version: "1.0",
    environment: "staging",
    candidate_commit: candidateCommit,
    origin: "https://staging.mgtskincare.test",
    deployment_reference: "work/staging/2026-09-30/deployment.md",
    isolation_reference: "work/staging/2026-09-30/isolation.md",
    secret_injection_reference: "work/staging/2026-09-30/secret-injection.md",
    images
  };
  const healthProbe = {
    version: "1.0",
    origin: target.origin,
    captured_at: "2026-09-30T00:00:00.000Z",
    status: "pass",
    checks: ["/healthz", "/readyz"].map((pathname) => ({ pathname, expected_status: 200, actual_status: 200, service_status: "ok", duration_ms: 12, status: "pass" }))
  };
  const attestation = {
    version: "1.0",
    candidate_commit: candidateCommit,
    target_origin: target.origin,
    images,
    generated_at: "2026-09-30T00:00:00.000Z",
    status: "pass",
    preflight: { status: "pass", reference: "work/staging/2026-09-30/preflight.md", checksum: `sha256:${"e".repeat(64)}` },
    probe: { status: "pass", reference: "work/staging/2026-09-30/probe.json", checksum: `sha256:${"f".repeat(64)}` }
  };
  const records = STAGING_EVIDENCE_GATES.map((gate) => ({
    id: gate.id,
    phase: gate.phase,
    gate: gate.gate,
    requirement: gate.requirement,
    owner: owners[gate.owner_role],
    captured_at: "2026-09-30T00:00:00.000Z",
    environment: "staging",
    action: "Recorded approved staging command",
    expected_result: "Required gate passes",
    actual_result: "Required gate passed",
    status: "pass",
    reference: `work/staging/2026-09-30/${gate.id}.md`,
    checksum: `sha256:${"d".repeat(64)}`,
    blocker_state: "resolved",
    rollback_reference: "work/rollback/2026-09-30/staging.md"
  }));
  return {
    version: "1.2",
    environment: "staging",
    target,
    health_probe: healthProbe,
    attestation,
    artifacts: {
      version: "1.0",
      candidate_commit: candidateCommit,
      generated_at: "2026-09-30T00:00:00.000Z",
      status: "pass",
      entries: [
        ["deployment", target.deployment_reference, `sha256:${"1".repeat(64)}`],
        ["isolation", target.isolation_reference, `sha256:${"2".repeat(64)}`],
        ["secret_injection", target.secret_injection_reference, `sha256:${"3".repeat(64)}`],
        ["preflight", attestation.preflight.reference, attestation.preflight.checksum],
        ["probe", attestation.probe.reference, attestation.probe.checksum],
        ["rollback", records[0].rollback_reference, `sha256:${"4".repeat(64)}`]
      ].map(([id, reference, checksum]) => ({ id, reference, checksum, bytes: 12 }))
    },
    records
  };
}

test("accepts complete staging evidence bound to the candidate and images", () => {
  const result = validateStagingEvidence(validLedger(), { candidateCommit, images, owners });
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("rejects incomplete, mismatched, or unresolved staging records", () => {
  const ledger = validLedger();
  ledger.target.candidate_commit = "b".repeat(40);
  ledger.artifacts.entries[3].checksum = `sha256:${"0".repeat(64)}`;
  ledger.records[0].checksum = "sha256:bad";
  ledger.records[1].owner = "Different Owner";
  ledger.records[2].blocker_state = "pending";
  ledger.records.pop();
  const result = validateStagingEvidence(ledger, { candidateCommit, images, owners });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("target.candidate_commit")));
  assert.ok(result.errors.some((error) => error.includes("artifacts.preflight.checksum must match")));
  assert.ok(result.errors.some((error) => error.includes("checksum")));
  assert.ok(result.errors.some((error) => error.includes("owner must match")));
  assert.ok(result.errors.some((error) => error.includes("blocker_state")));
  assert.ok(result.errors.some((error) => error.includes("evidence_ledger must appear")));
});

test("rejects credential-like values in evidence", () => {
  const ledger = validLedger();
  ledger.records[0].actual_result = "Validated sk_live_not_for_evidence";
  const result = validateStagingEvidence(ledger, { candidateCommit, images, owners });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("credential-like")));
});
