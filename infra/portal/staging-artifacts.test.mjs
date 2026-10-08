import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildStagingArtifacts, validateStagingArtifacts, verifyStagingArtifacts } from "./staging-artifacts.mjs";
import { STAGING_EVIDENCE_GATES } from "./staging-evidence.mjs";
import { reviewStagingEvidence, validateStagingEvidenceReview } from "./staging-evidence-review.mjs";
import { buildStagingPromotionHandoff, validateStagingPromotionHandoff } from "./staging-promotion-handoff.mjs";

const candidateCommit = "a".repeat(40);
const images = {
  node: `node@sha256:${"c".repeat(64)}`,
  api: `ghcr.io/mgt/api@sha256:${"d".repeat(64)}`,
  web: `ghcr.io/mgt/web@sha256:${"e".repeat(64)}`,
  ollama: `ollama/ollama@sha256:${"a".repeat(64)}`,
  caddy: `caddy@sha256:${"b".repeat(64)}`
};

function writeArtifact(root, reference, content) {
  const destination = path.join(root, reference);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
}

function stagingFixture(root) {
  const references = {
    deployment: "work/staging/2026-09-30/deployment.md",
    isolation: "work/staging/2026-09-30/isolation.md",
    secretInjection: "work/staging/2026-09-30/secret-injection.md",
    preflight: "work/staging/2026-09-30/preflight.md",
    probe: "work/staging/2026-09-30/probe.json",
    rollback: "work/rollback/2026-09-30/staging.md"
  };
  for (const [id, reference] of Object.entries(references)) writeArtifact(root, reference, id === "probe" ? '{"status":"ok"}\n' : `${id} evidence\n`);
  const target = {
    version: "1.0",
    environment: "staging",
    candidate_commit: candidateCommit,
    origin: "https://staging.mgtskincare.test",
    deployment_reference: references.deployment,
    isolation_reference: references.isolation,
    secret_injection_reference: references.secretInjection,
    images
  };
  const records = STAGING_EVIDENCE_GATES.map((gate) => ({
    id: gate.id,
    phase: gate.phase,
    gate: gate.gate,
    requirement: gate.requirement,
    owner: gate.owner_role === "release" ? "MGT Release Owner" : "MGT Platform Owner",
    captured_at: "2026-09-30T00:00:00.000Z",
    environment: "staging",
    action: "Recorded staging action",
    expected_result: "Required gate passes",
    actual_result: "Required gate passed",
    status: "pass",
    reference: `work/staging/2026-09-30/${gate.id}.md`,
    checksum: `sha256:${"d".repeat(64)}`,
    blocker_state: "resolved",
    rollback_reference: references.rollback
  }));
  const attestation = {
    version: "1.0",
    candidate_commit: candidateCommit,
    target_origin: target.origin,
    images,
    generated_at: "2026-09-30T00:00:00.000Z",
    status: "pass",
    preflight: { status: "pass", reference: references.preflight, checksum: `sha256:${"e".repeat(64)}` },
    probe: { status: "pass", reference: references.probe, checksum: `sha256:${"f".repeat(64)}` }
  };
  const artifacts = buildStagingArtifacts({ root, target, attestation, records, now: "2026-09-30T00:01:00.000Z" });
  attestation.preflight.checksum = artifacts.entries.find((entry) => entry.id === "preflight").checksum;
  attestation.probe.checksum = artifacts.entries.find((entry) => entry.id === "probe").checksum;
  const ledger = {
    version: "1.2",
    environment: "staging",
    target,
    health_probe: {
      version: "1.0",
      origin: target.origin,
      captured_at: "2026-09-30T00:00:00.000Z",
      status: "pass",
      checks: ["/healthz", "/readyz"].map((pathname) => ({ pathname, expected_status: 200, actual_status: 200, service_status: "ok", duration_ms: 12, status: "pass" }))
    },
    attestation,
    artifacts,
    records
  };
  return { ledger, references };
}

