import assert from "node:assert/strict";
import test from "node:test";
import { buildReleaseReadiness, liveEvidenceFromEnvironment, RELEASE_PHASES, RELEASE_STATUSES } from "./release-readiness.mjs";

const base = {
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
  NOTIFICATION_DELIVERY: "in_app",
  SUPPORT_OWNER_NAME: "MGT Support Lead",
  SUPPORT_OWNER_EMAIL: "support-lead@mgtskincare.test",
  ACCESSIBILITY_VALIDATION_REPORT_URL: "https://evidence.mgtskincare.test/a11y/report",
  ACCESSIBILITY_VALIDATED_AT: "2026-09-01T00:00:00.000Z",
  SUBSCRIPTIONS_ENABLED: "false",
  SUBSCRIPTION_TERMS_APPROVED: "false",
  NODE_IMAGE: `node@sha256:${"c".repeat(64)}`,
  OLLAMA_IMAGE: `ollama/ollama@sha256:${"a".repeat(64)}`,
  CADDY_IMAGE: `caddy@sha256:${"b".repeat(64)}`
};

test("defines the ten next phases and only uses documented statuses", () => {
  assert.deepEqual(RELEASE_PHASES.map((item) => item.id), ["F71", "F72", "F73", "F74", "F75", "F76", "F77", "F78", "F79", "F80"]);
  assert.ok(RELEASE_PHASES.every((item) => item.owner && item.evidence));
  const packet = buildReleaseReadiness({ env: base });
  assert.ok(packet.phases.every((item) => RELEASE_STATUSES.includes(item.status)));
});

test("keeps local configuration separate from live deployment proof", () => {
  const packet = buildReleaseReadiness({ env: base, localGates: true });
  assert.equal(packet.preflight.ok, true);
  assert.equal(packet.phases.find((item) => item.id === "F72").status, "pass");
  assert.equal(packet.phases.find((item) => item.id === "F75").status, "pending");
  assert.equal(packet.release_ready, false);
});

test("marks disabled subscriptions as not applicable and blocks incomplete setup", () => {
  const disabled = buildReleaseReadiness({ env: base });
  assert.equal(disabled.phases.find((item) => item.id === "F77").status, "not_applicable");
  const enabled = buildReleaseReadiness({ env: { ...base, SUBSCRIPTIONS_ENABLED: "true" } });
  assert.equal(enabled.phases.find((item) => item.id === "F77").status, "blocked");
});

test("reaches a ready packet only with local gates and every required live evidence item", () => {
  const packet = buildReleaseReadiness({
    env: base,
    localGates: true,
    liveEvidence: {
      support_workflow: true,
      accessibility_deployed: true,
      database_rls: true,
      backup_restore: true,
      container_startup: true,
      ai_provider: true
    }
  });
  assert.equal(packet.release_ready, true);
  assert.ok(packet.phases.every((item) => item.status === "pass" || item.status === "not_applicable"));
});

test("never includes secret values in the packet", () => {
  const packet = buildReleaseReadiness({ env: { ...base, SUPABASE_SERVICE_ROLE_KEY: "super-secret-value" } });
  assert.equal(JSON.stringify(packet).includes("super-secret-value"), false);
});

test("maps only explicit non-secret evidence flags from the environment", () => {
  const evidence = liveEvidenceFromEnvironment({
    RELEASE_EVIDENCE_SUPPORT_WORKFLOW: "true",
    RELEASE_EVIDENCE_DATABASE_RLS: "TRUE",
    RELEASE_EVIDENCE_AI_PROVIDER: "false"
  });
  assert.equal(evidence.support_workflow, true);
  assert.equal(evidence.database_rls, true);
  assert.equal(evidence.ai_provider, false);
  assert.equal(evidence.container_startup, false);
});
