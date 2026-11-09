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

function validSecretReference(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 4096
    && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value) && !placeholder.test(value);
}

function validApprovalReference(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 200
    && /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value) && !placeholder.test(value);
}

function validControlUrl(value) {
  try {
    const url = new URL(value);
    return typeof value === "string" && value.length <= 2048 && value === value.trim()
      && url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && !placeholder.test(value);
  } catch {
    return false;
  }
}

function validServiceOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      && url.pathname === "/" && !url.search && !url.hash && url.origin === value && !placeholder.test(value);
  } catch {
    return false;
  }
}

function validAiServiceUrl(value) {
  try {
    const url = new URL(value);
    const privateHttp = url.protocol === "http:" && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(url.hostname);
    const externalHttps = url.protocol === "https:" && validProductionHostname(url.hostname);
    return typeof value === "string" && value.length <= 2048 && value === value.trim()
      && (privateHttp || externalHttps) && !url.username && !url.password && !url.search && !url.hash && !placeholder.test(value);
  } catch {
    return false;
  }
}

function validIsoDate(value) {
  const text = String(value || "").trim();
  const time = Date.parse(text);
  return Number.isFinite(time) && new Date(time).toISOString() === text && time <= Date.now();
}

function validateSponsoredContentConfiguration(env, errors, warnings) {
  if (!["true", "false"].includes(env.MGT_SPONSORED_CONTENT_ENABLED)) errors.push("MGT_SPONSORED_CONTENT_ENABLED must be exactly true or false.");
  if (!["true", "false"].includes(env.MGT_SPONSORED_CONTENT_REVIEWED)) errors.push("MGT_SPONSORED_CONTENT_REVIEWED must be exactly true or false.");
  if (env.MGT_SPONSORED_CONTENT_ENABLED === "true") {
    if (env.MGT_SPONSORED_CONTENT_REVIEWED !== "true") errors.push("MGT_SPONSORED_CONTENT_REVIEWED must be exactly true before sponsored content is enabled.");
    if (env.MGT_OMNI_RETAIL_ENABLED !== "true" || env.MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED !== "true") errors.push("Sponsored content requires approved omni-retail merchant authorization controls.");
    if (!validApprovalReference(env.MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE)) errors.push("MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE must be a bounded reviewed approval reference.");
    if (!validIsoDate(env.MGT_SPONSORED_CONTENT_APPROVED_AT)) errors.push("MGT_SPONSORED_CONTENT_APPROVED_AT must be a past ISO timestamp.");
  } else if (env.MGT_SPONSORED_CONTENT_ENABLED === "false") {
    if (env.MGT_SPONSORED_CONTENT_REVIEWED !== "false") errors.push("Disabled sponsored content must not retain an approved review state.");
    if (
      (env.MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE !== undefined && env.MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE !== "")
      || (env.MGT_SPONSORED_CONTENT_APPROVED_AT !== undefined && env.MGT_SPONSORED_CONTENT_APPROVED_AT !== "")
    ) errors.push("Disabled sponsored content must not retain approval configuration.");
    warnings.push("Sponsored content is disabled.");
  }
}

function validProductionHostname(value) {
  if (typeof value !== "string" || value.length > 253 || value !== value.toLowerCase() || !value.includes(".") || /^\d+(?:\.\d+){3}$/.test(value)) return false;
  return value.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}

