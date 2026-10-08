import assert from "node:assert/strict";
import test from "node:test";
import { buildReleaseReadiness, liveEvidenceFromEnvironment } from "./release-readiness.mjs";
import { validateShipPacket } from "./ship-packet.mjs";
import { STAGING_EVIDENCE_GATES } from "./staging-evidence.mjs";

const env = {
  NODE_ENV: "production",
  DEMO_MODE: "false",
  PUBLIC_ORIGIN: "https://portal.mgtskincare.test",
  DATABASE_URL: "postgresql://mgt:secure@db.internal:5432/mgt?sslmode=verify-full",
  PORTAL_AUTO_MIGRATE: "false",
  PORTAL_DOMAIN: "portal.mgtskincare.test",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-production-value",
  SUPABASE_SERVICE_ROLE_KEY: "service-production-value",
  OLLAMA_ENABLED: "true",
  OLLAMA_BASE_URL: "http://ollama:11434",
  OPENCLAW_ENABLED: "false",
  WORKER_INTERVAL_SECONDS: "60",
  WORKER_READINESS_MAX_AGE_SECONDS: "300",
  BACKUP_MAX_AGE_HOURS: "26",
  BACKUP_RESTORE_MAX_AGE_DAYS: "90",
  NOTIFICATION_DELIVERY: "in_app",
  SUPPORT_OWNER_NAME: "MGT Support Lead",
  SUPPORT_OWNER_EMAIL: "support-lead@mgtskincare.test",
  ACCESSIBILITY_VALIDATION_REPORT_URL: "https://evidence.mgtskincare.test/a11y/report",
  ACCESSIBILITY_VALIDATED_AT: "2026-09-01T00:00:00.000Z",
  SUBSCRIPTIONS_ENABLED: "false",
  SUBSCRIPTION_TERMS_APPROVED: "false",
  NODE_IMAGE: `node@sha256:${"c".repeat(64)}`,
  API_IMAGE: `ghcr.io/mgt/api@sha256:${"d".repeat(64)}`,
  WEB_IMAGE: `ghcr.io/mgt/web@sha256:${"e".repeat(64)}`,
  OLLAMA_IMAGE: `ollama/ollama@sha256:${"a".repeat(64)}`,
  CADDY_IMAGE: `caddy@sha256:${"b".repeat(64)}`,
  RELEASE_LOCAL_GATES: "true",
  RELEASE_EVIDENCE_SUPPORT_WORKFLOW: "true",
  RELEASE_EVIDENCE_ACCESSIBILITY_DEPLOYED: "true",
  RELEASE_EVIDENCE_DATABASE_RLS: "true",
  RELEASE_EVIDENCE_BACKUP_RESTORE: "true",
  RELEASE_EVIDENCE_CONTAINER_STARTUP: "true",
  RELEASE_EVIDENCE_AI_PROVIDER: "true"
};

const readiness = buildReleaseReadiness({ env, localGates: true, liveEvidence: liveEvidenceFromEnvironment(env) });
const evidence = [
  ["support_workflow", "F73"],
  ["accessibility_deployed", "F74"],
  ["database_rls", "F75"],
  ["backup_restore", "F76"],
  ["container_startup", "F78"],
  ["ai_provider", "F79"]
].map(([id, phase]) => ({ id, phase, status: "pass", reference: `work/evidence/${id}.md`, reviewed_at: "2026-09-20T00:00:00.000Z", reviewer: "MGT Release Owner" }));

const owners = { release: "MGT Release Owner", support: "MGT Support Owner", data: "MGT Data Owner", platform: "MGT Platform Owner", accessibility: "MGT Accessibility Owner" };
const images = { node: `node@sha256:${"c".repeat(64)}`, api: `ghcr.io/mgt/api@sha256:${"d".repeat(64)}`, web: `ghcr.io/mgt/web@sha256:${"e".repeat(64)}`, ollama: `ollama/ollama@sha256:${"a".repeat(64)}`, caddy: `caddy@sha256:${"b".repeat(64)}` };
const stagingEvidence = {
  version: "1.2",
  environment: "staging",
  target: {
    version: "1.0",
    environment: "staging",
    candidate_commit: "a".repeat(40),
    origin: "https://staging.mgtskincare.test",
    deployment_reference: "work/staging/2026-09-20/deployment.md",
    isolation_reference: "work/staging/2026-09-20/isolation.md",
    secret_injection_reference: "work/staging/2026-09-20/secret-injection.md",
    images
  },
  health_probe: {
    version: "1.0",
    origin: "https://staging.mgtskincare.test",
    captured_at: "2026-09-20T00:00:00.000Z",
    status: "pass",
    checks: ["/healthz", "/readyz"].map((pathname) => ({ pathname, expected_status: 200, actual_status: 200, service_status: "ok", duration_ms: 12, status: "pass" }))
  },
  attestation: {
    version: "1.0",
    candidate_commit: "a".repeat(40),
    target_origin: "https://staging.mgtskincare.test",
    images,
    generated_at: "2026-09-20T00:00:00.000Z",
    status: "pass",
    preflight: { status: "pass", reference: "work/staging/2026-09-20/preflight.md", checksum: `sha256:${"e".repeat(64)}` },
    probe: { status: "pass", reference: "work/staging/2026-09-20/probe.json", checksum: `sha256:${"f".repeat(64)}` }
  },
  artifacts: {
    version: "1.0",
    candidate_commit: "a".repeat(40),
    generated_at: "2026-09-20T00:00:00.000Z",
    status: "pass",
    entries: [
      ["deployment", "work/staging/2026-09-20/deployment.md", `sha256:${"1".repeat(64)}`],
      ["isolation", "work/staging/2026-09-20/isolation.md", `sha256:${"2".repeat(64)}`],
      ["secret_injection", "work/staging/2026-09-20/secret-injection.md", `sha256:${"3".repeat(64)}`],
      ["preflight", "work/staging/2026-09-20/preflight.md", `sha256:${"e".repeat(64)}`],
      ["probe", "work/staging/2026-09-20/probe.json", `sha256:${"f".repeat(64)}`],
      ["rollback", "work/rollback/2026-09-20/staging.md", `sha256:${"4".repeat(64)}`]
    ].map(([id, reference, checksum]) => ({ id, reference, checksum, bytes: 12 }))
  },
  records: STAGING_EVIDENCE_GATES.map((gate) => ({
    id: gate.id,
    phase: gate.phase,
    gate: gate.gate,
    requirement: gate.requirement,
    owner: owners[gate.owner_role],
    captured_at: "2026-09-20T00:00:00.000Z",
    environment: "staging",
    action: "Recorded approved staging command",
    expected_result: "Required gate passes",
    actual_result: "Required gate passed",
    status: "pass",
    reference: `work/staging/2026-09-20/${gate.id}.md`,
    checksum: `sha256:${"d".repeat(64)}`,
    blocker_state: "resolved",
    rollback_reference: "work/rollback/2026-09-20/staging.md"
  }))
};

