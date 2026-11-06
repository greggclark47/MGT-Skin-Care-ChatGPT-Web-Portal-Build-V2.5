import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildStagingArtifacts, validateStagingArtifacts, verifyStagingArtifacts } from "./staging-artifacts.mjs";
import { STAGING_EVIDENCE_GATES } from "./staging-evidence.mjs";
import { reviewStagingEvidence, validateStagingEvidenceReview } from "./staging-evidence-review.mjs";
import { buildStagingPromotionHandoff, validateStagingPromotionHandoff } from "./staging-promotion-handoff.mjs";
import { buildSecretInjectionAdmission, REQUIRED_CONFIG_VARIABLES } from "./secret-injection-admission.mjs";
import { SECRET_INJECTION_CONSUMERS, SECRET_INJECTION_VARIABLES, createSecretInjectionContractTemplate } from "./secret-injection-contract.mjs";

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

function secretContract(environment) {
  const namespace = `secret://approved/mgt/${environment}`;
  const secretReferences = Object.fromEntries(SECRET_INJECTION_CONSUMERS.map((consumer) => [consumer, Object.fromEntries(SECRET_INJECTION_VARIABLES[consumer].map((name) => [name, null]))]));
  for (const [consumer, names] of Object.entries({ edge: ["MGT_EDGE_TOKEN"], api: ["DATABASE_URL", "MGT_EDGE_TOKEN", "SUPABASE_ANON_KEY"], worker: ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPERATIONS_ALERT_WEBHOOK_TOKEN"] })) for (const name of names) secretReferences[consumer][name] = `${namespace}/${name.toLowerCase().replaceAll("_", "-")}`;
  secretReferences.api.MGT_EDGE_TOKEN = secretReferences.edge.MGT_EDGE_TOKEN;
  secretReferences.worker.DATABASE_URL = secretReferences.api.DATABASE_URL;
  return createSecretInjectionContractTemplate({
    environment,
    candidateCommit,
    providerReference: "secret-manager://approved/mgt",
    namespaceReference: namespace,
    workloadIdentities: { edge: `workload://mgt/${environment}/edge`, api: `workload://mgt/${environment}/api`, worker: `workload://mgt/${environment}/worker` },
    secretReferences
  });
}

function secretAdmissionFixture() {
  const config = (consumer) => {
    if (consumer === "edge") return { PORTAL_DOMAIN: "staging.mgtskincare.test" };
    const values = Object.fromEntries(REQUIRED_CONFIG_VARIABLES[consumer].map((name) => [name, "configured"]));
    values.NODE_ENV = "production"; values.DEMO_MODE = "false"; values.PORTAL_AUTO_MIGRATE = "false";
    if (consumer === "api") { values.OLLAMA_ENABLED = "false"; values.OPENCLAW_ENABLED = "false"; values.HOSTED_OPENAI_ENABLED = "false"; values.BACKUP_ATTESTATION_ENABLED = "false"; values.SUBSCRIPTIONS_ENABLED = "false"; values.MGT_OMNI_RETAIL_ENABLED = "false"; values.MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED = "false"; values.MGT_SPONSORED_CONTENT_ENABLED = "false"; values.MGT_SPONSORED_CONTENT_REVIEWED = "false"; }
    if (consumer === "worker") values.NOTIFICATION_DELIVERY = "in_app";
    return values;
  };
  const api = config("api"), worker = config("worker");
  return buildSecretInjectionAdmission({
    environment: "staging", composeProjectName: "mgt-skin-care-staging", candidateCommit,
    stagingContract: secretContract("staging"), productionContract: secretContract("production"),
    inventories: {
      edge: { config_values: config("edge"), config_keys: ["PORTAL_DOMAIN"], secret_keys: ["MGT_EDGE_TOKEN"] },
      api: { config_values: api, config_keys: Object.keys(api), secret_keys: ["DATABASE_URL", "MGT_EDGE_TOKEN", "SUPABASE_ANON_KEY"] },
      worker: { config_values: worker, config_keys: Object.keys(worker), secret_keys: ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPERATIONS_ALERT_WEBHOOK_TOKEN"] }
    },
    privateFilesDistinct: true, fileSecurity: "verified", generatedAt: "2026-09-30T00:00:00.000Z"
  });
}

function stagingFixture(root) {
  const references = {
    deployment: "work/staging/2026-09-30/deployment.md",
    isolation: "work/staging/2026-09-30/isolation.md",
    secretInjection: "work/staging/2026-09-30/secret-injection-admission.json",
    preflight: "work/staging/2026-09-30/preflight.md",
    probe: "work/staging/2026-09-30/probe.json",
    rollback: "work/rollback/2026-09-30/staging.md"
  };
  for (const [id, reference] of Object.entries(references)) writeArtifact(root, reference, id === "probe" ? '{"status":"ok"}\n' : id === "secretInjection" ? `${JSON.stringify(secretAdmissionFixture(), null, 2)}\n` : `${id} evidence\n`);
  const target = {
    version: "1.1",
    environment: "staging",
    candidate_commit: candidateCommit,
    origin: "https://staging.mgtskincare.test",
    deployment_reference: references.deployment,
    isolation_reference: references.isolation,
    secret_injection_reference: references.secretInjection,
    secret_injection_contract_checksums: secretAdmissionFixture().contract_checksums,
    images
  };
  const records = STAGING_EVIDENCE_GATES.map((gate) => ({
    id: gate.id,
    phase: gate.phase,
    gate: gate.gate,
    requirement: gate.requirement,
    owner: gate.owner_role === "release" ? "Gregg Clark of MGT" : "Gregg Clark of MGT",
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

test("binds staging secret-injection evidence to the contract pair declared by the staged target", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-staging-artifacts-"));
  try {
    const { ledger } = stagingFixture(root);
    ledger.target.secret_injection_contract_checksums.production = `sha256:${"9".repeat(64)}`;
    assert.throws(() => buildStagingArtifacts({ root, target: ledger.target, attestation: ledger.attestation, records: ledger.records }), /candidate-bound admission report/);
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