// pg-connection-string takes the last duplicate query value and lets a query
// `host` replace the URL hostname. Validate the exact target the client uses.
export function validProductionDatabaseUrl(value) {
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.hostname.includes("%") || !/^\/[^/]+$/.test(url.pathname) || url.hash) return false;
    if (url.searchParams.getAll("sslmode").length !== 1 || url.searchParams.get("sslmode") !== "verify-full") return false;
    if (["host", "hostaddr", "port", "user", "password", "database"].some((key) => url.searchParams.has(key))) return false;
    if ([...url.searchParams.keys()].some((key) => key !== "sslmode")) return false;
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
  if (env.DEMO_MODE !== "false") errors.push("DEMO_MODE must be exactly false.");

  const publicOrigin = requireValue("PUBLIC_ORIGIN");
  if (publicOrigin && !validUrl(publicOrigin, ["https:"])) errors.push("PUBLIC_ORIGIN must be a valid HTTPS origin.");

  const databaseUrl = requireValue("DATABASE_URL");
  if (databaseUrl && !validUrl(databaseUrl, ["postgres:", "postgresql:"])) errors.push("DATABASE_URL must be a production PostgreSQL URL.");
  if (databaseUrl && !validProductionDatabaseUrl(databaseUrl)) errors.push("DATABASE_URL must name a single production host and require verified TLS (one sslmode=verify-full, without target overrides).");
  if (env.PORTAL_AUTO_MIGRATE !== "false") errors.push("PORTAL_AUTO_MIGRATE must be false; review and apply database changes separately.");
  warnings.push("Configuration checks do not prove target-project identity, schema compatibility, RLS isolation, or data reconciliation. Those require separate release evidence.");

  const portalDomain = requireValue("PORTAL_DOMAIN");
  if (portalDomain && (!validProductionHostname(portalDomain) || placeholder.test(portalDomain))) {
    errors.push("PORTAL_DOMAIN must be a canonical lowercase production DNS hostname.");
  }
  if (publicOrigin && portalDomain && !validProductionOrigin(publicOrigin, portalDomain)) errors.push("PUBLIC_ORIGIN must be the exact HTTPS origin for PORTAL_DOMAIN, without credentials, port, path, query, or fragment.");
  const policyUrls = ["PUBLIC_PRIVACY_NOTICE_URL", "PUBLIC_TERMS_OF_USE_URL", "PUBLIC_AI_DISCLOSURE_URL"].map(requireValue);
  for (const [index, key] of ["PUBLIC_PRIVACY_NOTICE_URL", "PUBLIC_TERMS_OF_USE_URL", "PUBLIC_AI_DISCLOSURE_URL"].entries()) if (policyUrls[index] && !validControlUrl(policyUrls[index])) errors.push(`${key} must be an approved HTTPS public notice URL without embedded credentials, query, or fragment.`);
  if (policyUrls.every(Boolean) && new Set(policyUrls).size !== policyUrls.length) errors.push("PUBLIC_PRIVACY_NOTICE_URL, PUBLIC_TERMS_OF_USE_URL, and PUBLIC_AI_DISCLOSURE_URL must be distinct approved public notice URLs.");
  if (typeof env.MGT_EDGE_TOKEN !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(env.MGT_EDGE_TOKEN)) errors.push("MGT_EDGE_TOKEN must be an injected 32-256 character private edge authentication token.");

  if (!digestImage(env.NODE_IMAGE)) errors.push("NODE_IMAGE must use an approved immutable @sha256 image digest.");
  if (!digestImage(env.API_IMAGE)) errors.push("API_IMAGE must use an approved immutable @sha256 application image digest.");
  if (!digestImage(env.WEB_IMAGE)) errors.push("WEB_IMAGE must use an approved immutable @sha256 application image digest.");
  if (!digestImage(env.OLLAMA_IMAGE)) errors.push("OLLAMA_IMAGE must use an approved immutable @sha256 image digest.");
  if (!digestImage(env.CADDY_IMAGE)) errors.push("CADDY_IMAGE must use an approved immutable @sha256 image digest.");
  const imageReferences = [env.NODE_IMAGE, env.API_IMAGE, env.WEB_IMAGE, env.OLLAMA_IMAGE, env.CADDY_IMAGE].filter(digestImage);
  if (new Set(imageReferences).size !== imageReferences.length) errors.push("Production image references must remain distinct across deployment roles.");

  const supabaseUrl = requireValue("SUPABASE_URL");
  if (supabaseUrl && !validServiceOrigin(supabaseUrl)) errors.push("SUPABASE_URL must be an exact production HTTPS origin without credentials, port, path, query, or fragment.");
  const anonKey = requireValue("SUPABASE_ANON_KEY");
  const serviceRole = requireValue("SUPABASE_SERVICE_ROLE_KEY");
  if (anonKey && !validSecretReference(env.SUPABASE_ANON_KEY)) errors.push("SUPABASE_ANON_KEY must be a bounded injected reference without whitespace or control characters.");
  if (serviceRole && !validSecretReference(env.SUPABASE_SERVICE_ROLE_KEY)) errors.push("SUPABASE_SERVICE_ROLE_KEY must be a bounded injected reference without whitespace or control characters.");
  if (serviceRole && serviceRole === env.SUPABASE_ANON_KEY) errors.push("SUPABASE_SERVICE_ROLE_KEY must differ from SUPABASE_ANON_KEY.");
  const googleOAuthEnabled = env.SUPABASE_GOOGLE_OAUTH_ENABLED;
  if (!["true", "false"].includes(googleOAuthEnabled)) errors.push("SUPABASE_GOOGLE_OAUTH_ENABLED must be explicitly true or false.");

  if (!["true", "false"].includes(env.OLLAMA_ENABLED)) errors.push("OLLAMA_ENABLED must be exactly true or false.");
  if (env.OLLAMA_ENABLED === "true" && !validAiServiceUrl(env.OLLAMA_BASE_URL)) errors.push("OLLAMA_BASE_URL must use HTTPS or a canonical single-label private HTTP service without credentials, query, or fragment.");

  if (!["true", "false"].includes(env.OPENCLAW_ENABLED)) errors.push("OPENCLAW_ENABLED must be exactly true or false.");
  if (env.OPENCLAW_ENABLED === "true") {
    if (!validAiServiceUrl(env.OPENCLAW_BASE_URL)) errors.push("OPENCLAW_BASE_URL must use HTTPS or a canonical single-label private HTTP service without credentials, query, or fragment.");
    const openClawMode = env.OPENCLAW_API_MODE;
    if (!["ollama", "openai-completions"].includes(openClawMode)) errors.push("OPENCLAW_API_MODE must be ollama or openai-completions.");
    if (openClawMode === "openai-completions") {
      const openClawKey = requireValue("OPENCLAW_API_KEY");
      if (openClawKey && !validSecretReference(env.OPENCLAW_API_KEY)) errors.push("OPENCLAW_API_KEY must be a bounded injected reference without whitespace or control characters.");
    }
  } else {
    warnings.push("OpenClaw orchestration is disabled.");
  }

  if (!["true", "false"].includes(env.OLLAMA_CLOUD_ENABLED)) errors.push("OLLAMA_CLOUD_ENABLED must be exactly true or false.");
  if (env.OLLAMA_CLOUD_ENABLED === "true") {
    if (env.OLLAMA_CLOUD_BASE_URL !== "https://ollama.com") errors.push("OLLAMA_CLOUD_BASE_URL must be the approved https://ollama.com origin.");
    if (env.OLLAMA_CLOUD_MODEL !== "deepseek-v4.1-flash") errors.push("OLLAMA_CLOUD_MODEL must be the approved DeepSeek cloud model.");
    const ollamaCloudKey = requireValue("OLLAMA_CLOUD_API_KEY");
    if (ollamaCloudKey && !validSecretReference(env.OLLAMA_CLOUD_API_KEY)) errors.push("OLLAMA_CLOUD_API_KEY must be injected as a bounded non-placeholder reference without whitespace or control characters.");
  } else if (env.OLLAMA_CLOUD_ENABLED === "false") warnings.push("Ollama Cloud escalation is disabled; local routes remain primary.");

  const workerInterval = Number(env.WORKER_INTERVAL_SECONDS);
  const readinessAge = Number(env.WORKER_READINESS_MAX_AGE_SECONDS);
  if (typeof env.WORKER_INTERVAL_SECONDS !== 'string' || !/^\d+$/.test(env.WORKER_INTERVAL_SECONDS) || !wholeNumber(env.WORKER_INTERVAL_SECONDS, 15, 3600)) errors.push("WORKER_INTERVAL_SECONDS must be a whole number between 15 and 3600.");
  if (typeof env.WORKER_READINESS_MAX_AGE_SECONDS !== 'string' || !/^\d+$/.test(env.WORKER_READINESS_MAX_AGE_SECONDS) || !wholeNumber(readinessAge, 60, 86400)) errors.push("WORKER_READINESS_MAX_AGE_SECONDS must be a whole number between 60 and 86400.");
  if (Number.isFinite(workerInterval) && Number.isFinite(readinessAge) && readinessAge < workerInterval * 2) {
    errors.push("WORKER_READINESS_MAX_AGE_SECONDS must be at least twice WORKER_INTERVAL_SECONDS.");
  }
  if (!["0.0.0.0", "::"].includes(env.HOST)) errors.push("HOST must bind the production container on 0.0.0.0 or ::.");
  if (typeof env.PORT !== "string" || !/^\d+$/.test(env.PORT) || !wholeNumber(env.PORT, 1024, 65535)) errors.push("PORT must be a whole number between 1024 and 65535.");
  const workerHealthFile = env.WORKER_HEALTH_FILE;
  if (typeof workerHealthFile !== "string" || !workerHealthFile.startsWith("/") || workerHealthFile.includes("\\") || workerHealthFile.split("/").includes("..") || workerHealthFile.length > 240 || !/^[A-Za-z0-9._/-]+\.json$/.test(workerHealthFile)) errors.push("WORKER_HEALTH_FILE must be a bounded absolute JSON path without traversal.");
  if (typeof env.BACKUP_MAX_AGE_HOURS !== "string" || !/^\d+$/.test(env.BACKUP_MAX_AGE_HOURS) || !wholeNumber(env.BACKUP_MAX_AGE_HOURS, 1, 72)) errors.push("BACKUP_MAX_AGE_HOURS must be a whole number between 1 and 72.");
  if (typeof env.BACKUP_RESTORE_MAX_AGE_DAYS !== "string" || !/^\d+$/.test(env.BACKUP_RESTORE_MAX_AGE_DAYS) || !wholeNumber(env.BACKUP_RESTORE_MAX_AGE_DAYS, 1, 365)) errors.push("BACKUP_RESTORE_MAX_AGE_DAYS must be a whole number between 1 and 365.");

  const backupAttestationEnabled = env.BACKUP_ATTESTATION_ENABLED;
  if (!["true", "false"].includes(backupAttestationEnabled)) errors.push("BACKUP_ATTESTATION_ENABLED must be explicitly true or false.");
  if (backupAttestationEnabled === "true") {
    const attestationSecret = requireValue("BACKUP_ATTESTATION_SECRET");
    if (attestationSecret && !validSecretReference(attestationSecret)) errors.push("BACKUP_ATTESTATION_SECRET must be a bounded injected reference without whitespace or control characters.");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(env.BACKUP_ATTESTATION_KEY_ID || "")) errors.push("BACKUP_ATTESTATION_KEY_ID must identify the active backup signing key using letters, numbers, underscores or hyphens.");
    if (typeof env.BACKUP_ATTESTATION_MAX_AGE_SECONDS !== "string" || !/^\d+$/.test(env.BACKUP_ATTESTATION_MAX_AGE_SECONDS) || !wholeNumber(env.BACKUP_ATTESTATION_MAX_AGE_SECONDS, 1, 604800)) errors.push("BACKUP_ATTESTATION_MAX_AGE_SECONDS must be explicitly configured as a whole number between 1 and 604800 when backup attestation is enabled.");
  }
  const backupAttestationRetention = env.OPERATIONS_BACKUP_ATTESTATION_RETENTION_DAYS;
  if (typeof backupAttestationRetention !== "string" || !/^\d+$/.test(backupAttestationRetention) || !wholeNumber(backupAttestationRetention, 1, 3650)) errors.push("OPERATIONS_BACKUP_ATTESTATION_RETENTION_DAYS must be a whole number between 1 and 3650.");

  const delivery = String(env.NOTIFICATION_DELIVERY || "");
  if (!["in_app", "webhook"].includes(delivery)) errors.push("NOTIFICATION_DELIVERY must be in_app or webhook.");
  if (delivery === "webhook") {
    if (!validControlUrl(env.NOTIFICATION_WEBHOOK_URL)) errors.push("NOTIFICATION_WEBHOOK_URL must be HTTPS without embedded credentials for webhook delivery.");
    const notificationToken = requireValue("NOTIFICATION_WEBHOOK_TOKEN");
    if (notificationToken && !validSecretReference(env.NOTIFICATION_WEBHOOK_TOKEN)) errors.push("NOTIFICATION_WEBHOOK_TOKEN must be a bounded injected reference without whitespace or control characters.");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(env.NOTIFICATION_WEBHOOK_KEY_ID || "")) errors.push("NOTIFICATION_WEBHOOK_KEY_ID must identify the active signing key using letters, numbers, underscores or hyphens.");
    if (env.NOTIFICATION_WEBHOOK_TIMEOUT_MS !== undefined && (typeof env.NOTIFICATION_WEBHOOK_TIMEOUT_MS !== "string" || !/^\d+$/.test(env.NOTIFICATION_WEBHOOK_TIMEOUT_MS) || !wholeNumber(env.NOTIFICATION_WEBHOOK_TIMEOUT_MS, 1000, 30000))) errors.push("NOTIFICATION_WEBHOOK_TIMEOUT_MS must be a whole number between 1000 and 30000.");
  }
  const notificationRetryBase = env.NOTIFICATION_RETRY_COOLDOWN_SECONDS;
  const notificationRetryMax = env.NOTIFICATION_MAX_RETRY_DELAY_SECONDS;
  const notificationMaxAttempts = env.NOTIFICATION_MAX_ATTEMPTS;
  const notificationRetention = env.OPERATIONS_NOTIFICATION_RETENTION_DAYS;
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
  const alertToken = requireValue("OPERATIONS_ALERT_WEBHOOK_TOKEN");
  if (alertToken && !validSecretReference(env.OPERATIONS_ALERT_WEBHOOK_TOKEN)) errors.push("OPERATIONS_ALERT_WEBHOOK_TOKEN must be a bounded injected reference without whitespace or control characters.");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(env.OPERATIONS_ALERT_KEY_ID || "")) errors.push("OPERATIONS_ALERT_KEY_ID must identify the active signing key using letters, numbers, underscores or hyphens.");
  const requiredProductionOperations = [
    "NOTIFICATION_RETRY_COOLDOWN_SECONDS", "NOTIFICATION_MAX_RETRY_DELAY_SECONDS", "NOTIFICATION_MAX_ATTEMPTS",
    "OPERATIONS_ALERT_TIMEOUT_MS", "OPERATIONS_ALERT_LEASE_SECONDS", "OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS",
    "OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS", "OPERATIONS_ALERT_MAX_ATTEMPTS", "OPERATIONS_ALERT_EVENT_RETENTION_DAYS",
    "OPERATIONS_FOLLOW_UP_OVERDUE_GRACE_SECONDS", "OPERATIONS_FOLLOW_UP_RETRY_DELAY_SECONDS",
    "OPERATIONS_FOLLOW_UP_MAX_ATTEMPTS", "OPERATIONS_FOLLOW_UP_RETENTION_DAYS", "OPERATIONS_AI_LOG_RETENTION_DAYS",
    "OPERATIONS_NOTIFICATION_RETENTION_DAYS", "OPERATIONS_BILLING_RETENTION_DAYS", "OPERATIONS_WEBHOOK_RECEIPT_RETENTION_DAYS",
    "OPERATIONS_AGGREGATE_METRIC_RETENTION_DAYS", "OPERATIONS_DELETION_PROOF_RETENTION_DAYS", "OPERATIONS_RUN_RETENTION_DAYS",
    "OPERATIONS_BACKUP_ATTESTATION_RETENTION_DAYS", "OPERATIONS_ANTI_AGING_RETENTION_DAYS"
  ];
  if (env.NODE_ENV === "production") for (const key of requiredProductionOperations) if (typeof env[key] !== "string" || env[key] === "") errors.push(`${key} must be explicitly configured in production; runtime defaults are not admitted.`);
  for (const [key,minimum,maximum] of [
    ["OPERATIONS_ALERT_TIMEOUT_MS",1000,30000],
    ["OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS",10,3600],
    ["OPERATIONS_ALERT_EVENT_RETENTION_DAYS",1,3650],
    ["OPERATIONS_ALERT_LEASE_SECONDS",10,600],
    ["OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS",10,86400],
    ["OPERATIONS_ALERT_MAX_ATTEMPTS",1,20],
    ["OPERATIONS_FOLLOW_UP_OVERDUE_GRACE_SECONDS",60,86400],
    ["OPERATIONS_FOLLOW_UP_RETRY_DELAY_SECONDS",10,86400],
    ["OPERATIONS_FOLLOW_UP_MAX_ATTEMPTS",1,20],
    ["OPERATIONS_FOLLOW_UP_RETENTION_DAYS",30,3650]
  ]) if (env[key] !== undefined && env[key] !== "" && (typeof env[key] !== "string" || !/^\d+$/.test(env[key]) || !wholeNumber(env[key], minimum, maximum))) errors.push(`${key} must be a whole number between ${minimum} and ${maximum}.`);
  for (const [key,minimum,maximum] of [
    ["OPERATIONS_AI_LOG_RETENTION_DAYS",1,3650],
    ["OPERATIONS_BILLING_RETENTION_DAYS",30,3650],
    ["OPERATIONS_WEBHOOK_RECEIPT_RETENTION_DAYS",7,3650],
    ["OPERATIONS_AGGREGATE_METRIC_RETENTION_DAYS",30,3650],
    ["OPERATIONS_DELETION_PROOF_RETENTION_DAYS",30,3650],
    ["OPERATIONS_RUN_RETENTION_DAYS",1,3650]
  ]) if (env[key] !== undefined && env[key] !== "" && (typeof env[key] !== "string" || !/^\d+$/.test(env[key]) || !wholeNumber(env[key], minimum, maximum))) errors.push(`${key} must be a whole number between ${minimum} and ${maximum}.`);
  if (wholeNumber(env.OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS,10,3600) && wholeNumber(env.OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS,10,86400) && Number(env.OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS) < Number(env.OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS)) errors.push("OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS must be at least OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS.");
  const alertTimeoutMs = Number(env.OPERATIONS_ALERT_TIMEOUT_MS);
  const alertLeaseSeconds = Number(env.OPERATIONS_ALERT_LEASE_SECONDS);
  if (wholeNumber(alertTimeoutMs, 1000, 30000) && wholeNumber(alertLeaseSeconds, 10, 600) && alertLeaseSeconds * 1000 < alertTimeoutMs + 5000) errors.push("OPERATIONS_ALERT_LEASE_SECONDS must exceed OPERATIONS_ALERT_TIMEOUT_MS by at least five seconds.");

  if (!["true", "false"].includes(env.SUBSCRIPTIONS_ENABLED)) errors.push("SUBSCRIPTIONS_ENABLED must be exactly true or false.");
  for (const key of ["STRIPE_USAGE_BILLING_ENABLED", "STRIPE_B2B_INVOICING_ENABLED"]) if (env[key] !== undefined && !["true", "false"].includes(env[key])) errors.push(`${key} must be exactly true or false.`);
  const commercialStripeEnabled = env.STRIPE_USAGE_BILLING_ENABLED === "true" || env.STRIPE_B2B_INVOICING_ENABLED === "true";
  if (commercialStripeEnabled && env.SUBSCRIPTIONS_ENABLED !== "true") {
    for (const key of ["STRIPE_LIVE_MODE", "STRIPE_SECRET_KEY"]) requireValue(key);
    const pattern = env.STRIPE_LIVE_MODE === "true" ? /^sk_live_[A-Za-z0-9_]+$/ : /^sk_test_[A-Za-z0-9_]+$/;
    if (!["true", "false"].includes(env.STRIPE_LIVE_MODE)) errors.push("STRIPE_LIVE_MODE must be true or false when commercial Stripe billing is enabled.");
    if (!pattern.test(String(env.STRIPE_SECRET_KEY || ""))) errors.push("STRIPE_SECRET_KEY must match the configured Stripe mode.");
  }
  if (env.STRIPE_USAGE_BILLING_ENABLED === "true" && !/^[a-z][a-z0-9_.-]{2,99}$/.test(String(env.STRIPE_API_METER_EVENT_NAME || ""))) errors.push("STRIPE_API_METER_EVENT_NAME must identify the approved Stripe Billing Meter event.");
  if (env.SUBSCRIPTIONS_ENABLED === "true") {
    if (env.SUBSCRIPTION_TERMS_APPROVED !== "true") errors.push("SUBSCRIPTION_TERMS_APPROVED must be exactly true before subscriptions are enabled.");
    for (const key of [
      "STRIPE_LIVE_MODE",
      "STRIPE_SECRET_KEY",
      "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET",
      "STRIPE_PREMIUM_PRODUCT_ID",
      "STRIPE_PREMIUM_MONTHLY_PRICE_ID",
      "STRIPE_PREMIUM_ANNUAL_PRICE_ID"
    ]) requireValue(key);
    const stripeLiveMode = env.STRIPE_LIVE_MODE;
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
    const studioMonthly = String(env.STRIPE_STUDIO_MONTHLY_PRICE_ID || ""), studioAnnual = String(env.STRIPE_STUDIO_ANNUAL_PRICE_ID || "");
    if ((studioMonthly || studioAnnual) && (!/^price_[A-Za-z0-9_]+$/.test(studioMonthly) || !/^price_[A-Za-z0-9_]+$/.test(studioAnnual) || studioMonthly === studioAnnual)) errors.push("Studio enrollment requires two distinct Stripe Price IDs configured together.");
  } else {
    warnings.push("Subscriptions are disabled.");
  }

  validateSponsoredContentConfiguration(env, errors, warnings);

  if (!["true", "false"].includes(env.HOSTED_OPENAI_ENABLED)) errors.push("HOSTED_OPENAI_ENABLED must be exactly true or false.");
  if (env.HOSTED_OPENAI_ENABLED === "true") {
    const hostedOpenAiKey = requireValue("OPENAI_API_KEY");
    if (hostedOpenAiKey && !validSecretReference(env.OPENAI_API_KEY)) errors.push("OPENAI_API_KEY must be injected as a bounded non-placeholder reference without whitespace or control characters.");
  } else if (env.HOSTED_OPENAI_ENABLED === "false") warnings.push("Hosted OpenAI escalation is disabled; local routes remain available.");

  for (const key of ["ANTI_AGING_LIVE_AI", "ANTI_AGING_CHECKOUT_ENABLED", "ANTI_AGING_BOOKING_ENABLED", "ANTI_AGING_IMAGE_ANALYSIS_ENABLED", "ANTI_AGING_ACCESSIBILITY_VERIFIED", "ANTI_AGING_RESTORE_VERIFIED", "ANTI_AGING_PRIVACY_REVIEWED"]) {
    if (!["true", "false"].includes(env[key])) errors.push(`${key} must be explicitly true or false.`);
  }
  const antiAgingRetention = env.OPERATIONS_ANTI_AGING_RETENTION_DAYS;
  if (typeof antiAgingRetention !== "string" || !/^\d+$/.test(antiAgingRetention) || !wholeNumber(antiAgingRetention, 30, 3650)) errors.push("OPERATIONS_ANTI_AGING_RETENTION_DAYS must be a whole number between 30 and 3650.");

  const secretKeys = ["SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPERATIONS_ALERT_WEBHOOK_TOKEN", "MGT_EDGE_TOKEN"];
  if (backupAttestationEnabled === "true") secretKeys.push("BACKUP_ATTESTATION_SECRET");
  if (env.NOTIFICATION_DELIVERY === "webhook") secretKeys.push("NOTIFICATION_WEBHOOK_TOKEN");
  if (env.OPENCLAW_ENABLED === "true" && env.OPENCLAW_API_MODE === "openai-completions") secretKeys.push("OPENCLAW_API_KEY");
  if (env.OLLAMA_CLOUD_ENABLED === "true") secretKeys.push("OLLAMA_CLOUD_API_KEY");
  if (env.HOSTED_OPENAI_ENABLED === "true") secretKeys.push("OPENAI_API_KEY");
  if (env.SUBSCRIPTIONS_ENABLED === "true" || commercialStripeEnabled) secretKeys.push("STRIPE_SECRET_KEY");
  if (env.SUBSCRIPTIONS_ENABLED === "true") secretKeys.push("STRIPE_SUBSCRIPTION_WEBHOOK_SECRET");
  const secretReferences = secretKeys.map((key) => env[key]).filter(validSecretReference);
  if (new Set(secretReferences).size !== secretReferences.length) errors.push("Production secret references must remain distinct across integration roles.");

  const endpointKeys = ["MONITORING_DASHBOARD_URL", "INCIDENT_RUNBOOK_URL", "ACCESSIBILITY_VALIDATION_REPORT_URL", "OPERATIONS_ALERT_WEBHOOK_URL"];
  if (env.NOTIFICATION_DELIVERY === "webhook") endpointKeys.push("NOTIFICATION_WEBHOOK_URL");
  const endpointReferences = endpointKeys.map((key) => env[key]).filter((value) => typeof value === "string" && value.length > 0);
  if (new Set(endpointReferences).size !== endpointReferences.length) errors.push("Production control and delivery endpoints must remain distinct across roles.");

  const populated = (keys) => keys.some((key) => env[key] !== undefined && env[key] !== "");
  if (env.NOTIFICATION_DELIVERY === "in_app" && populated(["NOTIFICATION_WEBHOOK_URL", "NOTIFICATION_WEBHOOK_TOKEN", "NOTIFICATION_WEBHOOK_KEY_ID", "NOTIFICATION_WEBHOOK_TIMEOUT_MS"])) errors.push("Disabled customer webhook delivery must not retain webhook configuration.");
  if (env.OLLAMA_ENABLED === "false" && populated(["OLLAMA_BASE_URL"])) errors.push("Disabled Ollama must not retain an endpoint.");
  if (env.OPENCLAW_ENABLED === "false" && populated(["OPENCLAW_BASE_URL", "OPENCLAW_API_MODE", "OPENCLAW_API_KEY"])) errors.push("Disabled OpenClaw must not retain endpoint, mode, or credential configuration.");
  if (env.OPENCLAW_ENABLED === "true" && env.OPENCLAW_API_MODE === "ollama" && populated(["OPENCLAW_API_KEY"])) errors.push("Native Ollama-mode OpenClaw must not retain a credential.");
  if (env.OLLAMA_CLOUD_ENABLED === "false" && populated(["OLLAMA_CLOUD_BASE_URL", "OLLAMA_CLOUD_MODEL", "OLLAMA_CLOUD_API_KEY"])) errors.push("Disabled Ollama Cloud must not retain endpoint, model, or credential configuration.");
  if (env.HOSTED_OPENAI_ENABLED === "false" && populated(["OPENAI_API_KEY"])) errors.push("Disabled hosted OpenAI must not retain a credential.");
  if (env.NODE_ENV === "production" && (env.CLIENT_IMAGE_DRIVE_TEST_ENABLED === "true" || populated(["TEST_GOOGLE_DRIVE_CLIENT_ID", "TEST_GOOGLE_DRIVE_CLIENT_SECRET", "TEST_GOOGLE_DRIVE_REFRESH_TOKEN", "TEST_GOOGLE_DRIVE_FOLDER_ID"]))) errors.push("Production test Google Drive image storage must remain disabled and must not retain test credentials or folder configuration.");
  if (backupAttestationEnabled === "false" && populated(["BACKUP_ATTESTATION_SECRET", "BACKUP_ATTESTATION_KEY_ID", "BACKUP_ATTESTATION_MAX_AGE_SECONDS"])) errors.push("Disabled backup attestation must not retain signing configuration.");
  if (env.SUBSCRIPTIONS_ENABLED === "false" && !commercialStripeEnabled && populated(["STRIPE_LIVE_MODE", "STRIPE_SECRET_KEY", "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET", "STRIPE_PREMIUM_PRODUCT_ID", "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_ANNUAL_PRICE_ID", "STRIPE_STUDIO_MONTHLY_PRICE_ID", "STRIPE_STUDIO_ANNUAL_PRICE_ID", "STRIPE_API_METER_EVENT_NAME"])) errors.push("Disabled subscriptions and commercial billing must not retain Stripe configuration.");
  if (env.STRIPE_USAGE_BILLING_ENABLED !== "true" && populated(["STRIPE_API_METER_EVENT_NAME"])) errors.push("Disabled usage billing must not retain a Stripe meter event name.");

  return { ok: errors.length === 0, errors, warnings };
}

