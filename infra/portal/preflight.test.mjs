import assert from "node:assert/strict";
import test from "node:test";
import { validateEnvironment } from "./preflight.mjs";

const production = {
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
  MONITORING_DASHBOARD_URL: "https://monitoring.mgtskincare.test/dashboard",
  INCIDENT_RUNBOOK_URL: "https://operations.mgtskincare.test/runbook",
  ALERT_OWNER_EMAIL: "alerts@mgtskincare.test",
  SUPPORT_RESPONSE_TARGET_HOURS: "24",
  OPERATIONS_ALERT_DELIVERY: "webhook",
  OPERATIONS_ALERT_WEBHOOK_URL: "https://alerts.mgtskincare.test/events",
  OPERATIONS_ALERT_WEBHOOK_TOKEN: "configured-alert-token",
  OPERATIONS_ALERT_TIMEOUT_MS: "10000",
  OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS: "300",
  OPERATIONS_ALERT_EVENT_RETENTION_DAYS: "90",
  SUBSCRIPTIONS_ENABLED: "false",
  SUBSCRIPTION_TERMS_APPROVED: "false",
  NODE_IMAGE: `node@sha256:${"c".repeat(64)}`,
  API_IMAGE: `ghcr.io/mgt-skincare/api@sha256:${"d".repeat(64)}`,
  WEB_IMAGE: `ghcr.io/mgt-skincare/web@sha256:${"e".repeat(64)}`,
  OLLAMA_IMAGE: `ollama/ollama@sha256:${"a".repeat(64)}`,
  CADDY_IMAGE: `caddy@sha256:${"b".repeat(64)}`
};

test("accepts the proposed external database configuration without proving live readiness", () => {
  const result = validateEnvironment(production);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((warning) => warning.includes("OpenAI")));
});

test("rejects unverified database TLS and automatic production migrations", () => {
  const result=validateEnvironment({...production,DATABASE_URL:production.DATABASE_URL.replace('verify-full','disable'),PORTAL_AUTO_MIGRATE:'true'});
  assert.equal(result.ok,false);
  assert(result.errors.some(error=>error.includes('verified TLS')));
  assert(result.errors.some(error=>error.startsWith('PORTAL_AUTO_MIGRATE')));
});

test("rejects placeholders and an unsafe worker readiness window", () => {
  const result = validateEnvironment({
    ...production,
    PUBLIC_ORIGIN: "https://YOUR-PORTAL-HOST",
    DATABASE_URL: "postgresql://USER:PASSWORD@DATABASE:5432/mgt",
    WORKER_READINESS_MAX_AGE_SECONDS: "90",
    BACKUP_RESTORE_MAX_AGE_DAYS: "0"
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("PUBLIC_ORIGIN")));
  assert.ok(result.errors.some((error) => error.startsWith("DATABASE_URL")));
  assert.ok(result.errors.some((error) => error.includes("twice WORKER_INTERVAL_SECONDS")));
  assert.ok(result.errors.some((error) => error.startsWith("BACKUP_RESTORE_MAX_AGE_DAYS")));
});

test("requires the complete billing contract when subscriptions are enabled", () => {
  const result = validateEnvironment({
    ...production,
    SUBSCRIPTIONS_ENABLED: "true",
    SUBSCRIPTION_TERMS_APPROVED: "false"
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("SUBSCRIPTION_TERMS_APPROVED")));
  assert.ok(result.errors.some((error) => error.startsWith("STRIPE_SECRET_KEY")));
  assert.ok(result.errors.some((error) => error.startsWith("STRIPE_PREMIUM_PRODUCT_ID")));
  assert.ok(result.errors.some((error) => error.startsWith("STRIPE_PREMIUM_ANNUAL_PRICE_ID")));
});

test("accepts the locked Premium subscription configuration", () => {
  const result = validateEnvironment({
    ...production,
    SUBSCRIPTIONS_ENABLED: "true",
    SUBSCRIPTION_TERMS_APPROVED: "true",
    STRIPE_LIVE_MODE: "true",
    STRIPE_SECRET_KEY: "sk_live_configured",
    STRIPE_SUBSCRIPTION_WEBHOOK_SECRET: "whsec_configured",
    STRIPE_PREMIUM_PRODUCT_ID: "prod_premium",
    STRIPE_PREMIUM_MONTHLY_PRICE_ID: "price_premium_month",
    STRIPE_PREMIUM_ANNUAL_PRICE_ID: "price_premium_year"
  });
  assert.equal(result.ok, true);
});

test("accepts a complete Stripe sandbox configuration for staging", () => {
  const result = validateEnvironment({
    ...production,
    SUBSCRIPTIONS_ENABLED: "true",
    SUBSCRIPTION_TERMS_APPROVED: "true",
    STRIPE_LIVE_MODE: "false",
    STRIPE_SECRET_KEY: "sk_test_configured",
    STRIPE_SUBSCRIPTION_WEBHOOK_SECRET: "whsec_configured",
    STRIPE_PREMIUM_PRODUCT_ID: "prod_premium",
    STRIPE_PREMIUM_MONTHLY_PRICE_ID: "price_premium_month",
    STRIPE_PREMIUM_ANNUAL_PRICE_ID: "price_premium_year"
  });
  assert.equal(result.ok, true);
});

