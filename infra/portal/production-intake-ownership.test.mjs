import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DEFAULT_ACCOUNTABLE_OWNER } from "./ownership.mjs";
import { buildProductionPrerequisites } from "./production-prerequisites.mjs";
import { buildProductionPrerequisiteReview, PREREQUISITE_RECORD_IDS, productionPrerequisiteReviewChecksum, validateProductionPrerequisiteReview } from "./production-prerequisite-review.mjs";
import { buildProductionEnvironmentReview, PRODUCTION_ENVIRONMENT_RECORD_IDS, productionEnvironmentReviewChecksum, validateProductionEnvironmentReview } from "./production-environment-review.mjs";

const BUILD_TIME = "2026-01-01T02:00:00.000Z";
const VALIDATE_TIME = "2026-01-01T03:00:00.000Z";
const ENV = {
  NODE_ENV: "production", DEMO_MODE: "false", PUBLIC_ORIGIN: "https://portal.mgt-skin-care.test",
  HOST: "0.0.0.0", PORT: "8787", WORKER_HEALTH_FILE: "/tmp/mgt-worker-health.json",
  DATABASE_URL: "postgresql://u:p@db.mgt-skin-care.test:5432/postgres?sslmode=verify-full", PORTAL_AUTO_MIGRATE: "false",
  PORTAL_DOMAIN: "portal.mgt-skin-care.test", NODE_IMAGE: "node@sha256:" + "a".repeat(64), API_IMAGE: "ghcr.io/mgt/api@sha256:" + "d".repeat(64),
  WEB_IMAGE: "ghcr.io/mgt/web@sha256:" + "e".repeat(64), OLLAMA_IMAGE: "ollama/ollama@sha256:" + "b".repeat(64), CADDY_IMAGE: "caddy@sha256:" + "c".repeat(64),
  SUPABASE_URL: "https://project.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service",
  OLLAMA_ENABLED: "true", OLLAMA_BASE_URL: "https://ollama.mgt-skin-care.test", OPENCLAW_ENABLED: "false",
  WORKER_INTERVAL_SECONDS: "60", WORKER_READINESS_MAX_AGE_SECONDS: "300", BACKUP_MAX_AGE_HOURS: "26", BACKUP_RESTORE_MAX_AGE_DAYS: "90",
  NOTIFICATION_DELIVERY: "in_app", RELEASE_OWNER_NAME: DEFAULT_ACCOUNTABLE_OWNER, SUPPORT_OWNER_NAME: DEFAULT_ACCOUNTABLE_OWNER,
  SUPPORT_OWNER_EMAIL: "support@mgt-skin-care.test", ACCESSIBILITY_VALIDATION_REPORT_URL: "https://evidence.mgt-skin-care.test/accessibility",
  ACCESSIBILITY_VALIDATED_AT: "2026-01-01T00:00:00.000Z", MONITORING_DASHBOARD_URL: "https://monitoring.mgt-skin-care.test/dashboard",
  INCIDENT_RUNBOOK_URL: "https://operations.mgt-skin-care.test/runbook", ALERT_OWNER_EMAIL: "alerts@mgt-skin-care.test", SUPPORT_RESPONSE_TARGET_HOURS: "24",
  OPERATIONS_ALERT_DELIVERY: "webhook", OPERATIONS_ALERT_WEBHOOK_URL: "https://alerts.mgt-skin-care.test/events",
  OPERATIONS_ALERT_WEBHOOK_TOKEN: "configured-alert-token", SUBSCRIPTIONS_ENABLED: "false"
};
const PREREQUISITES = buildProductionPrerequisites({ env: ENV, candidateCommit: "0123456789abcdef0123456789abcdef01234567" });

const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-production-intake-owner-"));
for (const [folder, ids] of [["prerequisites", PREREQUISITE_RECORD_IDS], ["environment", PRODUCTION_ENVIRONMENT_RECORD_IDS]]) {
  fs.mkdirSync(path.join(root, "work", folder), { recursive: true });
  for (const id of ids) fs.writeFileSync(path.join(root, "work", folder, `${id}.md`), `${id} reviewed evidence\n`);
}

function records(folder, ids) {
  return Object.fromEntries(ids.map((id) => [id, { reference: `work/${folder}/${id}.md`, owner: DEFAULT_ACCOUNTABLE_OWNER, reviewed_at: "2026-01-01T01:00:00.000Z", status: "pass" }]));
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

test("initial production intake keeps all thirty-seven records distinct and canonically owned", () => {
  const upstream = readyPrerequisiteReview();
  const environment = buildProductionEnvironmentReview({ root, prerequisiteReview: upstream, records: environmentRecords(), now: BUILD_TIME });
  assert.equal(upstream.entries.length, 12);
  assert.equal(environment.entries.length, 25);
  assert.equal([...upstream.entries, ...environment.entries].every((entry) => entry.owner === DEFAULT_ACCOUNTABLE_OWNER), true);
  assert.notEqual(upstream.entries.find((entry) => entry.id === "github_receipt").reference, upstream.entries.find((entry) => entry.id === "drive_receipt").reference);
  const prerequisiteValidation = validateProductionPrerequisiteReview(upstream, { prerequisites: prerequisites(), now: VALIDATE_TIME });
  const environmentValidation = validateProductionEnvironmentReview(environment, { prerequisiteReview: upstream, now: VALIDATE_TIME });
  assert.equal(prerequisiteValidation.ok, true, JSON.stringify(prerequisiteValidation.errors));
  assert.equal(environmentValidation.ok, true, JSON.stringify(environmentValidation.errors));
});
