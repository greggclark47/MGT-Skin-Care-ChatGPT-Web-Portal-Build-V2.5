import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildProductionPrerequisites } from "./production-prerequisites.mjs";

const BASE = { NODE_ENV: "production", DEMO_MODE: "false", PUBLIC_ORIGIN: "https://portal.mgt-skin-care.test", DATABASE_URL: "postgresql://u:p@db.mgt-skin-care.test:5432/postgres?sslmode=verify-full", PORTAL_AUTO_MIGRATE: "false", PORTAL_DOMAIN: "portal.mgt-skin-care.test", NODE_IMAGE: "node@sha256:" + "a".repeat(64), API_IMAGE: "ghcr.io/mgt/api@sha256:" + "d".repeat(64), WEB_IMAGE: "ghcr.io/mgt/web@sha256:" + "e".repeat(64), OLLAMA_IMAGE: "ollama/ollama@sha256:" + "b".repeat(64), CADDY_IMAGE: "caddy@sha256:" + "c".repeat(64), SUPABASE_URL: "https://project.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", SUPABASE_GOOGLE_OAUTH_ENABLED: "false", OLLAMA_ENABLED: "true", OLLAMA_BASE_URL: "https://ollama.mgt-skin-care.test", OPENCLAW_ENABLED: "false", WORKER_INTERVAL_SECONDS: "60", WORKER_READINESS_MAX_AGE_SECONDS: "300", BACKUP_MAX_AGE_HOURS: "26", BACKUP_RESTORE_MAX_AGE_DAYS: "90", BACKUP_ATTESTATION_ENABLED: "false", ANTI_AGING_LIVE_AI: "false", ANTI_AGING_CHECKOUT_ENABLED: "false", ANTI_AGING_BOOKING_ENABLED: "false", ANTI_AGING_IMAGE_ANALYSIS_ENABLED: "false", ANTI_AGING_ACCESSIBILITY_VERIFIED: "false", ANTI_AGING_RESTORE_VERIFIED: "false", ANTI_AGING_PRIVACY_REVIEWED: "false", OPERATIONS_ANTI_AGING_RETENTION_DAYS: "365", NOTIFICATION_DELIVERY: "in_app", NOTIFICATION_RETRY_COOLDOWN_SECONDS: "300", NOTIFICATION_MAX_RETRY_DELAY_SECONDS: "3600", NOTIFICATION_MAX_ATTEMPTS: "3", OPERATIONS_ALERT_DELIVERY: "webhook", OPERATIONS_ALERT_WEBHOOK_URL: "https://alerts.mgt-skin-care.test/events", OPERATIONS_ALERT_WEBHOOK_TOKEN: "configured-alert-token", OPERATIONS_ALERT_KEY_ID: "primary", OPERATIONS_ALERT_TIMEOUT_MS: "10000", OPERATIONS_ALERT_LEASE_SECONDS: "60", OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS: "300", OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS: "3600", OPERATIONS_ALERT_MAX_ATTEMPTS: "5", OPERATIONS_ALERT_EVENT_RETENTION_DAYS: "90", OPERATIONS_FOLLOW_UP_OVERDUE_GRACE_SECONDS: "300", OPERATIONS_FOLLOW_UP_RETRY_DELAY_SECONDS: "300", OPERATIONS_FOLLOW_UP_MAX_ATTEMPTS: "5", OPERATIONS_FOLLOW_UP_RETENTION_DAYS: "365", OPERATIONS_AI_LOG_RETENTION_DAYS: "30", OPERATIONS_NOTIFICATION_RETENTION_DAYS: "90", OPERATIONS_BILLING_RETENTION_DAYS: "730", OPERATIONS_WEBHOOK_RECEIPT_RETENTION_DAYS: "90", OPERATIONS_AGGREGATE_METRIC_RETENTION_DAYS: "180", OPERATIONS_DELETION_PROOF_RETENTION_DAYS: "730", OPERATIONS_RUN_RETENTION_DAYS: "90", OPERATIONS_BACKUP_ATTESTATION_RETENTION_DAYS: "90", RELEASE_OWNER_NAME: "Gregg Clark of MGT", SUPPORT_OWNER_NAME: "Gregg Clark of MGT", SUPPORT_OWNER_EMAIL: "support@mgt-skin-care.test", ACCESSIBILITY_VALIDATION_REPORT_URL: "https://evidence.mgt-skin-care.test/accessibility", ACCESSIBILITY_VALIDATED_AT: "2026-01-01T00:00:00.000Z", MONITORING_DASHBOARD_URL: "https://monitoring.mgt-skin-care.test/dashboard", INCIDENT_RUNBOOK_URL: "https://operations.mgt-skin-care.test/runbook", ALERT_OWNER_EMAIL: "alerts@mgt-skin-care.test", SUPPORT_RESPONSE_TARGET_HOURS: "24", SUBSCRIPTIONS_ENABLED: "false" };