test("builds and validates an inspectable staging artifact manifest", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-staging-artifacts-"));
  try {
    const { ledger } = stagingFixture(root);
    const validation = validateStagingArtifacts(ledger.artifacts, { candidateCommit, target: ledger.target, attestation: ledger.attestation, records: ledger.records });
    assert.equal(validation.ok, true, validation.errors.join("\n"));
    assert.deepEqual(verifyStagingArtifacts({ root, artifacts: ledger.artifacts }), { ok: true, errors: [], verified: ["deployment", "isolation", "secret_injection", "preflight", "probe", "rollback"] });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("fails closed when a staged artifact changes or contains credential-like text", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-staging-artifacts-"));
  try {
    const { ledger, references } = stagingFixture(root);
    writeArtifact(root, references.probe, '{"status":"changed"}\n');
    const changed = verifyStagingArtifacts({ root, artifacts: ledger.artifacts });
    assert.equal(changed.ok, false);
    assert.ok(changed.errors.some((error) => error.includes("probe checksum")));

    writeArtifact(root, references.secretInjection, "STRIPE_SECRET=not-for-evidence\n");
    assert.throws(() => buildStagingArtifacts({ root, target: ledger.target, attestation: ledger.attestation, records: ledger.records }), /credential-like/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("returns a redacted, pass-or-fail staging evidence review", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-staging-artifacts-"));
  try {
    const { ledger, references } = stagingFixture(root);
    const review = reviewStagingEvidence({ root, ledger, now: "2026-09-30T00:02:00.000Z" });
    assert.equal(review.status, "pass");
    assert.deepEqual(review.verified_artifacts, ["deployment", "isolation", "secret_injection", "preflight", "probe", "rollback"]);

    writeArtifact(root, references.rollback, "changed rollback evidence\n");
    const failed = reviewStagingEvidence({ root, ledger, now: "2026-09-30T00:03:00.000Z" });
    assert.equal(failed.status, "fail");
    assert.ok(failed.errors.some((error) => error.includes("rollback checksum")));
    assert.equal(JSON.stringify(failed).includes("not-for-evidence"), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("binds a fresh review to the exact ledger before preparing human promotion approval", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-staging-artifacts-"));
  try {
    const { ledger } = stagingFixture(root);
    const review = reviewStagingEvidence({ root, ledger, now: "2026-09-30T00:02:00.000Z" });
    const ledgerReference = "work/staging/2026-09-30/staging-evidence.json";
    const reviewReference = "work/staging/2026-09-30/review.json";
    writeArtifact(root, ledgerReference, `${JSON.stringify(ledger, null, 2)}\n`);
    writeArtifact(root, reviewReference, `${JSON.stringify(review, null, 2)}\n`);

    const reviewValidation = validateStagingEvidenceReview(review, { ledger, now: "2026-09-30T00:02:30.000Z", maxAgeMinutes: 5 });
    assert.equal(reviewValidation.ok, true, reviewValidation.errors.join("\n"));
    const handoff = buildStagingPromotionHandoff({ root, ledgerReference, reviewReference, now: "2026-09-30T00:02:30.000Z", maxReviewAgeMinutes: 5 });
    assert.equal(handoff.status, "pending_human_promotion_approval");
    assert.equal(handoff.checks.find((check) => check.id === "human_promotion_approval").status, "pending");
    assert.equal(validateStagingPromotionHandoff(handoff, { now: "2026-09-30T00:02:30.000Z" }).ok, true);

    const stale = buildStagingPromotionHandoff({ root, ledgerReference, reviewReference, now: "2026-09-30T00:10:00.000Z", maxReviewAgeMinutes: 5 });
    assert.equal(stale.status, "blocked");
    assert.ok(stale.blockers.some((blocker) => blocker.includes("freshness")));

    const mismatchedReview = { ...review, ledger_checksum: `sha256:${"0".repeat(64)}` };
    writeArtifact(root, reviewReference, `${JSON.stringify(mismatchedReview, null, 2)}\n`);
    const mismatched = buildStagingPromotionHandoff({ root, ledgerReference, reviewReference, now: "2026-09-30T00:02:30.000Z", maxReviewAgeMinutes: 5 });
    assert.equal(mismatched.status, "blocked");
    assert.ok(mismatched.blockers.some((blocker) => blocker.includes("ledger_checksum")));
    assert.equal(validateStagingPromotionHandoff({ ...handoff, status: "approved" }, { now: "2026-09-30T00:02:30.000Z" }).ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