test("rejects malformed or cross-wired production billing identifiers", () => {
  const result = validateEnvironment({
    ...production,
    SUBSCRIPTIONS_ENABLED: "true",
    SUBSCRIPTION_TERMS_APPROVED: "true",
    STRIPE_LIVE_MODE: "true",
    STRIPE_SECRET_KEY: "sk_test_not_live",
    STRIPE_SUBSCRIPTION_WEBHOOK_SECRET: "not-a-signing-secret",
    STRIPE_PREMIUM_PRODUCT_ID: "price_wrong_kind",
    STRIPE_PREMIUM_MONTHLY_PRICE_ID: "price_same",
    STRIPE_PREMIUM_ANNUAL_PRICE_ID: "price_same"
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("configured live Stripe mode")));
  assert.ok(result.errors.some((error) => error.includes("signing secret")));
  assert.ok(result.errors.some((error) => error.includes("approved Premium product")));
  assert.ok(result.errors.some((error) => error.includes("different Stripe Price IDs")));
});

test("requires secure webhook delivery settings", () => {
  const result = validateEnvironment({
    ...production,
    NOTIFICATION_DELIVERY: "webhook",
    NOTIFICATION_WEBHOOK_URL: "http://notifications.internal",
    NOTIFICATION_WEBHOOK_TOKEN: ""
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("NOTIFICATION_WEBHOOK_URL")));
  assert.ok(result.errors.some((error) => error.startsWith("NOTIFICATION_WEBHOOK_TOKEN")));
});

test("requires named support ownership and deployed accessibility evidence", () => {
  const result = validateEnvironment({
    ...production,
    SUPPORT_OWNER_NAME: "",
    SUPPORT_OWNER_EMAIL: "support@example.invalid",
    ACCESSIBILITY_VALIDATION_REPORT_URL: "http://localhost/a11y",
    ACCESSIBILITY_VALIDATED_AT: "2999-01-01T00:00:00.000Z"
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("SUPPORT_OWNER_NAME")));
  assert.ok(result.errors.some((error) => error.startsWith("SUPPORT_OWNER_EMAIL")));
  assert.ok(result.errors.some((error) => error.startsWith("ACCESSIBILITY_VALIDATION_REPORT_URL")));
  assert.ok(result.errors.some((error) => error.startsWith("ACCESSIBILITY_VALIDATED_AT")));
});

test("requires production monitoring ownership, runbook and response target", () => {
  const result = validateEnvironment({
    ...production,
    MONITORING_DASHBOARD_URL: "http://localhost/dashboard",
    INCIDENT_RUNBOOK_URL: "",
    ALERT_OWNER_EMAIL: "alerts@example.invalid",
    SUPPORT_RESPONSE_TARGET_HOURS: "0",
    OPERATIONS_ALERT_DELIVERY: "disabled",
    OPERATIONS_ALERT_WEBHOOK_URL: "http://localhost/alerts",
    OPERATIONS_ALERT_WEBHOOK_TOKEN: "",
    OPERATIONS_ALERT_TIMEOUT_MS: "999",
    OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS: "1",
    OPERATIONS_ALERT_EVENT_RETENTION_DAYS: "0"
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("MONITORING_DASHBOARD_URL")));
  assert.ok(result.errors.some((error) => error.startsWith("INCIDENT_RUNBOOK_URL")));
  assert.ok(result.errors.some((error) => error.startsWith("ALERT_OWNER_EMAIL")));
  assert.ok(result.errors.some((error) => error.startsWith("SUPPORT_RESPONSE_TARGET_HOURS")));
  assert.ok(result.errors.some((error) => error.startsWith("OPERATIONS_ALERT_DELIVERY")));
  assert.ok(result.errors.some((error) => error.startsWith("OPERATIONS_ALERT_WEBHOOK_URL")));
  assert.ok(result.errors.some((error) => error.startsWith("OPERATIONS_ALERT_WEBHOOK_TOKEN")));
  assert.ok(result.errors.some((error) => error.startsWith("OPERATIONS_ALERT_TIMEOUT_MS")));
  assert.ok(result.errors.some((error) => error.startsWith("OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS")));
  assert.ok(result.errors.some((error) => error.startsWith("OPERATIONS_ALERT_EVENT_RETENTION_DAYS")));
});

test("rejects floating or placeholder container image tags", () => {
  const result = validateEnvironment({ ...production, OLLAMA_IMAGE: "ollama/ollama:latest", CADDY_IMAGE: "caddy:2" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("OLLAMA_IMAGE")));
  assert.ok(result.errors.some((error) => error.startsWith("CADDY_IMAGE")));
});

test("requires an immutable Node base image for application builds", () => {
  const result = validateEnvironment({ ...production, NODE_IMAGE: "node:24-bookworm-slim" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("NODE_IMAGE")));
});

test("requires immutable deployable API and web application images", () => {
  const result = validateEnvironment({ ...production, API_IMAGE: "ghcr.io/mgt/api:latest", WEB_IMAGE: "" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("API_IMAGE")));
  assert.ok(result.errors.some((error) => error.startsWith("WEB_IMAGE")));
});

test("allows native Ollama mode without an OpenClaw key and gates proxy mode", () => {
  const native = validateEnvironment({ ...production, OPENCLAW_ENABLED: "true", OPENCLAW_BASE_URL: "http://ollama:11434", OPENCLAW_API_MODE: "ollama", OPENCLAW_API_KEY: "" });
  assert.equal(native.ok, true);
  const invalid = validateEnvironment({ ...production, OPENCLAW_ENABLED: "true", OPENCLAW_BASE_URL: "http://ollama:11434", OPENCLAW_API_MODE: "unsupported" });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.includes("OPENCLAW_API_MODE")));
  const proxy = validateEnvironment({ ...production, OPENCLAW_ENABLED: "true", OPENCLAW_BASE_URL: "http://proxy.internal", OPENCLAW_API_MODE: "openai-completions", OPENCLAW_API_KEY: "" });
  assert.equal(proxy.ok, false);
  assert.ok(proxy.errors.some((error) => error.startsWith("OPENCLAW_API_KEY")));
});