Object.assign(BASE, { HOST: "0.0.0.0", PORT: "8787", WORKER_HEALTH_FILE: "/tmp/mgt-worker-health.json", OPERATIONS_ALERT_KEY_ID: "primary" });

test("reports configuration blockers without serializing values", () => { const result = buildProductionPrerequisites({ env: {}, candidateCommit: "abc" }); assert.equal(result.status, "blocked_on_configuration"); assert.equal(JSON.stringify(result).includes("DATABASE_URL"), true); assert.equal(JSON.stringify(result).includes("postgresql://"), false); });
test("keeps a valid lean profile blocked on external evidence", () => { const result = buildProductionPrerequisites({ env: BASE, candidateCommit: "0123456789abcdef0123456789abcdef01234567" }); assert.equal(result.local.configuration.status, "ready_for_live_validation"); assert.equal(result.status, "blocked_on_external_prerequisites"); assert.equal(result.external.length, 10); assert.ok(result.external.every((item) => item.status === "pending_external_evidence")); });
test("does not expose secret-like input", () => { const result = buildProductionPrerequisites({ env: { ...BASE, SUPABASE_SERVICE_ROLE_KEY: "super-secret-value" }, candidateCommit: "0123456789abcdef0123456789abcdef01234567" }); assert.equal(JSON.stringify(result).includes("super-secret-value"), false); });
test("binds the exact candidate when supplied", () => { const commit = "0123456789abcdef0123456789abcdef01234567"; assert.equal(buildProductionPrerequisites({ env: BASE, candidateCommit: commit }).candidate_commit, commit); });
test("binds passing checkpoint and verification reports to the candidate without copying report content", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-local-evidence-"));
  try {
    fs.mkdirSync(path.join(root, "work", "checkpoints"), { recursive: true });
    fs.mkdirSync(path.join(root, "work", "verification"), { recursive: true });
    const commit = "0123456789abcdef0123456789abcdef01234567";
    fs.writeFileSync(path.join(root, "work", "checkpoints", "report.md"), `- Commit: \`${commit}\`\n- Local gates: **PASS**\nSECRET=must-not-be-copied\n`);
    fs.writeFileSync(path.join(root, "work", "verification", "report.md"), "# Verification evidence — v1.6\n| Component | Status |\n| API | PASSED |\n");
    const result = buildProductionPrerequisites({ root, env: BASE, candidateCommit: commit, checkpointFile: "work/checkpoints/report.md", verificationFile: "work/verification/report.md" });
    assert.equal(result.status, "blocked_on_external_prerequisites");
    assert.equal(result.local.backend_build, "verified_by_checkpoint");
    assert.equal(result.local.portal_tests, "verified_by_verification");
    assert.equal(result.local.evidence.status, "verified");
    assert.equal(JSON.stringify(result).includes("must-not-be-copied"), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test("blocks local evidence that is missing, mismatched, or failed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-local-evidence-invalid-"));
  try {
    fs.mkdirSync(path.join(root, "work"), { recursive: true });
    fs.writeFileSync(path.join(root, "work", "checkpoint.md"), "- Commit: `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`\n- Local gates: **FAIL**\n");
    fs.writeFileSync(path.join(root, "work", "verification.md"), "# Verification evidence\n| Component | FAILED |\n");
    const result = buildProductionPrerequisites({ root, env: BASE, candidateCommit: "0123456789abcdef0123456789abcdef01234567", checkpointFile: "work/checkpoint.md", verificationFile: "work/verification.md" });
    assert.equal(result.status, "blocked_on_configuration");
    assert.equal(result.local.evidence.status, "blocked");
    assert.equal(result.local.evidence.errors.length, 3);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
