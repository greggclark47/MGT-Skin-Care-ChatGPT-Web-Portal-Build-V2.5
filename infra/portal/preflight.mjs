import { pathToFileURL } from "node:url";
import { validateOwnershipEnvironment } from "./ownership.mjs";

const placeholder = /(your-|change[-_]?me|example\.|localhost|127\.0\.0\.1|user:password|database:5432)/i;

function isTrue(value) {
  return String(value).toLowerCase() === "true";
}

function validUrl(value, protocols) {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) && !placeholder.test(value);
  } catch {
    return false;
  }
}

function positiveNumber(value, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum;
}

function wholeNumber(value, minimum, maximum) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum;
}

function digestImage(value) {
  return /^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$/.test(String(value || "").trim());
}

function validEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || "").trim()) && !placeholder.test(value);
}

function validControlUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !placeholder.test(value);
  } catch {
    return false;
  }
}

function validIsoDate(value) {
  const text = String(value || "").trim();
  const time = Date.parse(text);
  return Number.isFinite(time) && new Date(time).toISOString() === text && time <= Date.now();
}

// pg-connection-string takes the last duplicate query value and lets a query
// `host` replace the URL hostname. Validate the exact target the client uses.
export function validProductionDatabaseUrl(value) {
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.hostname.includes("%")) return false;
    if (url.searchParams.getAll("sslmode").length !== 1 || url.searchParams.get("sslmode") !== "verify-full") return false;
    if (["host", "hostaddr", "port", "user", "password", "database"].some((key) => url.searchParams.has(key))) return false;
    return true;
  } catch {
    return false;
  }
}

export function validProductionOrigin(value, domain) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password && !url.port
      && url.pathname === "/" && !url.search && !url.hash && url.origin === value
      && typeof domain === "string" && url.hostname === domain;
  } catch {
    return false;
  }
}

