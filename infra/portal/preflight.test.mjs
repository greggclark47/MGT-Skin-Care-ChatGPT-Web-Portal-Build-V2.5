import assert from "node:assert/strict";
import test from "node:test";
import { validateEnvironment, validProductionDatabaseUrl, validProductionOrigin } from "./preflight.mjs";

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
  HOST: "0.0.0.0",
  PORT: "3100",
  WORKER_HEALTH_FILE: "/tmp/mgt-worker-health.json",
  WORKER_INTERVAL_SECONDS: "60",
  WORKER_READINESS_MAX_AGE_SECONDS: "300",
  BACKUP_MAX_AGE_HOURS: "26",
  BACKUP_RESTORE_MAX_AGE_DAYS: "90",
  NOTIFICATION_DELIVERY: "in_app",
  RELEASE_OWNER_NAME: "Gregg Clark of MGT",
  SUPPORT_OWNER_NAME: "Gregg Clark of MGT",
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

test("requires the exact lowercase production demo-mode declaration", () => {
  assert.equal(validateEnvironment(production).ok, true);
  for (const value of [undefined, "", "False", "FALSE", "true", "0", false]) {
    const result = validateEnvironment({ ...production, DEMO_MODE: value });
    assert.equal(result.ok, false, JSON.stringify(value));
    assert.ok(result.errors.some((error) => error.startsWith("DEMO_MODE")));
  }
});

test("rejects unverified database TLS and automatic production migrations", () => {
  const result=validateEnvironment({...production,DATABASE_URL:production.DATABASE_URL.replace('verify-full','disable'),PORTAL_AUTO_MIGRATE:'true'});
  assert.equal(result.ok,false);
  assert(result.errors.some(error=>error.includes('verified TLS')));
  assert(result.errors.some(error=>error.startsWith('PORTAL_AUTO_MIGRATE')));
});

test("rejects database URL settings that the PostgreSQL parser could reinterpret", () => {
  const baseline = production.DATABASE_URL;
  assert.equal(validProductionDatabaseUrl(baseline), true);
  for (const changed of [
    `${baseline}&sslmode=disable`,
    `${baseline}&sslmode=verify-full`,
    `${baseline}&host=other.internal`,
    `${baseline}&%68ost=other.internal`,
    `${baseline}&port=6543`,
    `${baseline}&user=other`
  ]) {
    const result = validateEnvironment({ ...production, DATABASE_URL: changed });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("verified TLS")));
    assert.equal(result.errors.join(" ").includes("other.internal"), false);
  }
});

test("production database URL requires one database path and no fragment", () => {
  assert.equal(validProductionDatabaseUrl("postgresql://db.example/mgt?sslmode=verify-full"), true);
  for (const value of [
    "postgresql://db.example?sslmode=verify-full",
    "postgresql://db.example/team/mgt?sslmode=verify-full",
    "postgresql://db.example/mgt?sslmode=verify-full#shadow"
  ]) assert.equal(validProductionDatabaseUrl(value), false, value);
});

test("binds the public HTTPS origin to the production portal domain", () => {
  assert.equal(validProductionOrigin(production.PUBLIC_ORIGIN, production.PORTAL_DOMAIN), true);
  for (const changed of [
    `${production.PUBLIC_ORIGIN}/path`,
    `${production.PUBLIC_ORIGIN}?token=hidden`,
    `${production.PUBLIC_ORIGIN}#fragment`,
    production.PUBLIC_ORIGIN.replace('portal.', 'other.'),
    production.PUBLIC_ORIGIN.replace('https://', 'https://operator@')
  ]) {
    const result = validateEnvironment({ ...production, PUBLIC_ORIGIN: changed });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes('exact HTTPS origin')));
    assert.equal(result.errors.join(' ').includes('hidden'), false);
  }
});

test("requires the identity service to use one exact HTTPS origin", () => {
  for (const changed of [
    `${production.SUPABASE_URL}/auth`,
    `${production.SUPABASE_URL}?tenant=other`,
    `${production.SUPABASE_URL}#shadow`
  ]) {
    const result = validateEnvironment({ ...production, SUPABASE_URL: changed });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.startsWith("SUPABASE_URL")));
  }
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