// Deployment validation above deliberately evaluates the complete release
// bundle. Process startup is narrower: a service must validate everything it
// consumes, but must not require credentials assigned only to its peer.
function runtimeContext(env) {
  const errors = [...validateOwnershipEnvironment(env).errors];
  const warnings = [];
  const requireValue = (key) => {
    const value = String(env[key] || "").trim();
    if (!value || placeholder.test(value)) errors.push(`${key} must be set to a production value.`);
    return value;
  };
  if (env.NODE_ENV !== "production") errors.push("NODE_ENV must be production.");
  if (env.DEMO_MODE !== "false") errors.push("DEMO_MODE must be exactly false.");
  return { env, errors, warnings, requireValue };
}

function validateRuntimeDatabase(context) {
  const databaseUrl = context.requireValue("DATABASE_URL");
  if (databaseUrl && !validUrl(databaseUrl, ["postgres:", "postgresql:"])) context.errors.push("DATABASE_URL must be a production PostgreSQL URL.");
  if (databaseUrl && !validProductionDatabaseUrl(databaseUrl)) context.errors.push("DATABASE_URL must name a single production host and require verified TLS (one sslmode=verify-full, without target overrides).");
  if (context.env.PORTAL_AUTO_MIGRATE !== "false") context.errors.push("PORTAL_AUTO_MIGRATE must be false; review and apply database changes separately.");
}