const validPacket = {
  version: "1.2",
  generated_at: "2026-09-20T00:00:00.000Z",
  expires_at: "2030-01-02T12:00:00.000Z",
  candidate: {
    commit: "a".repeat(40),
    branch: "main",
    checkpoint_report: "work/checkpoints/2026-09-20/report.md",
    verification_report: "work/verification/2026-09-20/report.md",
    hosted_ci_url: "https://github.com/example/mgt/actions/runs/123"
  },
  owners,
  approvals: ["release", "support", "data", "platform", "accessibility"].map((role) => ({ role, decision: "go", approver: `MGT ${role} owner`, reviewed_at: "2026-09-20T00:00:00.000Z", reference: `work/approvals/${role}.md` })),
  images,
  staging_evidence: stagingEvidence,
  evidence,
  rollback: { previous_release: "mgt-v2-previous", reference: "work/rollback/2026-09-20/report.md", verified_at: "2026-09-20T00:00:00.000Z" },
  monitoring: { owner: "MGT Launch Monitor", incident_channel: "MGT launch incident channel", launch_window_start: "2030-01-01T12:00:00.000Z", checks: ["15m", "1h", "24h", "7d"] }
};

test("accepts a complete ship packet only when readiness is also complete", () => {
  const result = validateShipPacket(validPacket, { readiness });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("requires candidate, ownership, evidence and rollback references", () => {
  const result = validateShipPacket({ ...validPacket, candidate: { ...validPacket.candidate, commit: "bad" }, owners: {}, approvals: [], evidence: [], rollback: {} }, { readiness });
  assert.equal(result.ok, false);
  assert(result.errors.some((error) => error.startsWith("candidate.commit")));
  assert(result.errors.some((error) => error.startsWith("owners.release")));
  assert(result.errors.some((error) => error.startsWith("approvals must contain exactly one release")));
  assert(result.errors.some((error) => error.includes("support_workflow")));
  assert(result.errors.some((error) => error.startsWith("rollback.previous_release")));
});

test("rejects mutable images, placeholder references and an unready release", () => {
  const blocked = { ...readiness, release_ready: false };
  const result = validateShipPacket({ ...validPacket, images: { ...validPacket.images, node: "node:latest" }, candidate: { ...validPacket.candidate, checkpoint_report: "https://example.com/report" } }, { readiness: blocked });
  assert.equal(result.ok, false);
  assert(result.errors.some((error) => error.startsWith("images.node")));
  assert(result.errors.some((error) => error.startsWith("candidate.checkpoint_report")));
  assert(result.errors.some((error) => error.includes("readiness packet")));
});

test("requires fresh packet metadata, phase-bound evidence and rollback verification", () => {
  const result = validateShipPacket({
    ...validPacket,
    generated_at: "2999-01-01T00:00:00.000Z",
    expires_at: "2020-01-01T00:00:00.000Z",
    evidence: validPacket.evidence.map((item) => item.id === "support_workflow" ? { ...item, phase: "F74" } : item),
    rollback: { ...validPacket.rollback, verified_at: "2999-01-01T00:00:00.000Z" }
  }, { readiness });
  assert.equal(result.ok, false);
  assert(result.errors.some((error) => error.startsWith("generated_at")));
  assert(result.errors.some((error) => error.startsWith("expires_at")));
  assert(result.errors.some((error) => error.includes("support_workflow evidence must declare phase F73")));
  assert(result.errors.some((error) => error.startsWith("rollback.verified_at")));
});

test("requires complete staging evidence for the exact candidate", () => {
  const packet = structuredClone(validPacket);
  packet.staging_evidence.records[0].checksum = "sha256:bad";
  packet.staging_evidence.target.candidate_commit = "b".repeat(40);
  const result = validateShipPacket(packet, { readiness });
  assert.equal(result.ok, false);
  assert(result.errors.some((error) => error.includes("staging_evidence.target.candidate_commit")));
  assert(result.errors.some((error) => error.includes("staging_evidence.staging_provisioning.checksum")));
});