test("requires a whole worker interval before scheduling production sweeps", () => {
  const result = validateEnvironment({ ...production, WORKER_INTERVAL_SECONDS: "60.0001" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("WORKER_INTERVAL_SECONDS must be a whole number")));
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

test("rejects secret references with whitespace or control characters", () => {
  for (const [key, value] of [
    ["SUPABASE_ANON_KEY", " anon-production-value"],
    ["SUPABASE_SERVICE_ROLE_KEY", "service-production-value\n"],
    ["OPERATIONS_ALERT_WEBHOOK_TOKEN", " configured-alert-token "],
    ["OPENAI_API_KEY", "configured\tkey"]
  ]) {
    const result = validateEnvironment({ ...production, [key]: value });
    assert.equal(result.ok, false, key);
    assert.ok(result.errors.some((error) => error.startsWith(key)), key);
  }
});

test("rejects query strings and fragments on control and evidence URLs", () => {
  for (const [key, value] of [
    ["MONITORING_DASHBOARD_URL", `${production.MONITORING_DASHBOARD_URL}?token=hidden`],
    ["INCIDENT_RUNBOOK_URL", `${production.INCIDENT_RUNBOOK_URL}#alternate`],
    ["ACCESSIBILITY_VALIDATION_REPORT_URL", `${production.ACCESSIBILITY_VALIDATION_REPORT_URL}?download=1`],
    ["OPERATIONS_ALERT_WEBHOOK_URL", `${production.OPERATIONS_ALERT_WEBHOOK_URL}#alternate`]
  ]) {
    const result = validateEnvironment({ ...production, [key]: value });
    assert.equal(result.ok, false, key);
    assert.ok(result.errors.some((error) => error.startsWith(key)), key);
  }
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

test("rejects an invalid notification webhook key identifier before deployment", () => {
  const result = validateEnvironment({
    ...production,
    NOTIFICATION_DELIVERY: "webhook",
    NOTIFICATION_WEBHOOK_URL: "https://notifications.example.test/events",
    NOTIFICATION_WEBHOOK_TOKEN: "test-only-token",
    NOTIFICATION_WEBHOOK_KEY_ID: "not valid"
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("NOTIFICATION_WEBHOOK_KEY_ID")));
});

test("rejects invalid notification retry policy before deployment", () => {
  const result = validateEnvironment({
    ...production,
    NOTIFICATION_RETRY_COOLDOWN_SECONDS: "9",
    NOTIFICATION_MAX_RETRY_DELAY_SECONDS: "30.5",
    NOTIFICATION_MAX_ATTEMPTS: "0"
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("NOTIFICATION_RETRY_COOLDOWN_SECONDS")));
  assert.ok(result.errors.some((error) => error.startsWith("NOTIFICATION_MAX_RETRY_DELAY_SECONDS")));
  assert.ok(result.errors.some((error) => error.startsWith("NOTIFICATION_MAX_ATTEMPTS")));
});

test("rejects an invalid notification webhook timeout before deployment", () => {
  const result = validateEnvironment({
    ...production,
    NOTIFICATION_DELIVERY: "webhook",
    NOTIFICATION_WEBHOOK_URL: "https://notifications.example.test/events",
    NOTIFICATION_WEBHOOK_TOKEN: "test-only-token",
    NOTIFICATION_WEBHOOK_TIMEOUT_MS: "999"
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("NOTIFICATION_WEBHOOK_TIMEOUT_MS")));

  const blankTimeout = validateEnvironment({
    ...production,
    NOTIFICATION_DELIVERY: "webhook",
    NOTIFICATION_WEBHOOK_URL: "https://notifications.example.test/events",
    NOTIFICATION_WEBHOOK_TOKEN: "test-only-token",
    NOTIFICATION_WEBHOOK_TIMEOUT_MS: ""
  });
  assert.equal(blankTimeout.ok, false);
  assert.ok(blankTimeout.errors.some((error) => error.startsWith("NOTIFICATION_WEBHOOK_TIMEOUT_MS")));
});

test("rejects a notification retry cap below the initial cooldown", () => {
  const result = validateEnvironment({
    ...production,
    NOTIFICATION_RETRY_COOLDOWN_SECONDS: "600",
    NOTIFICATION_MAX_RETRY_DELAY_SECONDS: "300"
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("at least NOTIFICATION_RETRY_COOLDOWN_SECONDS")));
});

test("requires named support ownership and deployed accessibility evidence", () => {
  const result = validateEnvironment({
    ...production,
    RELEASE_OWNER_NAME: "",
    SUPPORT_OWNER_NAME: "",
    SUPPORT_OWNER_EMAIL: "support@example.invalid",
    ACCESSIBILITY_VALIDATION_REPORT_URL: "http://localhost/a11y",
    ACCESSIBILITY_VALIDATED_AT: "2999-01-01T00:00:00.000Z"
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("RELEASE_OWNER_NAME")));
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