function rejectPeerSecretResidue(context, role, keys) {
  for (const key of keys) {
    const value = context.env[key];
    if (value !== undefined && value !== "") context.errors.push(`${role} runtime must not receive ${key}.`);
  }
}

function validateRuntimeWorkerTiming(context) {
  const interval = context.env.WORKER_INTERVAL_SECONDS;
  const readiness = context.env.WORKER_READINESS_MAX_AGE_SECONDS;
  const runOnce = context.env.WORKER_RUN_ONCE;
  if (typeof interval !== "string" || !/^\d+$/.test(interval) || !wholeNumber(interval, 15, 3600)) context.errors.push("WORKER_INTERVAL_SECONDS must be a whole number between 15 and 3600.");
  if (typeof readiness !== "string" || !/^\d+$/.test(readiness) || !wholeNumber(readiness, 60, 86400)) context.errors.push("WORKER_READINESS_MAX_AGE_SECONDS must be a whole number between 60 and 86400.");
  if (wholeNumber(interval, 15, 3600) && wholeNumber(readiness, 60, 86400) && Number(readiness) < Number(interval) * 2) context.errors.push("WORKER_READINESS_MAX_AGE_SECONDS must be at least twice WORKER_INTERVAL_SECONDS.");
  if (runOnce !== undefined && !["true", "false"].includes(runOnce)) context.errors.push("WORKER_RUN_ONCE must be exactly true or false when configured.");
}