export function validateEnvironment(env) {
  const errors = [...validateOwnershipEnvironment(env).errors];
  const warnings = [];
  const requireValue = (key) => {
    const value = String(env[key] || "").trim();
    if (!value || placeholder.test(value)) errors.push(`${key} must be set to a production value.`);
    return value;
  };

  if (env.NODE_ENV !== "production") errors.push("NODE_ENV must be production.");
  if (String(env.DEMO_MODE).toLowerCase() !== "false") errors.push("DEMO_MODE must be false.");

  const publicOrigin = requireValue("PUBLIC_ORIGIN");
  if (publicOrigin && !validUrl(publicOrigin, ["https:"])) errors.push("PUBLIC_ORIGIN must be a valid HTTPS origin.");

  const databaseUrl = requireValue("DATABASE_URL");
  if (databaseUrl && !validUrl(databaseUrl, ["postgres:", "postgresql:"])) errors.push("DATABASE_URL must be a production PostgreSQL URL.");
  if (databaseUrl && !validProductionDatabaseUrl(databaseUrl)) errors.push("DATABASE_URL must name a single production host and require verified TLS (one sslmode=verify-full, without target overrides).");
  if (env.PORTAL_AUTO_MIGRATE !== "false") errors.push("PORTAL_AUTO_MIGRATE must be false; review and apply database changes separately.");
  warnings.push("Configuration checks do not prove target-project identity, schema compatibility, RLS isolation, or data reconciliation. Those require separate release evidence.");

  const portalDomain = requireValue("PORTAL_DOMAIN");
  if (portalDomain && (portalDomain.includes("://") || portalDomain.includes("/") || placeholder.test(portalDomain))) {
    errors.push("PORTAL_DOMAIN must be a production hostname without a scheme or path.");
  }
  if (publicOrigin && portalDomain && !validProductionOrigin(publicOrigin, portalDomain)) errors.push("PUBLIC_ORIGIN must be the exact HTTPS origin for PORTAL_DOMAIN, without credentials, port, path, query, or fragment.");

  if (!digestImage(env.NODE_IMAGE)) errors.push("NODE_IMAGE must use an approved immutable @sha256 image digest.");
  if (!digestImage(env.API_IMAGE)) errors.push("API_IMAGE must use an approved immutable @sha256 application image digest.");
  if (!digestImage(env.WEB_IMAGE)) errors.push("WEB_IMAGE must use an approved immutable @sha256 application image digest.");
  if (!digestImage(env.OLLAMA_IMAGE)) errors.push("OLLAMA_IMAGE must use an approved immutable @sha256 image digest.");
  if (!digestImage(env.CADDY_IMAGE)) errors.push("CADDY_IMAGE must use an approved immutable @sha256 image digest.");

  const supabaseUrl = requireValue("SUPABASE_URL");
  if (supabaseUrl && !validControlUrl(supabaseUrl)) errors.push("SUPABASE_URL must be a production HTTPS URL without embedded credentials.");
  requireValue("SUPABASE_ANON_KEY");
  const serviceRole = requireValue("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRole && serviceRole === env.SUPABASE_ANON_KEY) errors.push("SUPABASE_SERVICE_ROLE_KEY must differ from SUPABASE_ANON_KEY.");

  if (!["true", "false"].includes(String(env.OLLAMA_ENABLED).toLowerCase())) errors.push("OLLAMA_ENABLED must be true or false.");
  if (isTrue(env.OLLAMA_ENABLED) && !validUrl(env.OLLAMA_BASE_URL, ["http:", "https:"])) errors.push("OLLAMA_BASE_URL must be a valid HTTP(S) URL when Ollama is enabled.");

  if (!["true", "false"].includes(String(env.OPENCLAW_ENABLED).toLowerCase())) errors.push("OPENCLAW_ENABLED must be true or false.");
  if (isTrue(env.OPENCLAW_ENABLED)) {
    if (!validUrl(env.OPENCLAW_BASE_URL, ["http:", "https:"])) errors.push("OPENCLAW_BASE_URL must be a valid HTTP(S) URL when OpenClaw is enabled.");
    const openClawMode = String(env.OPENCLAW_API_MODE || "ollama");
    if (!["ollama", "openai-completions"].includes(openClawMode)) errors.push("OPENCLAW_API_MODE must be ollama or openai-completions.");
    if (openClawMode === "openai-completions") requireValue("OPENCLAW_API_KEY");
  } else {
    warnings.push("OpenClaw orchestration is disabled.");
  }

  const workerInterval = Number(env.WORKER_INTERVAL_SECONDS);
  const readinessAge = Number(env.WORKER_READINESS_MAX_AGE_SECONDS);
  if (typeof env.WORKER_INTERVAL_SECONDS !== 'string' || !/^\d+$/.test(env.WORKER_INTERVAL_SECONDS) || !wholeNumber(env.WORKER_INTERVAL_SECONDS, 15, 3600)) errors.push("WORKER_INTERVAL_SECONDS must be a whole number between 15 and 3600.");
  if (typeof env.WORKER_READINESS_MAX_AGE_SECONDS !== 'string' || !/^\d+$/.test(env.WORKER_READINESS_MAX_AGE_SECONDS) || !wholeNumber(readinessAge, 60, 86400)) errors.push("WORKER_READINESS_MAX_AGE_SECONDS must be a whole number between 60 and 86400.");
  if (Number.isFinite(workerInterval) && Number.isFinite(readinessAge) && readinessAge < workerInterval * 2) {
    errors.push("WORKER_READINESS_MAX_AGE_SECONDS must be at least twice WORKER_INTERVAL_SECONDS.");
  }
  if (typeof env.BACKUP_MAX_AGE_HOURS !== "string" || !/^\d+$/.test(env.BACKUP_MAX_AGE_HOURS) || !wholeNumber(env.BACKUP_MAX_AGE_HOURS, 1, 72)) errors.push("BACKUP_MAX_AGE_HOURS must be a whole number between 1 and 72.");
  if (typeof env.BACKUP_RESTORE_MAX_AGE_DAYS !== "string" || !/^\d+$/.test(env.BACKUP_RESTORE_MAX_AGE_DAYS) || !wholeNumber(env.BACKUP_RESTORE_MAX_AGE_DAYS, 1, 365)) errors.push("BACKUP_RESTORE_MAX_AGE_DAYS must be a whole number between 1 and 365.");

  const delivery = String(env.NOTIFICATION_DELIVERY || "");
  if (!["in_app", "webhook"].includes(delivery)) errors.push("NOTIFICATION_DELIVERY must be in_app or webhook.");
  if (delivery === "webhook") {
    if (!validControlUrl(env.NOTIFICATION_WEBHOOK_URL)) errors.push("NOTIFICATION_WEBHOOK_URL must be HTTPS without embedded credentials for webhook delivery.");
    requireValue("NOTIFICATION_WEBHOOK_TOKEN");
    if (env.NOTIFICATION_WEBHOOK_KEY_ID !== undefined && !/^[A-Za-z0-9_-]{1,64}$/.test(env.NOTIFICATION_WEBHOOK_KEY_ID)) errors.push("NOTIFICATION_WEBHOOK_KEY_ID must contain only letters, numbers, underscores or hyphens.");
    if (env.NOTIFICATION_WEBHOOK_TIMEOUT_MS !== undefined && (typeof env.NOTIFICATION_WEBHOOK_TIMEOUT_MS !== "string" || !/^\d+$/.test(env.NOTIFICATION_WEBHOOK_TIMEOUT_MS) || !wholeNumber(env.NOTIFICATION_WEBHOOK_TIMEOUT_MS, 1000, 30000))) errors.push("NOTIFICATION_WEBHOOK_TIMEOUT_MS must be a whole number between 1000 and 30000.");
  }
  const notificationRetryBase = env.NOTIFICATION_RETRY_COOLDOWN_SECONDS ?? "300";
  const notificationRetryMax = env.NOTIFICATION_MAX_RETRY_DELAY_SECONDS ?? "3600";
  const notificationMaxAttempts = env.NOTIFICATION_MAX_ATTEMPTS ?? "3";
  const notificationRetention = env.OPERATIONS_NOTIFICATION_RETENTION_DAYS ?? "90";
  if (typeof notificationRetryBase !== "string" || !/^\d+$/.test(notificationRetryBase) || !wholeNumber(notificationRetryBase, 10, 3600)) errors.push("NOTIFICATION_RETRY_COOLDOWN_SECONDS must be a whole number between 10 and 3600.");
  if (typeof notificationRetryMax !== "string" || !/^\d+$/.test(notificationRetryMax) || !wholeNumber(notificationRetryMax, 10, 86400)) errors.push("NOTIFICATION_MAX_RETRY_DELAY_SECONDS must be a whole number between 10 and 86400.");
  if (typeof notificationMaxAttempts !== "string" || !/^\d+$/.test(notificationMaxAttempts) || !wholeNumber(notificationMaxAttempts, 1, 20)) errors.push("NOTIFICATION_MAX_ATTEMPTS must be a whole number between 1 and 20.");
  if (typeof notificationRetention !== "string" || !/^\d+$/.test(notificationRetention) || !wholeNumber(notificationRetention, 1, 3650)) errors.push("OPERATIONS_NOTIFICATION_RETENTION_DAYS must be a whole number between 1 and 3650.");
  if (wholeNumber(notificationRetryBase, 10, 3600) && wholeNumber(notificationRetryMax, 10, 86400) && Number(notificationRetryMax) < Number(notificationRetryBase)) errors.push("NOTIFICATION_MAX_RETRY_DELAY_SECONDS must be at least NOTIFICATION_RETRY_COOLDOWN_SECONDS.");

  const supportOwnerEmail = requireValue("SUPPORT_OWNER_EMAIL");
  if (supportOwnerEmail && !validEmail(supportOwnerEmail)) errors.push("SUPPORT_OWNER_EMAIL must be a valid production support owner email.");

  const accessibilityReport = requireValue("ACCESSIBILITY_VALIDATION_REPORT_URL");
  if (accessibilityReport && !validControlUrl(accessibilityReport)) errors.push("ACCESSIBILITY_VALIDATION_REPORT_URL must be a production HTTPS evidence URL without embedded credentials.");
  const accessibilityAt = requireValue("ACCESSIBILITY_VALIDATED_AT");
  if (accessibilityAt && !validIsoDate(accessibilityAt)) errors.push("ACCESSIBILITY_VALIDATED_AT must be a past ISO timestamp.");

  const monitoringDashboard = requireValue("MONITORING_DASHBOARD_URL");
  if (monitoringDashboard && !validControlUrl(monitoringDashboard)) errors.push("MONITORING_DASHBOARD_URL must be a production HTTPS URL without embedded credentials.");
  const incidentRunbook = requireValue("INCIDENT_RUNBOOK_URL");
  if (incidentRunbook && !validControlUrl(incidentRunbook)) errors.push("INCIDENT_RUNBOOK_URL must be a production HTTPS URL without embedded credentials.");
  const alertOwner = requireValue("ALERT_OWNER_EMAIL");
  if (alertOwner && !validEmail(alertOwner)) errors.push("ALERT_OWNER_EMAIL must identify the production alert owner.");
  if (typeof env.SUPPORT_RESPONSE_TARGET_HOURS !== "string" || !/^\d+$/.test(env.SUPPORT_RESPONSE_TARGET_HOURS) || !wholeNumber(env.SUPPORT_RESPONSE_TARGET_HOURS, 1, 168)) errors.push("SUPPORT_RESPONSE_TARGET_HOURS must be a whole number between 1 and 168.");
  if (env.OPERATIONS_ALERT_DELIVERY !== "webhook") errors.push("OPERATIONS_ALERT_DELIVERY must be webhook in production.");
  if (!validControlUrl(env.OPERATIONS_ALERT_WEBHOOK_URL)) errors.push("OPERATIONS_ALERT_WEBHOOK_URL must be a production HTTPS URL without embedded credentials.");
  requireValue("OPERATIONS_ALERT_WEBHOOK_TOKEN");
  if (env.OPERATIONS_ALERT_KEY_ID !== undefined && !/^[A-Za-z0-9_-]{1,64}$/.test(env.OPERATIONS_ALERT_KEY_ID)) errors.push("OPERATIONS_ALERT_KEY_ID must contain only letters, numbers, underscores or hyphens.");
  for (const [key,minimum,maximum] of [
    ["OPERATIONS_ALERT_TIMEOUT_MS",1000,30000],
    ["OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS",10,3600],
    ["OPERATIONS_ALERT_EVENT_RETENTION_DAYS",1,3650],
    ["OPERATIONS_ALERT_LEASE_SECONDS",10,600],
    ["OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS",10,86400],
    ["OPERATIONS_ALERT_MAX_ATTEMPTS",1,20]
  ]) if (env[key] !== undefined && env[key] !== "" && (typeof env[key] !== "string" || !/^\d+$/.test(env[key]) || !wholeNumber(env[key], minimum, maximum))) errors.push(`${key} must be a whole number between ${minimum} and ${maximum}.`);
  if (wholeNumber(env.OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS || "300",10,3600) && wholeNumber(env.OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS || "3600",10,86400) && Number(env.OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS || 3600) < Number(env.OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS || 300)) errors.push("OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS must be at least OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS.");

  if (!["true", "false"].includes(String(env.SUBSCRIPTIONS_ENABLED).toLowerCase())) errors.push("SUBSCRIPTIONS_ENABLED must be true or false.");
  if (isTrue(env.SUBSCRIPTIONS_ENABLED)) {
    if (!isTrue(env.SUBSCRIPTION_TERMS_APPROVED)) errors.push("SUBSCRIPTION_TERMS_APPROVED must be true before subscriptions are enabled.");
    for (const key of [
      "STRIPE_LIVE_MODE",
      "STRIPE_SECRET_KEY",
      "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET",
      "STRIPE_PREMIUM_PRODUCT_ID",
      "STRIPE_PREMIUM_MONTHLY_PRICE_ID",
      "STRIPE_PREMIUM_ANNUAL_PRICE_ID"
    ]) requireValue(key);
    const stripeLiveMode = String(env.STRIPE_LIVE_MODE || "").toLowerCase();
    if (!["true", "false"].includes(stripeLiveMode)) errors.push("STRIPE_LIVE_MODE must be true or false when subscriptions are enabled.");
    const secretPattern = stripeLiveMode === "true" ? /^sk_live_[A-Za-z0-9_]+$/ : /^sk_test_[A-Za-z0-9_]+$/;
    if (!secretPattern.test(String(env.STRIPE_SECRET_KEY || ""))) errors.push(`STRIPE_SECRET_KEY must match the configured ${stripeLiveMode === "true" ? "live" : "test"} Stripe mode.`);
    if (!/^whsec_[A-Za-z0-9_]+$/.test(String(env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET || ""))) errors.push("STRIPE_SUBSCRIPTION_WEBHOOK_SECRET must be a Stripe signing secret.");
    if (!/^prod_[A-Za-z0-9_]+$/.test(String(env.STRIPE_PREMIUM_PRODUCT_ID || ""))) errors.push("STRIPE_PREMIUM_PRODUCT_ID must identify the approved Premium product.");
    const monthlyPrice = String(env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || "");
    const annualPrice = String(env.STRIPE_PREMIUM_ANNUAL_PRICE_ID || "");
    if (!/^price_[A-Za-z0-9_]+$/.test(monthlyPrice)) errors.push("STRIPE_PREMIUM_MONTHLY_PRICE_ID must be a Stripe Price ID.");
    if (!/^price_[A-Za-z0-9_]+$/.test(annualPrice)) errors.push("STRIPE_PREMIUM_ANNUAL_PRICE_ID must be a Stripe Price ID.");
    if (monthlyPrice && monthlyPrice === annualPrice) errors.push("Monthly and annual Premium prices must use different Stripe Price IDs.");
  } else {
    warnings.push("Subscriptions are disabled.");
  }

  if (!String(env.OPENAI_API_KEY || "").trim()) warnings.push("Hosted OpenAI escalation is disabled; local routes remain available.");

  return { ok: errors.length === 0, errors, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = validateEnvironment(process.env);
  console.log("MGT portal production preflight");
  for (const warning of result.warnings) console.log(`WARN  ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  console.log(result.ok ? "PASS  Environment is ready for build/deployment checks." : `FAIL  ${result.errors.length} blocking configuration issue(s).`);
  process.exitCode = result.ok ? 0 : 1;
}
