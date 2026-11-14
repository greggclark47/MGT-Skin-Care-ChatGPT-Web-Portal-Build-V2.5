import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DEFAULT_ACCOUNTABLE_OWNER } from "./ownership.mjs";
import { buildProductionPrerequisites } from "./production-prerequisites.mjs";
import { buildProductionPrerequisiteReview, PREREQUISITE_RECORD_IDS, productionPrerequisiteReviewChecksum, validateProductionPrerequisiteReview } from "./production-prerequisite-review.mjs";
import { buildProductionEnvironmentReview, PRODUCTION_ENVIRONMENT_RECORD_IDS, productionEnvironmentReviewChecksum, validateProductionEnvironmentReview } from "./production-environment-review.mjs";
import { buildSecretInjectionAdmission, REQUIRED_CONFIG_VARIABLES } from "./secret-injection-admission.mjs";
import { SECRET_INJECTION_CONSUMERS, SECRET_INJECTION_VARIABLES, createSecretInjectionContractTemplate } from "./secret-injection-contract.mjs";
import { recoveryDrillChecksum } from "./recovery-drill-review.mjs";

const BUILD_TIME = "2026-01-01T02:00:00.000Z";
const VALIDATE_TIME = "2026-01-01T03:00:00.000Z";
const ENV = {
  NODE_ENV: "production", DEMO_MODE: "false", PUBLIC_ORIGIN: "https://portal.mgt-skin-care.test",
  HOST: "0.0.0.0", PORT: "8787", WORKER_HEALTH_FILE: "/tmp/mgt-worker-health.json",
  DATABASE_URL: "postgresql://u:p@db.mgt-skin-care.test:5432/postgres?sslmode=verify-full", PORTAL_AUTO_MIGRATE: "false",
  PORTAL_DOMAIN: "portal.mgt-skin-care.test", MGT_EDGE_TOKEN: "intake-test-edge-token-unique-123456789", NODE_IMAGE: "node@sha256:" + "a".repeat(64), API_IMAGE: "ghcr.io/mgt/api@sha256:" + "d".repeat(64),
  WEB_IMAGE: "ghcr.io/mgt/web@sha256:" + "e".repeat(64), OLLAMA_IMAGE: "ollama/ollama@sha256:" + "b".repeat(64), CADDY_IMAGE: "caddy@sha256:" + "c".repeat(64),
  SUPABASE_URL: "https://project.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", SUPABASE_GOOGLE_OAUTH_ENABLED: "false",
  OLLAMA_ENABLED: "true", OLLAMA_BASE_URL: "https://ollama.mgt-skin-care.test", OPENCLAW_ENABLED: "false", OLLAMA_CLOUD_ENABLED: "false", HOSTED_OPENAI_ENABLED: "false",
  WORKER_INTERVAL_SECONDS: "60", WORKER_READINESS_MAX_AGE_SECONDS: "300", BACKUP_MAX_AGE_HOURS: "26", BACKUP_RESTORE_MAX_AGE_DAYS: "90", BACKUP_ATTESTATION_ENABLED: "false", ANTI_AGING_LIVE_AI: "false", ANTI_AGING_CHECKOUT_ENABLED: "false", ANTI_AGING_BOOKING_ENABLED: "false", ANTI_AGING_IMAGE_ANALYSIS_ENABLED: "false", ANTI_AGING_ACCESSIBILITY_VERIFIED: "false", ANTI_AGING_RESTORE_VERIFIED: "false", ANTI_AGING_PRIVACY_REVIEWED: "false", OPERATIONS_ANTI_AGING_RETENTION_DAYS: "365",
  NOTIFICATION_DELIVERY: "in_app", RELEASE_OWNER_NAME: DEFAULT_ACCOUNTABLE_OWNER, SUPPORT_OWNER_NAME: DEFAULT_ACCOUNTABLE_OWNER,
  SUPPORT_OWNER_EMAIL: "support@mgt-skin-care.test", ACCESSIBILITY_VALIDATION_REPORT_URL: "https://evidence.mgt-skin-care.test/accessibility",
  ACCESSIBILITY_VALIDATED_AT: "2026-01-01T00:00:00.000Z", MONITORING_DASHBOARD_URL: "https://monitoring.mgt-skin-care.test/dashboard",
  INCIDENT_RUNBOOK_URL: "https://operations.mgt-skin-care.test/runbook", ALERT_OWNER_EMAIL: "alerts@mgt-skin-care.test", SUPPORT_RESPONSE_TARGET_HOURS: "24",
  OPERATIONS_ALERT_DELIVERY: "webhook", OPERATIONS_ALERT_WEBHOOK_URL: "https://alerts.mgt-skin-care.test/events",
  OPERATIONS_ALERT_WEBHOOK_TOKEN: "configured-alert-token", OPERATIONS_ALERT_KEY_ID: "primary", OPERATIONS_ALERT_TIMEOUT_MS: "10000", OPERATIONS_ALERT_LEASE_SECONDS: "60", OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS: "300", OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS: "3600", OPERATIONS_ALERT_MAX_ATTEMPTS: "5", OPERATIONS_ALERT_EVENT_RETENTION_DAYS: "90", OPERATIONS_FOLLOW_UP_OVERDUE_GRACE_SECONDS: "300", OPERATIONS_FOLLOW_UP_RETRY_DELAY_SECONDS: "300", OPERATIONS_FOLLOW_UP_MAX_ATTEMPTS: "5", OPERATIONS_FOLLOW_UP_RETENTION_DAYS: "365", OPERATIONS_AI_LOG_RETENTION_DAYS: "30", OPERATIONS_NOTIFICATION_RETENTION_DAYS: "90", OPERATIONS_BILLING_RETENTION_DAYS: "730", OPERATIONS_WEBHOOK_RECEIPT_RETENTION_DAYS: "90", OPERATIONS_AGGREGATE_METRIC_RETENTION_DAYS: "180", OPERATIONS_DELETION_PROOF_RETENTION_DAYS: "730", OPERATIONS_RUN_RETENTION_DAYS: "90", OPERATIONS_BACKUP_ATTESTATION_RETENTION_DAYS: "90", NOTIFICATION_RETRY_COOLDOWN_SECONDS: "300", NOTIFICATION_MAX_RETRY_DELAY_SECONDS: "3600", NOTIFICATION_MAX_ATTEMPTS: "3", SUBSCRIPTIONS_ENABLED: "false", MGT_OMNI_RETAIL_ENABLED: "false", MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED: "false", MGT_SPONSORED_CONTENT_ENABLED: "false", MGT_SPONSORED_CONTENT_REVIEWED: "false"
};
Object.assign(ENV, { PUBLIC_PRIVACY_NOTICE_URL: "https://policies.mgt-skin-care.test/privacy", PUBLIC_TERMS_OF_USE_URL: "https://policies.mgt-skin-care.test/terms", PUBLIC_AI_DISCLOSURE_URL: "https://policies.mgt-skin-care.test/ai-disclosure" });
const CANDIDATE_COMMIT = "0123456789abcdef0123456789abcdef01234567";
const PREREQUISITES = buildProductionPrerequisites({ env: ENV, candidateCommit: CANDIDATE_COMMIT });
function secretContract(environment) { const namespace = `secret://approved/mgt/${environment}`; const references = Object.fromEntries(SECRET_INJECTION_CONSUMERS.map((consumer) => [consumer, Object.fromEntries(SECRET_INJECTION_VARIABLES[consumer].map((name) => [name, null]))])); for (const [consumer, names] of Object.entries({ edge: ["MGT_EDGE_TOKEN"], api: ["DATABASE_URL", "MGT_EDGE_TOKEN", "SUPABASE_ANON_KEY"], worker: ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPERATIONS_ALERT_WEBHOOK_TOKEN"] })) for (const name of names) references[consumer][name] = `${namespace}/${name.toLowerCase().replaceAll("_", "-")}`; references.api.MGT_EDGE_TOKEN = references.edge.MGT_EDGE_TOKEN; references.worker.DATABASE_URL = references.api.DATABASE_URL; return createSecretInjectionContractTemplate({ environment, candidateCommit: CANDIDATE_COMMIT, providerReference: "secret-manager://approved/mgt", namespaceReference: namespace, workloadIdentities: { edge: `workload://mgt/${environment}/edge`, api: `workload://mgt/${environment}/api`, worker: `workload://mgt/${environment}/worker` }, secretReferences: references }); }
function secretAdmission() { const config = (consumer) => { if (consumer === "edge") return { PORTAL_DOMAIN: "portal.mgt-skin-care.test" }; const values = Object.fromEntries(REQUIRED_CONFIG_VARIABLES[consumer].map((name) => [name, "configured"])); values.NODE_ENV = "production"; values.DEMO_MODE = "false"; values.PORTAL_AUTO_MIGRATE = "false"; if (consumer === "api") { values.OLLAMA_ENABLED = "false"; values.OPENCLAW_ENABLED = "false"; values.OLLAMA_CLOUD_ENABLED = "false"; values.HOSTED_OPENAI_ENABLED = "false"; values.BACKUP_ATTESTATION_ENABLED = "false"; values.SUBSCRIPTIONS_ENABLED = "false"; values.MGT_OMNI_RETAIL_ENABLED = "false"; values.MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED = "false"; values.MGT_SPONSORED_CONTENT_ENABLED = "false"; values.MGT_SPONSORED_CONTENT_REVIEWED = "false"; } if (consumer === "worker") values.NOTIFICATION_DELIVERY = "in_app"; return values; }; const api = config("api"), worker = config("worker"); return buildSecretInjectionAdmission({ environment: "production", composeProjectName: "mgt-skin-care-production", candidateCommit: CANDIDATE_COMMIT, stagingContract: secretContract("staging"), productionContract: secretContract("production"), inventories: { edge: { config_values: config("edge"), config_keys: ["PORTAL_DOMAIN"], secret_keys: ["MGT_EDGE_TOKEN"] }, api: { config_values: api, config_keys: Object.keys(api), secret_keys: ["DATABASE_URL", "MGT_EDGE_TOKEN", "SUPABASE_ANON_KEY"] }, worker: { config_values: worker, config_keys: Object.keys(worker), secret_keys: ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPERATIONS_ALERT_WEBHOOK_TOKEN"] } }, privateFilesDistinct: true, fileSecurity: "verified", generatedAt: "2026-01-01T01:00:00.000Z" }); }
const SECRET_ADMISSION = secretAdmission();
function policyApprovalArtifact() { return { version: "1.0", candidate_commit: CANDIDATE_COMMIT, status: "approved", approved_at: "2026-01-01T00:30:00.000Z", approval_reference: "governance://mgt/policy-publication/2026-01-01", policy_urls: { privacy_notice: "https://policies.mgt-skin-care.test/privacy", terms_of_use: "https://policies.mgt-skin-care.test/terms", ai_disclosure: "https://policies.mgt-skin-care.test/ai-disclosure" } }; }

const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-production-intake-owner-"));
for (const [folder, ids] of [["prerequisites", PREREQUISITE_RECORD_IDS], ["environment", PRODUCTION_ENVIRONMENT_RECORD_IDS]]) {
  fs.mkdirSync(path.join(root, "work", folder), { recursive: true });
  for (const id of ids) {
    const secretManager = folder === "prerequisites" && id === "secret_manager";
    const policyApproval = folder === "prerequisites" && id === "policy_publication_approval";
    fs.writeFileSync(path.join(root, "work", folder, `${id}${secretManager || policyApproval ? ".json" : ".md"}`), secretManager ? `${JSON.stringify(SECRET_ADMISSION, null, 2)}\n` : policyApproval ? `${JSON.stringify(policyApprovalArtifact(), null, 2)}\n` : `${id} reviewed evidence\n`);
  }
}
{
  fs.mkdirSync(path.join(root, "work", "recovery"), { recursive: true });
  const evidence = ["restore_transcript", "rollback_plan", "failed_restore_procedure"].map((id) => { const reference = `work/recovery/${id}.md`; const content = `${id} evidence\n`; fs.writeFileSync(path.join(root, reference), content); return { id, reference, checksum: `sha256:${createHash("sha256").update(content).digest("hex")}`, bytes: Buffer.byteLength(content), owner: DEFAULT_ACCOUNTABLE_OWNER, reviewed_at: "2026-01-01T01:00:00.000Z", status: "pass" }; });
  const recovery = { version: "1.0", candidate_commit: CANDIDATE_COMMIT, generated_at: "2026-01-01T01:05:00.000Z", status: "ready_for_recovery_review", target_seconds: { rto: 120, rpo: 300 }, measured_seconds: { rto: 90, rpo: 60 }, restored_migration_version: "0010_ingredient_rule_seed_alignment", evidence, decision: { decider: DEFAULT_ACCOUNTABLE_OWNER, decision: "accepted", decided_at: "2026-01-01T01:04:00.000Z" }, errors: [] };
  recovery.recovery_drill_checksum = recoveryDrillChecksum(recovery);
  fs.writeFileSync(path.join(root, "work", "prerequisites", "backup_restore.json"), `${JSON.stringify(recovery, null, 2)}\n`);
}

function records(folder, ids) {
  return Object.fromEntries(ids.map((id) => {
    const secretManager = folder === "prerequisites" && id === "secret_manager";
    const policyApproval = folder === "prerequisites" && id === "policy_publication_approval";
    const backupRestore = folder === "prerequisites" && id === "backup_restore";
    const environmentPolicyApproval = folder === "environment" && id === "policy_publication_approval";
    return [id, { reference: environmentPolicyApproval ? "work/prerequisites/policy_publication_approval.json" : `work/${folder}/${id}${secretManager || backupRestore || policyApproval ? ".json" : ".md"}`, owner: DEFAULT_ACCOUNTABLE_OWNER, reviewed_at: "2026-01-01T01:00:00.000Z", status: "pass", ...(secretManager ? { contract_checksums: SECRET_ADMISSION.contract_checksums } : {}) }];
  }));
}
function prerequisiteRecords() { return records("prerequisites", PREREQUISITE_RECORD_IDS); }
function environmentRecords() { return records("environment", PRODUCTION_ENVIRONMENT_RECORD_IDS); }
function prerequisites() { return structuredClone(PREREQUISITES); }
function readyPrerequisiteReview() { return buildProductionPrerequisiteReview({ root, prerequisites: prerequisites(), records: prerequisiteRecords(), now: BUILD_TIME }); }

const ownerMutations = [
  ["missing", undefined], ["null", null], ["blank", ""], ["short name", "Gregg Clark"], ["trailing space", "Gregg Clark of MGT "],
  ["leading space", " Gregg Clark of MGT"], ["lowercase", "gregg clark of mgt"], ["uppercase", "GREGG CLARK OF MGT"], ["array", [DEFAULT_ACCOUNTABLE_OWNER]], ["object", { name: DEFAULT_ACCOUNTABLE_OWNER }],
  ["zero", 0], ["false", false], ["boxed string", new String(DEFAULT_ACCOUNTABLE_OWNER)], ["newline only", "\n"], ["company only", "MGT"],
  ["trailing newline", "Gregg Clark of MGT\n"], ["double name space", "Gregg  Clark of MGT"], ["double company space", "Gregg Clark of  MGT"], ["punctuation", "Gregg Clark of MGT."], ["null suffix", "Gregg Clark of MGT\u0000"]
];
const surfaces = [
  ["prerequisite env shape", "prerequisite", "env_shape"],
  ["prerequisite GitHub receipt", "prerequisite", "github_receipt"],
  ["prerequisite Drive receipt", "prerequisite", "drive_receipt"],
  ["environment node mode", "environment", "node_env"],
  ["environment provider scope", "environment", "provider_scope"]
];
assert.equal(ownerMutations.length * surfaces.length, 100);

for (const [surface, kind, id] of surfaces) for (const [label, value] of ownerMutations) {
  test(`production intake rejects ${label} owner at ${surface}`, () => {
    if (kind === "prerequisite") {
      const source = prerequisiteRecords();
      source[id].owner = value;
      const built = buildProductionPrerequisiteReview({ root, prerequisites: prerequisites(), records: source, now: BUILD_TIME });
      assert.equal(built.status, "pending_external_prerequisites");
      assert.match(built.errors.join("; "), new RegExp(`${id}\\.owner must equal Gregg Clark of MGT`));
      const forged = readyPrerequisiteReview();
      forged.entries.find((entry) => entry.id === id).owner = value;
      forged.prerequisite_review_checksum = productionPrerequisiteReviewChecksum(forged);
      assert.equal(validateProductionPrerequisiteReview(forged, { prerequisites: prerequisites(), now: VALIDATE_TIME }).ok, false);
    } else {
      const upstream = readyPrerequisiteReview();
      const source = environmentRecords();
      source[id].owner = value;
      const built = buildProductionEnvironmentReview({ root, prerequisiteReview: upstream, records: source, now: BUILD_TIME });
      assert.equal(built.status, "pending_environment_records");
      assert.match(built.errors.join("; "), new RegExp(`${id}\\.owner must equal Gregg Clark of MGT`));
      const forged = buildProductionEnvironmentReview({ root, prerequisiteReview: upstream, records: environmentRecords(), now: BUILD_TIME });
      forged.entries.find((entry) => entry.id === id).owner = value;
      forged.production_environment_review_checksum = productionEnvironmentReviewChecksum(forged);
      assert.equal(validateProductionEnvironmentReview(forged, { prerequisiteReview: upstream, now: VALIDATE_TIME }).ok, false);
    }
  });
}

test("initial production intake keeps all thirty-eight records distinct and canonically owned", () => {
  const upstream = readyPrerequisiteReview();
  const environment = buildProductionEnvironmentReview({ root, prerequisiteReview: upstream, records: environmentRecords(), now: BUILD_TIME });
  assert.equal(upstream.entries.length, 13);
  assert.equal(environment.entries.length, 25);
  assert.equal([...upstream.entries, ...environment.entries].every((entry) => entry.owner === DEFAULT_ACCOUNTABLE_OWNER), true);
  assert.notEqual(upstream.entries.find((entry) => entry.id === "github_receipt").reference, upstream.entries.find((entry) => entry.id === "drive_receipt").reference);
  const prerequisiteValidation = validateProductionPrerequisiteReview(upstream, { prerequisites: prerequisites(), now: VALIDATE_TIME });
  const environmentValidation = validateProductionEnvironmentReview(environment, { prerequisiteReview: upstream, now: VALIDATE_TIME });
  assert.equal(prerequisiteValidation.ok, true, JSON.stringify(prerequisiteValidation.errors));
  assert.equal(environmentValidation.ok, true, JSON.stringify(environmentValidation.errors));
});