function validateApiRuntimeEnvironment(context) {
  const { env, errors, warnings, requireValue } = context;
  rejectPeerSecretResidue(context, "API", ["SUPABASE_SERVICE_ROLE_KEY", "OPERATIONS_ALERT_WEBHOOK_TOKEN", "NOTIFICATION_WEBHOOK_TOKEN"]);
  const publicOrigin = requireValue("PUBLIC_ORIGIN");
  const portalDomain = requireValue("PORTAL_DOMAIN");
  if (publicOrigin && !validUrl(publicOrigin, ["https:"])) errors.push("PUBLIC_ORIGIN must be a valid HTTPS origin.");
  if (portalDomain && (!validProductionHostname(portalDomain) || placeholder.test(portalDomain))) errors.push("PORTAL_DOMAIN must be a canonical lowercase production DNS hostname.");
  if (publicOrigin && portalDomain && !validProductionOrigin(publicOrigin, portalDomain)) errors.push("PUBLIC_ORIGIN must be the exact HTTPS origin for PORTAL_DOMAIN, without credentials, port, path, query, or fragment.");
  const policyUrls = ["PUBLIC_PRIVACY_NOTICE_URL", "PUBLIC_TERMS_OF_USE_URL", "PUBLIC_AI_DISCLOSURE_URL"].map(requireValue);
  for (const [index, key] of ["PUBLIC_PRIVACY_NOTICE_URL", "PUBLIC_TERMS_OF_USE_URL", "PUBLIC_AI_DISCLOSURE_URL"].entries()) if (policyUrls[index] && !validControlUrl(policyUrls[index])) errors.push(`${key} must be an approved HTTPS public notice URL without embedded credentials, query, or fragment.`);
  if (policyUrls.every(Boolean) && new Set(policyUrls).size !== policyUrls.length) errors.push("PUBLIC_PRIVACY_NOTICE_URL, PUBLIC_TERMS_OF_USE_URL, and PUBLIC_AI_DISCLOSURE_URL must be distinct approved public notice URLs.");
  if (typeof env.MGT_EDGE_TOKEN !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(env.MGT_EDGE_TOKEN)) errors.push("MGT_EDGE_TOKEN must be an injected 32-256 character private edge authentication token.");
  validateRuntimeDatabase(context);
  validateRuntimeWorkerTiming(context);

  const supabaseUrl = requireValue("SUPABASE_URL");
  if (supabaseUrl && !validServiceOrigin(supabaseUrl)) errors.push("SUPABASE_URL must be an exact production HTTPS origin without credentials, port, path, query, or fragment.");
  const anonKey = requireValue("SUPABASE_ANON_KEY");
  if (anonKey && !validSecretReference(env.SUPABASE_ANON_KEY)) errors.push("SUPABASE_ANON_KEY must be a bounded injected reference without whitespace or control characters.");
  if (!["true", "false"].includes(env.SUPABASE_GOOGLE_OAUTH_ENABLED)) errors.push("SUPABASE_GOOGLE_OAUTH_ENABLED must be explicitly true or false.");

  if (!["true", "false"].includes(env.OLLAMA_ENABLED)) errors.push("OLLAMA_ENABLED must be exactly true or false.");
  if (env.OLLAMA_ENABLED === "true" && !validAiServiceUrl(env.OLLAMA_BASE_URL)) errors.push("OLLAMA_BASE_URL must use HTTPS or a canonical single-label private HTTP service without credentials, query, or fragment.");
  if (!["true", "false"].includes(env.OPENCLAW_ENABLED)) errors.push("OPENCLAW_ENABLED must be exactly true or false.");
  if (env.OPENCLAW_ENABLED === "true") {
    if (!validAiServiceUrl(env.OPENCLAW_BASE_URL)) errors.push("OPENCLAW_BASE_URL must use HTTPS or a canonical single-label private HTTP service without credentials, query, or fragment.");
    if (!["ollama", "openai-completions"].includes(env.OPENCLAW_API_MODE)) errors.push("OPENCLAW_API_MODE must be ollama or openai-completions.");
    if (env.OPENCLAW_API_MODE === "openai-completions") {
      const key = requireValue("OPENCLAW_API_KEY");
      if (key && !validSecretReference(env.OPENCLAW_API_KEY)) errors.push("OPENCLAW_API_KEY must be a bounded injected reference without whitespace or control characters.");
    }
  } else warnings.push("OpenClaw orchestration is disabled.");
  if (!["true", "false"].includes(env.OLLAMA_CLOUD_ENABLED)) errors.push("OLLAMA_CLOUD_ENABLED must be exactly true or false.");
  if (env.OLLAMA_CLOUD_ENABLED === "true") {
    if (env.OLLAMA_CLOUD_BASE_URL !== "https://ollama.com") errors.push("OLLAMA_CLOUD_BASE_URL must be the approved https://ollama.com origin.");
    if (env.OLLAMA_CLOUD_MODEL !== "deepseek-v4.1-flash") errors.push("OLLAMA_CLOUD_MODEL must be the approved DeepSeek cloud model.");
    const ollamaCloudKey = requireValue("OLLAMA_CLOUD_API_KEY");
    if (ollamaCloudKey && !validSecretReference(env.OLLAMA_CLOUD_API_KEY)) errors.push("OLLAMA_CLOUD_API_KEY must be injected as a bounded non-placeholder reference without whitespace or control characters.");
  } else if (env.OLLAMA_CLOUD_ENABLED === "false") warnings.push("Ollama Cloud escalation is disabled; local routes remain primary.");
  if (!["true", "false"].includes(env.HOSTED_OPENAI_ENABLED)) errors.push("HOSTED_OPENAI_ENABLED must be exactly true or false.");
  if (env.HOSTED_OPENAI_ENABLED === "true") {
    const hostedOpenAiKey = requireValue("OPENAI_API_KEY");
    if (hostedOpenAiKey && !validSecretReference(env.OPENAI_API_KEY)) errors.push("OPENAI_API_KEY must be injected as a bounded non-placeholder reference without whitespace or control characters.");
  } else if (env.HOSTED_OPENAI_ENABLED === "false") warnings.push("Hosted OpenAI escalation is disabled; local routes remain available.");

  if (!["0.0.0.0", "::"].includes(env.HOST)) errors.push("HOST must bind the production container on 0.0.0.0 or ::.");
  if (typeof env.PORT !== "string" || !/^\d+$/.test(env.PORT) || !wholeNumber(env.PORT, 1024, 65535)) errors.push("PORT must be a whole number between 1024 and 65535.");
  const attestation = env.BACKUP_ATTESTATION_ENABLED;
  if (!["true", "false"].includes(attestation)) errors.push("BACKUP_ATTESTATION_ENABLED must be explicitly true or false.");
  if (attestation === "true") {
    const secret = requireValue("BACKUP_ATTESTATION_SECRET");
    if (secret && !validSecretReference(env.BACKUP_ATTESTATION_SECRET)) errors.push("BACKUP_ATTESTATION_SECRET must be a bounded injected reference without whitespace or control characters.");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(env.BACKUP_ATTESTATION_KEY_ID || "")) errors.push("BACKUP_ATTESTATION_KEY_ID must identify the active backup signing key using letters, numbers, underscores or hyphens.");
    if (typeof env.BACKUP_ATTESTATION_MAX_AGE_SECONDS !== "string" || !/^\d+$/.test(env.BACKUP_ATTESTATION_MAX_AGE_SECONDS) || !wholeNumber(env.BACKUP_ATTESTATION_MAX_AGE_SECONDS, 1, 604800)) errors.push("BACKUP_ATTESTATION_MAX_AGE_SECONDS must be explicitly configured as a whole number between 1 and 604800 when backup attestation is enabled.");
  }

  const accessibilityReport = requireValue("ACCESSIBILITY_VALIDATION_REPORT_URL");
  const accessibilityAt = requireValue("ACCESSIBILITY_VALIDATED_AT");
  if (accessibilityReport && !validControlUrl(accessibilityReport)) errors.push("ACCESSIBILITY_VALIDATION_REPORT_URL must be a production HTTPS evidence URL without embedded credentials.");
  if (accessibilityAt && !validIsoDate(accessibilityAt)) errors.push("ACCESSIBILITY_VALIDATED_AT must be a past ISO timestamp.");
  if (!["true", "false"].includes(env.SUBSCRIPTIONS_ENABLED)) errors.push("SUBSCRIPTIONS_ENABLED must be exactly true or false.");
  for (const key of ["STRIPE_USAGE_BILLING_ENABLED", "STRIPE_B2B_INVOICING_ENABLED"]) if (env[key] !== undefined && !["true", "false"].includes(env[key])) errors.push(`${key} must be exactly true or false.`);
  const commercialStripeEnabled = env.STRIPE_USAGE_BILLING_ENABLED === "true" || env.STRIPE_B2B_INVOICING_ENABLED === "true";
  if (commercialStripeEnabled && env.SUBSCRIPTIONS_ENABLED !== "true") {
    for (const key of ["STRIPE_LIVE_MODE", "STRIPE_SECRET_KEY"]) requireValue(key);
    const pattern = env.STRIPE_LIVE_MODE === "true" ? /^sk_live_[A-Za-z0-9_]+$/ : /^sk_test_[A-Za-z0-9_]+$/;
    if (!["true", "false"].includes(env.STRIPE_LIVE_MODE)) errors.push("STRIPE_LIVE_MODE must be true or false when commercial Stripe billing is enabled.");
    if (!pattern.test(String(env.STRIPE_SECRET_KEY || ""))) errors.push("STRIPE_SECRET_KEY must match the configured Stripe mode.");
  }
  if (env.STRIPE_USAGE_BILLING_ENABLED === "true" && !/^[a-z][a-z0-9_.-]{2,99}$/.test(String(env.STRIPE_API_METER_EVENT_NAME || ""))) errors.push("STRIPE_API_METER_EVENT_NAME must identify the approved Stripe Billing Meter event.");
  if (env.SUBSCRIPTIONS_ENABLED === "true") {
    if (env.SUBSCRIPTION_TERMS_APPROVED !== "true") errors.push("SUBSCRIPTION_TERMS_APPROVED must be exactly true before subscriptions are enabled.");
    for (const key of ["STRIPE_LIVE_MODE", "STRIPE_SECRET_KEY", "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET", "STRIPE_PREMIUM_PRODUCT_ID", "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_ANNUAL_PRICE_ID"]) requireValue(key);
    const pattern = env.STRIPE_LIVE_MODE === "true" ? /^sk_live_[A-Za-z0-9_]+$/ : /^sk_test_[A-Za-z0-9_]+$/;
    if (!["true", "false"].includes(env.STRIPE_LIVE_MODE)) errors.push("STRIPE_LIVE_MODE must be true or false when subscriptions are enabled.");
    if (!pattern.test(String(env.STRIPE_SECRET_KEY || ""))) errors.push("STRIPE_SECRET_KEY must match the configured Stripe mode.");
    if (!/^whsec_[A-Za-z0-9_]+$/.test(String(env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET || ""))) errors.push("STRIPE_SUBSCRIPTION_WEBHOOK_SECRET must be a Stripe signing secret.");
    if (!/^prod_[A-Za-z0-9_]+$/.test(String(env.STRIPE_PREMIUM_PRODUCT_ID || ""))) errors.push("STRIPE_PREMIUM_PRODUCT_ID must identify the approved Premium product.");
    const monthly = String(env.STRIPE_PREMIUM_MONTHLY_PRICE_ID || ""), annual = String(env.STRIPE_PREMIUM_ANNUAL_PRICE_ID || "");
    if (!/^price_[A-Za-z0-9_]+$/.test(monthly)) errors.push("STRIPE_PREMIUM_MONTHLY_PRICE_ID must be a Stripe Price ID.");
    if (!/^price_[A-Za-z0-9_]+$/.test(annual)) errors.push("STRIPE_PREMIUM_ANNUAL_PRICE_ID must be a Stripe Price ID.");
    if (monthly && monthly === annual) errors.push("Monthly and annual Premium prices must use different Stripe Price IDs.");
    const studioMonthly = String(env.STRIPE_STUDIO_MONTHLY_PRICE_ID || ""), studioAnnual = String(env.STRIPE_STUDIO_ANNUAL_PRICE_ID || "");
    if ((studioMonthly || studioAnnual) && (!/^price_[A-Za-z0-9_]+$/.test(studioMonthly) || !/^price_[A-Za-z0-9_]+$/.test(studioAnnual) || studioMonthly === studioAnnual)) errors.push("Studio enrollment requires two distinct Stripe Price IDs configured together.");
  } else warnings.push("Subscriptions are disabled.");
  validateSponsoredContentConfiguration(env, errors, warnings);
  for (const key of ["ANTI_AGING_LIVE_AI", "ANTI_AGING_CHECKOUT_ENABLED", "ANTI_AGING_BOOKING_ENABLED", "ANTI_AGING_IMAGE_ANALYSIS_ENABLED", "ANTI_AGING_ACCESSIBILITY_VERIFIED", "ANTI_AGING_RESTORE_VERIFIED", "ANTI_AGING_PRIVACY_REVIEWED"]) if (!["true", "false"].includes(env[key])) errors.push(`${key} must be explicitly true or false.`);
  const populated = (keys) => keys.some((key) => env[key] !== undefined && env[key] !== "");
  if (env.OLLAMA_ENABLED === "false" && populated(["OLLAMA_BASE_URL"])) errors.push("Disabled Ollama must not retain an endpoint.");
  if (env.OPENCLAW_ENABLED === "false" && populated(["OPENCLAW_BASE_URL", "OPENCLAW_API_MODE", "OPENCLAW_API_KEY"])) errors.push("Disabled OpenClaw must not retain endpoint, mode, or credential configuration.");
  if (env.OPENCLAW_ENABLED === "true" && env.OPENCLAW_API_MODE === "ollama" && populated(["OPENCLAW_API_KEY"])) errors.push("Native Ollama-mode OpenClaw must not retain a credential.");
  if (env.OLLAMA_CLOUD_ENABLED === "false" && populated(["OLLAMA_CLOUD_BASE_URL", "OLLAMA_CLOUD_MODEL", "OLLAMA_CLOUD_API_KEY"])) errors.push("Disabled Ollama Cloud must not retain endpoint, model, or credential configuration.");
  if (env.HOSTED_OPENAI_ENABLED === "false" && populated(["OPENAI_API_KEY"])) errors.push("Disabled hosted OpenAI must not retain a credential.");
  if (env.NODE_ENV === "production" && (env.CLIENT_IMAGE_DRIVE_TEST_ENABLED === "true" || populated(["TEST_GOOGLE_DRIVE_CLIENT_ID", "TEST_GOOGLE_DRIVE_CLIENT_SECRET", "TEST_GOOGLE_DRIVE_REFRESH_TOKEN", "TEST_GOOGLE_DRIVE_FOLDER_ID"]))) errors.push("Production test Google Drive image storage must remain disabled and must not retain test credentials or folder configuration.");
  if (attestation === "false" && populated(["BACKUP_ATTESTATION_SECRET", "BACKUP_ATTESTATION_KEY_ID", "BACKUP_ATTESTATION_MAX_AGE_SECONDS"])) errors.push("Disabled backup attestation must not retain signing configuration.");
  if (env.SUBSCRIPTIONS_ENABLED === "false" && !commercialStripeEnabled && populated(["STRIPE_LIVE_MODE", "STRIPE_SECRET_KEY", "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET", "STRIPE_PREMIUM_PRODUCT_ID", "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_ANNUAL_PRICE_ID", "STRIPE_STUDIO_MONTHLY_PRICE_ID", "STRIPE_STUDIO_ANNUAL_PRICE_ID", "STRIPE_API_METER_EVENT_NAME"])) errors.push("Disabled subscriptions and commercial billing must not retain Stripe configuration.");
  if (env.STRIPE_USAGE_BILLING_ENABLED !== "true" && populated(["STRIPE_API_METER_EVENT_NAME"])) errors.push("Disabled usage billing must not retain a Stripe meter event name.");
}

function validateWorkerRuntimeEnvironment(context) {
  const { env, errors, requireValue } = context;
  rejectPeerSecretResidue(context, "Worker", ["MGT_EDGE_TOKEN", "SUPABASE_ANON_KEY", "BACKUP_ATTESTATION_SECRET", "STRIPE_SECRET_KEY", "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET", "OPENAI_API_KEY", "OPENCLAW_API_KEY", "OLLAMA_CLOUD_API_KEY"]);
  validateRuntimeDatabase(context);
  validateRuntimeWorkerTiming(context);
  const healthFile = env.WORKER_HEALTH_FILE;
  if (typeof healthFile !== "string" || !healthFile.startsWith("/") || healthFile.includes("\\") || healthFile.split("/").includes("..") || healthFile.length > 240 || !/^[A-Za-z0-9._/-]+\.json$/.test(healthFile)) errors.push("WORKER_HEALTH_FILE must be a bounded absolute JSON path without traversal.");
  const supabaseUrl = requireValue("SUPABASE_URL");
  const serviceRole = requireValue("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && !validServiceOrigin(supabaseUrl)) errors.push("SUPABASE_URL must be an exact production HTTPS origin without credentials, port, path, query, or fragment.");
  if (serviceRole && !validSecretReference(env.SUPABASE_SERVICE_ROLE_KEY)) errors.push("SUPABASE_SERVICE_ROLE_KEY must be a bounded injected reference without whitespace or control characters.");
  if (typeof env.BACKUP_MAX_AGE_HOURS !== "string" || !/^\d+$/.test(env.BACKUP_MAX_AGE_HOURS) || !wholeNumber(env.BACKUP_MAX_AGE_HOURS, 1, 72)) errors.push("BACKUP_MAX_AGE_HOURS must be a whole number between 1 and 72.");
  if (typeof env.BACKUP_RESTORE_MAX_AGE_DAYS !== "string" || !/^\d+$/.test(env.BACKUP_RESTORE_MAX_AGE_DAYS) || !wholeNumber(env.BACKUP_RESTORE_MAX_AGE_DAYS, 1, 365)) errors.push("BACKUP_RESTORE_MAX_AGE_DAYS must be a whole number between 1 and 365.");
  if (typeof env.OPERATIONS_BACKUP_ATTESTATION_RETENTION_DAYS !== "string" || !/^\d+$/.test(env.OPERATIONS_BACKUP_ATTESTATION_RETENTION_DAYS) || !wholeNumber(env.OPERATIONS_BACKUP_ATTESTATION_RETENTION_DAYS, 1, 3650)) errors.push("OPERATIONS_BACKUP_ATTESTATION_RETENTION_DAYS must be a whole number between 1 and 3650.");
  if (typeof env.OPERATIONS_ANTI_AGING_RETENTION_DAYS !== "string" || !/^\d+$/.test(env.OPERATIONS_ANTI_AGING_RETENTION_DAYS) || !wholeNumber(env.OPERATIONS_ANTI_AGING_RETENTION_DAYS, 30, 3650)) errors.push("OPERATIONS_ANTI_AGING_RETENTION_DAYS must be a whole number between 30 and 3650.");

  const delivery = String(env.NOTIFICATION_DELIVERY || "");
  if (!["in_app", "webhook"].includes(delivery)) errors.push("NOTIFICATION_DELIVERY must be in_app or webhook.");
  if (delivery === "webhook") {
    if (!validControlUrl(env.NOTIFICATION_WEBHOOK_URL)) errors.push("NOTIFICATION_WEBHOOK_URL must be HTTPS without embedded credentials for webhook delivery.");
    const token = requireValue("NOTIFICATION_WEBHOOK_TOKEN");
    if (token && !validSecretReference(env.NOTIFICATION_WEBHOOK_TOKEN)) errors.push("NOTIFICATION_WEBHOOK_TOKEN must be a bounded injected reference without whitespace or control characters.");
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(env.NOTIFICATION_WEBHOOK_KEY_ID || "")) errors.push("NOTIFICATION_WEBHOOK_KEY_ID must identify the active signing key using letters, numbers, underscores or hyphens.");
    if (env.NOTIFICATION_WEBHOOK_TIMEOUT_MS !== undefined && (typeof env.NOTIFICATION_WEBHOOK_TIMEOUT_MS !== "string" || !/^\d+$/.test(env.NOTIFICATION_WEBHOOK_TIMEOUT_MS) || !wholeNumber(env.NOTIFICATION_WEBHOOK_TIMEOUT_MS, 1000, 30000))) errors.push("NOTIFICATION_WEBHOOK_TIMEOUT_MS must be a whole number between 1000 and 30000.");
  }
  for (const [key, minimum, maximum] of [["NOTIFICATION_RETRY_COOLDOWN_SECONDS", 10, 3600], ["NOTIFICATION_MAX_RETRY_DELAY_SECONDS", 10, 86400], ["NOTIFICATION_MAX_ATTEMPTS", 1, 20], ["OPERATIONS_NOTIFICATION_RETENTION_DAYS", 1, 3650]]) if (typeof env[key] !== "string" || !/^\d+$/.test(env[key]) || !wholeNumber(env[key], minimum, maximum)) errors.push(`${key} must be a whole number within its production range.`);
  if (wholeNumber(env.NOTIFICATION_RETRY_COOLDOWN_SECONDS, 10, 3600) && wholeNumber(env.NOTIFICATION_MAX_RETRY_DELAY_SECONDS, 10, 86400) && Number(env.NOTIFICATION_MAX_RETRY_DELAY_SECONDS) < Number(env.NOTIFICATION_RETRY_COOLDOWN_SECONDS)) errors.push("NOTIFICATION_MAX_RETRY_DELAY_SECONDS must be at least NOTIFICATION_RETRY_COOLDOWN_SECONDS.");

  for (const [key, validator, message] of [
    ["SUPPORT_OWNER_EMAIL", validEmail, "SUPPORT_OWNER_EMAIL must be a valid production support owner email."],
    ["MONITORING_DASHBOARD_URL", validControlUrl, "MONITORING_DASHBOARD_URL must be a production HTTPS URL without embedded credentials."],
    ["INCIDENT_RUNBOOK_URL", validControlUrl, "INCIDENT_RUNBOOK_URL must be a production HTTPS URL without embedded credentials."],
    ["ALERT_OWNER_EMAIL", validEmail, "ALERT_OWNER_EMAIL must identify the production alert owner."],
    ["OPERATIONS_ALERT_WEBHOOK_URL", validControlUrl, "OPERATIONS_ALERT_WEBHOOK_URL must be a production HTTPS URL without embedded credentials."]
  ]) { const value = requireValue(key); if (value && !validator(value)) errors.push(message); }
  if (typeof env.SUPPORT_RESPONSE_TARGET_HOURS !== "string" || !/^\d+$/.test(env.SUPPORT_RESPONSE_TARGET_HOURS) || !wholeNumber(env.SUPPORT_RESPONSE_TARGET_HOURS, 1, 168)) errors.push("SUPPORT_RESPONSE_TARGET_HOURS must be a whole number between 1 and 168.");
  if (env.OPERATIONS_ALERT_DELIVERY !== "webhook") errors.push("OPERATIONS_ALERT_DELIVERY must be webhook in production.");
  const alertToken = requireValue("OPERATIONS_ALERT_WEBHOOK_TOKEN");
  if (alertToken && !validSecretReference(env.OPERATIONS_ALERT_WEBHOOK_TOKEN)) errors.push("OPERATIONS_ALERT_WEBHOOK_TOKEN must be a bounded injected reference without whitespace or control characters.");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(env.OPERATIONS_ALERT_KEY_ID || "")) errors.push("OPERATIONS_ALERT_KEY_ID must identify the active signing key using letters, numbers, underscores or hyphens.");
  const operationRanges = [["OPERATIONS_ALERT_TIMEOUT_MS", 1000, 30000], ["OPERATIONS_ALERT_LEASE_SECONDS", 10, 600], ["OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS", 10, 3600], ["OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS", 10, 86400], ["OPERATIONS_ALERT_MAX_ATTEMPTS", 1, 20], ["OPERATIONS_ALERT_EVENT_RETENTION_DAYS", 1, 3650], ["OPERATIONS_FOLLOW_UP_OVERDUE_GRACE_SECONDS", 60, 86400], ["OPERATIONS_FOLLOW_UP_RETRY_DELAY_SECONDS", 10, 86400], ["OPERATIONS_FOLLOW_UP_MAX_ATTEMPTS", 1, 20], ["OPERATIONS_FOLLOW_UP_RETENTION_DAYS", 30, 3650], ["OPERATIONS_AI_LOG_RETENTION_DAYS", 1, 3650], ["OPERATIONS_BILLING_RETENTION_DAYS", 30, 3650], ["OPERATIONS_WEBHOOK_RECEIPT_RETENTION_DAYS", 7, 3650], ["OPERATIONS_AGGREGATE_METRIC_RETENTION_DAYS", 30, 3650], ["OPERATIONS_DELETION_PROOF_RETENTION_DAYS", 30, 3650], ["OPERATIONS_RUN_RETENTION_DAYS", 1, 3650]];
  for (const [key, minimum, maximum] of operationRanges) if (typeof env[key] !== "string" || !/^\d+$/.test(env[key]) || !wholeNumber(env[key], minimum, maximum)) errors.push(`${key} must be a whole number within its production range.`);
  if (wholeNumber(env.OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS, 10, 3600) && wholeNumber(env.OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS, 10, 86400) && Number(env.OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS) < Number(env.OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS)) errors.push("OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS must be at least OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS.");
  if (wholeNumber(env.OPERATIONS_ALERT_TIMEOUT_MS, 1000, 30000) && wholeNumber(env.OPERATIONS_ALERT_LEASE_SECONDS, 10, 600) && Number(env.OPERATIONS_ALERT_LEASE_SECONDS) * 1000 < Number(env.OPERATIONS_ALERT_TIMEOUT_MS) + 5000) errors.push("OPERATIONS_ALERT_LEASE_SECONDS must exceed OPERATIONS_ALERT_TIMEOUT_MS by at least five seconds.");
  const populated = (keys) => keys.some((key) => env[key] !== undefined && env[key] !== "");
  if (delivery === "in_app" && populated(["NOTIFICATION_WEBHOOK_URL", "NOTIFICATION_WEBHOOK_TOKEN", "NOTIFICATION_WEBHOOK_KEY_ID", "NOTIFICATION_WEBHOOK_TIMEOUT_MS"])) errors.push("Disabled customer webhook delivery must not retain webhook configuration.");
}

export function validateRuntimeEnvironment(env, role) {
  if (role !== "api" && role !== "worker") return { ok: false, errors: ["PROCESS_ROLE must be api or worker for runtime preflight."], warnings: [] };
  const context = runtimeContext(env);
  if (role === "api") validateApiRuntimeEnvironment(context);
  else validateWorkerRuntimeEnvironment(context);
  return { ok: context.errors.length === 0, errors: context.errors, warnings: context.warnings };
}

export function validatePreflightEnvironment(env) {
  if (env.PROCESS_ROLE === undefined || env.PROCESS_ROLE === "deployment") return validateEnvironment(env);
  return validateRuntimeEnvironment(env, env.PROCESS_ROLE);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = validatePreflightEnvironment(process.env);
  console.log(`MGT portal production preflight${process.env.PROCESS_ROLE ? ` (${process.env.PROCESS_ROLE})` : ""}`);
  for (const warning of result.warnings) console.log(`WARN  ${warning}`);
  for (const error of result.errors) console.error(`ERROR ${error}`);
  console.log(result.ok ? "PASS  Environment is ready for build/deployment checks." : `FAIL  ${result.errors.length} blocking configuration issue(s).`);
  process.exitCode = result.ok ? 0 : 1;
}
