// Validates the *shape* of the private files supplied to production Compose.
// It deliberately reads only environment-variable names from secret files and
// emits no file path or value.  Secret resolution remains the responsibility
// of the approved secret manager and this repository never authenticates to it.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  SECRET_INJECTION_VARIABLES,
  isSecretLikeValue,
  validateSecretInjectionContractPair
} from "./secret-injection-contract.mjs";

export const SECRET_INJECTION_ADMISSION_VERSION = "1.0";
export const RUNTIME_INPUT_CONSUMERS = Object.freeze(["edge", "api", "worker"]);

// These are configuration names, never values.  The sets intentionally model
// only the process that consumes them; deployment image references and Compose
// project controls stay in the separate non-secret deployment-control input.
export const RUNTIME_CONFIG_VARIABLES = Object.freeze({
  edge: Object.freeze(["PORTAL_DOMAIN"]),
  api: Object.freeze([
    "NODE_ENV", "DEMO_MODE", "PUBLIC_ORIGIN", "PORTAL_DOMAIN", "PORTAL_AUTO_MIGRATE", "HOST", "PORT",
    "WORKER_INTERVAL_SECONDS", "WORKER_READINESS_MAX_AGE_SECONDS", "SUPABASE_URL", "SUPABASE_GOOGLE_OAUTH_ENABLED",
    "OLLAMA_ENABLED", "OLLAMA_BASE_URL", "OPENCLAW_ENABLED", "OPENCLAW_BASE_URL", "OPENCLAW_API_MODE", "HOSTED_OPENAI_ENABLED",
    "BACKUP_ATTESTATION_ENABLED", "BACKUP_ATTESTATION_KEY_ID", "BACKUP_ATTESTATION_MAX_AGE_SECONDS",
    "ANTI_AGING_LIVE_AI", "ANTI_AGING_CHECKOUT_ENABLED", "ANTI_AGING_BOOKING_ENABLED", "ANTI_AGING_IMAGE_ANALYSIS_ENABLED",
    "ANTI_AGING_ACCESSIBILITY_VERIFIED", "ANTI_AGING_RESTORE_VERIFIED", "ANTI_AGING_PRIVACY_REVIEWED",
    "SUBSCRIPTIONS_ENABLED", "SUBSCRIPTION_TERMS_APPROVED", "STRIPE_LIVE_MODE", "STRIPE_PREMIUM_PRODUCT_ID",
    "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_ANNUAL_PRICE_ID", "STRIPE_STUDIO_MONTHLY_PRICE_ID", "STRIPE_STUDIO_ANNUAL_PRICE_ID",
    "STRIPE_USAGE_BILLING_ENABLED", "STRIPE_API_METER_EVENT_NAME", "STRIPE_B2B_INVOICING_ENABLED", "ACCESSIBILITY_VALIDATION_REPORT_URL",
    "ACCESSIBILITY_VALIDATED_AT", "MGT_OMNI_RETAIL_ENABLED", "MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED",
    "MGT_SPONSORED_CONTENT_ENABLED", "MGT_SPONSORED_CONTENT_REVIEWED", "MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE",
    "MGT_SPONSORED_CONTENT_APPROVED_AT", "RELEASE_OWNER_NAME", "SUPPORT_OWNER_NAME"
  ]),
  worker: Object.freeze([
    "NODE_ENV", "DEMO_MODE", "PORTAL_AUTO_MIGRATE", "WORKER_INTERVAL_SECONDS", "WORKER_READINESS_MAX_AGE_SECONDS",
    "WORKER_HEALTH_FILE", "SUPABASE_URL", "BACKUP_MAX_AGE_HOURS", "BACKUP_RESTORE_MAX_AGE_DAYS",
    "OPERATIONS_BACKUP_ATTESTATION_RETENTION_DAYS", "OPERATIONS_ANTI_AGING_RETENTION_DAYS", "NOTIFICATION_DELIVERY",
    "NOTIFICATION_WEBHOOK_URL", "NOTIFICATION_WEBHOOK_KEY_ID", "NOTIFICATION_WEBHOOK_TIMEOUT_MS",
    "NOTIFICATION_RETRY_COOLDOWN_SECONDS", "NOTIFICATION_MAX_RETRY_DELAY_SECONDS", "NOTIFICATION_MAX_ATTEMPTS",
    "OPERATIONS_NOTIFICATION_RETENTION_DAYS", "RELEASE_OWNER_NAME", "SUPPORT_OWNER_NAME", "SUPPORT_OWNER_EMAIL",
    "MONITORING_DASHBOARD_URL", "INCIDENT_RUNBOOK_URL", "ALERT_OWNER_EMAIL", "SUPPORT_RESPONSE_TARGET_HOURS",
    "OPERATIONS_ALERT_DELIVERY", "OPERATIONS_ALERT_WEBHOOK_URL", "OPERATIONS_ALERT_KEY_ID", "OPERATIONS_ALERT_TIMEOUT_MS",
    "OPERATIONS_ALERT_LEASE_SECONDS", "OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS", "OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS",
    "OPERATIONS_ALERT_MAX_ATTEMPTS", "OPERATIONS_ALERT_EVENT_RETENTION_DAYS", "OPERATIONS_FOLLOW_UP_OVERDUE_GRACE_SECONDS",
    "OPERATIONS_FOLLOW_UP_RETRY_DELAY_SECONDS", "OPERATIONS_FOLLOW_UP_MAX_ATTEMPTS", "OPERATIONS_FOLLOW_UP_RETENTION_DAYS",
    "OPERATIONS_AI_LOG_RETENTION_DAYS", "OPERATIONS_BILLING_RETENTION_DAYS", "OPERATIONS_WEBHOOK_RECEIPT_RETENTION_DAYS",
    "OPERATIONS_AGGREGATE_METRIC_RETENTION_DAYS", "OPERATIONS_DELETION_PROOF_RETENTION_DAYS", "OPERATIONS_RUN_RETENTION_DAYS"
  ])
});

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const ENVIRONMENT = new Set(["staging", "production"]);
const ASSIGNMENT = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/;
const MAX_PRIVATE_INPUT_BYTES = 1024 * 1024;
const ALL_SECRET_VARIABLES = new Set(Object.values(SECRET_INJECTION_VARIABLES).flat());
const FORBIDDEN_CONFIGURATION_NAME = /(?:SECRET|TOKEN|PASSWORD|PRIVATE|DATABASE_URL|API_KEY|CLIENT_SECRET|REFRESH)/;
const ADMISSION_FIELDS = Object.freeze([
  "version", "generated_at", "environment", "candidate_commit", "compose_project_name", "status",
  "contract_checksums", "private_file_security", "feature_posture", "workloads", "errors", "admission_checksum"
]);
const API_FEATURE_POSTURE_FIELDS = Object.freeze([
  "ollama_enabled", "openclaw_enabled", "openclaw_api_mode", "hosted_openai_enabled", "backup_attestation_enabled", "subscriptions_enabled",
  "omni_retail_enabled", "retail_partner_authorization_reviewed", "sponsored_content_enabled", "sponsored_content_reviewed"
]);
const WORKER_FEATURE_POSTURE_FIELDS = Object.freeze(["notification_delivery"]);

export const REQUIRED_CONFIG_VARIABLES = Object.freeze({
  edge: Object.freeze(["PORTAL_DOMAIN"]),
  api: Object.freeze([
    "NODE_ENV", "DEMO_MODE", "PUBLIC_ORIGIN", "PORTAL_DOMAIN", "PORTAL_AUTO_MIGRATE", "HOST", "PORT",
    "WORKER_INTERVAL_SECONDS", "WORKER_READINESS_MAX_AGE_SECONDS", "SUPABASE_URL", "SUPABASE_GOOGLE_OAUTH_ENABLED",
    "OLLAMA_ENABLED", "OPENCLAW_ENABLED", "HOSTED_OPENAI_ENABLED", "BACKUP_ATTESTATION_ENABLED", "ANTI_AGING_LIVE_AI",
    "ANTI_AGING_CHECKOUT_ENABLED", "ANTI_AGING_BOOKING_ENABLED", "ANTI_AGING_IMAGE_ANALYSIS_ENABLED",
    "ANTI_AGING_ACCESSIBILITY_VERIFIED", "ANTI_AGING_RESTORE_VERIFIED", "ANTI_AGING_PRIVACY_REVIEWED",
    "SUBSCRIPTIONS_ENABLED", "MGT_OMNI_RETAIL_ENABLED", "MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED",
    "MGT_SPONSORED_CONTENT_ENABLED", "MGT_SPONSORED_CONTENT_REVIEWED", "ACCESSIBILITY_VALIDATION_REPORT_URL", "ACCESSIBILITY_VALIDATED_AT",
    "RELEASE_OWNER_NAME", "SUPPORT_OWNER_NAME"
  ]),
  worker: Object.freeze([
    "NODE_ENV", "DEMO_MODE", "PORTAL_AUTO_MIGRATE", "WORKER_INTERVAL_SECONDS", "WORKER_READINESS_MAX_AGE_SECONDS",
    "WORKER_HEALTH_FILE", "SUPABASE_URL", "BACKUP_MAX_AGE_HOURS", "BACKUP_RESTORE_MAX_AGE_DAYS",
    "OPERATIONS_BACKUP_ATTESTATION_RETENTION_DAYS", "OPERATIONS_ANTI_AGING_RETENTION_DAYS", "NOTIFICATION_DELIVERY",
    "NOTIFICATION_RETRY_COOLDOWN_SECONDS", "NOTIFICATION_MAX_RETRY_DELAY_SECONDS", "NOTIFICATION_MAX_ATTEMPTS",
    "OPERATIONS_NOTIFICATION_RETENTION_DAYS", "RELEASE_OWNER_NAME", "SUPPORT_OWNER_NAME", "SUPPORT_OWNER_EMAIL",
    "MONITORING_DASHBOARD_URL", "INCIDENT_RUNBOOK_URL", "ALERT_OWNER_EMAIL", "SUPPORT_RESPONSE_TARGET_HOURS",
    "OPERATIONS_ALERT_DELIVERY", "OPERATIONS_ALERT_WEBHOOK_URL", "OPERATIONS_ALERT_KEY_ID", "OPERATIONS_ALERT_TIMEOUT_MS",
    "OPERATIONS_ALERT_LEASE_SECONDS", "OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS", "OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS",
    "OPERATIONS_ALERT_MAX_ATTEMPTS", "OPERATIONS_ALERT_EVENT_RETENTION_DAYS", "OPERATIONS_FOLLOW_UP_OVERDUE_GRACE_SECONDS",
    "OPERATIONS_FOLLOW_UP_RETRY_DELAY_SECONDS", "OPERATIONS_FOLLOW_UP_MAX_ATTEMPTS", "OPERATIONS_FOLLOW_UP_RETENTION_DAYS",
    "OPERATIONS_AI_LOG_RETENTION_DAYS", "OPERATIONS_BILLING_RETENTION_DAYS", "OPERATIONS_WEBHOOK_RECEIPT_RETENTION_DAYS",
    "OPERATIONS_AGGREGATE_METRIC_RETENTION_DAYS", "OPERATIONS_DELETION_PROOF_RETENTION_DAYS", "OPERATIONS_RUN_RETENTION_DAYS"
  ])
});

function text(value) {
  return String(value || "").trim();
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function exactObjectKeys(object, keys) {
  return Boolean(object) && typeof object === "object" && !Array.isArray(object)
    && Object.keys(object).length === keys.length && keys.every((key) => own(object, key));
}

function sortedUnique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === "string"))].sort();
}

function exactArray(value, expected) {
  const actual = sortedUnique(value);
  return Array.isArray(value)
    && actual.length === value.length
    && actual.length === expected.length
    && value.every((entry, index) => entry === expected[index]);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function checksum(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex")}`;
}

function expectedComposeProjectName(environment) {
  return ENVIRONMENT.has(environment) ? `mgt-skin-care-${environment}` : "";
}

export function secretInjectionAdmissionChecksum(document) {
  const { admission_checksum: _ignored, ...unsigned } = document || {};
  return checksum(unsigned);
}

function validContractChecksums(value) {
  return exactObjectKeys(value, ["staging", "production"])
    && CHECKSUM.test(text(value.staging)) && CHECKSUM.test(text(value.production));
}

function requiredSecrets(consumer, config) {
  if (consumer === "edge") return ["MGT_EDGE_TOKEN"];
  if (consumer === "api") {
    const required = ["DATABASE_URL", "MGT_EDGE_TOKEN", "SUPABASE_ANON_KEY"];
    if (config.BACKUP_ATTESTATION_ENABLED === "true") required.push("BACKUP_ATTESTATION_SECRET");
    if (config.SUBSCRIPTIONS_ENABLED === "true") required.push("STRIPE_SECRET_KEY", "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET");
    if (config.OPENCLAW_ENABLED === "true" && config.OPENCLAW_API_MODE === "openai-completions") required.push("OPENCLAW_API_KEY");
    if (config.HOSTED_OPENAI_ENABLED === "true") required.push("OPENAI_API_KEY");
    return required;
  }
  const required = ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPERATIONS_ALERT_WEBHOOK_TOKEN"];
  if (config.NOTIFICATION_DELIVERY === "webhook") required.push("NOTIFICATION_WEBHOOK_TOKEN");
  return required;
}

function allowedSecrets(consumer, config) {
  return [...new Set(requiredSecrets(consumer, config))].sort();
}

function conditionalConfigurationErrors(consumer, config, errors) {
  const require = (names) => {
    for (const name of names) if (!own(config, name) || text(config[name]) === "") errors.push(`${consumer} configuration must include ${name} when its feature is enabled`);
  };
  if (consumer === "api") {
    for (const name of ["OLLAMA_ENABLED", "OPENCLAW_ENABLED", "HOSTED_OPENAI_ENABLED", "BACKUP_ATTESTATION_ENABLED", "SUBSCRIPTIONS_ENABLED", "MGT_OMNI_RETAIL_ENABLED", "MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED", "MGT_SPONSORED_CONTENT_ENABLED", "MGT_SPONSORED_CONTENT_REVIEWED"]) {
      if (!["true", "false"].includes(config[name])) errors.push(`${consumer} configuration must declare ${name} as true or false`);
    }
    if (config.OLLAMA_ENABLED === "true") require(["OLLAMA_BASE_URL"]);
    if (config.OLLAMA_ENABLED === "false" && own(config, "OLLAMA_BASE_URL")) errors.push(`${consumer} configuration retains disabled Ollama configuration`);
    if (config.OPENCLAW_ENABLED === "true") require(["OPENCLAW_BASE_URL", "OPENCLAW_API_MODE"]);
    if (config.OPENCLAW_ENABLED === "true" && !["ollama", "openai-completions"].includes(config.OPENCLAW_API_MODE)) errors.push(`${consumer} configuration must declare a supported OpenClaw mode`);
    if (config.OPENCLAW_ENABLED === "false" && ["OPENCLAW_BASE_URL", "OPENCLAW_API_MODE"].some((name) => own(config, name))) errors.push(`${consumer} configuration retains disabled OpenClaw configuration`);
    if (config.BACKUP_ATTESTATION_ENABLED === "true") require(["BACKUP_ATTESTATION_KEY_ID", "BACKUP_ATTESTATION_MAX_AGE_SECONDS"]);
    if (config.BACKUP_ATTESTATION_ENABLED === "false" && ["BACKUP_ATTESTATION_KEY_ID", "BACKUP_ATTESTATION_MAX_AGE_SECONDS"].some((name) => own(config, name))) errors.push(`${consumer} configuration retains disabled backup-attestation configuration`);
    if (config.SUBSCRIPTIONS_ENABLED === "true") require(["SUBSCRIPTION_TERMS_APPROVED", "STRIPE_LIVE_MODE", "STRIPE_PREMIUM_PRODUCT_ID", "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_ANNUAL_PRICE_ID"]);
    if ((own(config, "STRIPE_STUDIO_MONTHLY_PRICE_ID") || own(config, "STRIPE_STUDIO_ANNUAL_PRICE_ID")) && !(own(config, "STRIPE_STUDIO_MONTHLY_PRICE_ID") && own(config, "STRIPE_STUDIO_ANNUAL_PRICE_ID"))) errors.push(`${consumer} configuration must provide both Studio price IDs together`);
    if (config.SUBSCRIPTIONS_ENABLED === "false" && ["SUBSCRIPTION_TERMS_APPROVED", "STRIPE_LIVE_MODE", "STRIPE_PREMIUM_PRODUCT_ID", "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_ANNUAL_PRICE_ID", "STRIPE_STUDIO_MONTHLY_PRICE_ID", "STRIPE_STUDIO_ANNUAL_PRICE_ID"].some((name) => own(config, name))) errors.push(`${consumer} configuration retains disabled subscription configuration`);
    if (config.MGT_SPONSORED_CONTENT_ENABLED === "true") {
      require(["MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE", "MGT_SPONSORED_CONTENT_APPROVED_AT"]);
      if (config.MGT_SPONSORED_CONTENT_REVIEWED !== "true" || config.MGT_OMNI_RETAIL_ENABLED !== "true" || config.MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED !== "true") errors.push(`${consumer} configuration must retain approved merchant and review controls when sponsored content is enabled`);
    }
    if (config.MGT_SPONSORED_CONTENT_ENABLED === "false") {
      if (config.MGT_SPONSORED_CONTENT_REVIEWED !== "false") errors.push(`${consumer} configuration retains a sponsored-content review while disabled`);
      if (["MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE", "MGT_SPONSORED_CONTENT_APPROVED_AT"].some((name) => own(config, name))) errors.push(`${consumer} configuration retains disabled sponsored-content approval configuration`);
    }
  }
  if (consumer === "worker" && config.NOTIFICATION_DELIVERY === "webhook") require(["NOTIFICATION_WEBHOOK_URL", "NOTIFICATION_WEBHOOK_KEY_ID", "NOTIFICATION_WEBHOOK_TIMEOUT_MS"]);
}

function safeContractChecksum(contract) {
  return checksum(contract);
}

function featurePosture(inventories = {}) {
  const api = configInventory(inventories.api).values;
  const worker = configInventory(inventories.worker).values;
  return {
    api: {
      ollama_enabled: text(api.OLLAMA_ENABLED),
      openclaw_enabled: text(api.OPENCLAW_ENABLED),
      openclaw_api_mode: text(api.OPENCLAW_API_MODE),
      hosted_openai_enabled: text(api.HOSTED_OPENAI_ENABLED),
      backup_attestation_enabled: text(api.BACKUP_ATTESTATION_ENABLED),
      subscriptions_enabled: text(api.SUBSCRIPTIONS_ENABLED),
      omni_retail_enabled: text(api.MGT_OMNI_RETAIL_ENABLED),
      retail_partner_authorization_reviewed: text(api.MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED),
      sponsored_content_enabled: text(api.MGT_SPONSORED_CONTENT_ENABLED),
      sponsored_content_reviewed: text(api.MGT_SPONSORED_CONTENT_REVIEWED)
    },
    worker: {
      notification_delivery: text(worker.NOTIFICATION_DELIVERY)
    }
  };
}

function configInventory(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { values: {}, keys: [] };
  const values = input.config_values && typeof input.config_values === "object" && !Array.isArray(input.config_values)
    ? input.config_values
    : input.config && typeof input.config === "object" && !Array.isArray(input.config)
      ? input.config
      : {};
  const listed = Array.isArray(input.config_keys) ? input.config_keys : Object.keys(values);
  return { values, keys: sortedUnique(listed), valueKeys: sortedUnique(Object.keys(values)) };
}

function secretInventory(input) {
  return sortedUnique(input?.secret_keys);
}

function validateConsumer({ consumer, assignment, contract, errors }) {
  const { values: config, keys: configKeys, valueKeys } = configInventory(assignment);
  const secretKeys = secretInventory(assignment);
  const allowedConfig = new Set(RUNTIME_CONFIG_VARIABLES[consumer]);
  const expectedConfig = REQUIRED_CONFIG_VARIABLES[consumer];
  const allowedSecret = new Set(allowedSecrets(consumer, config));
  const requiredSecret = requiredSecrets(consumer, config);
  const references = contract?.consumer_assignments?.[consumer]?.secret_references || {};

  if (configKeys.length !== (Array.isArray(assignment?.config_keys) ? assignment.config_keys.length : Object.keys(config).length)) errors.push(`${consumer} configuration contains duplicate variable names`);
  if (configKeys.length !== valueKeys.length || configKeys.some((name, index) => name !== valueKeys[index])) errors.push(`${consumer} configuration inventory does not match its private input`);
  if (secretKeys.length !== (Array.isArray(assignment?.secret_keys) ? assignment.secret_keys.length : 0)) errors.push(`${consumer} secret materialization contains duplicate variable names`);
  for (const name of configKeys) {
    if (!allowedConfig.has(name)) errors.push(`${consumer} configuration contains an unassigned variable`);
    if (ALL_SECRET_VARIABLES.has(name) || FORBIDDEN_CONFIGURATION_NAME.test(name)) errors.push(`${consumer} configuration contains a secret-like variable`);
  }
  for (const value of Object.values(config)) {
    if (isSecretLikeValue(value)) errors.push(`${consumer} configuration contains a secret-like value`);
  }
  for (const name of secretKeys) {
    if (!SECRET_INJECTION_VARIABLES[consumer].includes(name)) errors.push(`${consumer} secret materialization contains an unassigned variable`);
    if (!allowedSecret.has(name)) errors.push(`${consumer} secret materialization retains a disabled or unapproved secret`);
    if (typeof references[name] !== "string") errors.push(`${consumer} materialized secret is absent from its approved contract`);
  }
  for (const [name, reference] of Object.entries(references)) {
    if (typeof reference === "string" && !allowedSecret.has(name)) errors.push(`${consumer} approved contract retains a disabled or unapproved secret`);
  }
  for (const name of expectedConfig) if (!configKeys.includes(name)) errors.push(`${consumer} configuration is missing a required runtime control`);
  for (const name of requiredSecret) if (!secretKeys.includes(name)) errors.push(`${consumer} secret materialization is missing a required secret`);
  for (const name of secretKeys) if (configKeys.includes(name)) errors.push(`${consumer} config and secret inputs overlap`);
  conditionalConfigurationErrors(consumer, config, errors);
}

function validateCrossConsumerSecretUse(inventories, errors) {
  const consumersForName = new Map();
  for (const consumer of RUNTIME_INPUT_CONSUMERS) {
    for (const name of secretInventory(inventories?.[consumer])) {
      const consumers = consumersForName.get(name) || [];
      consumers.push(consumer);
      consumersForName.set(name, consumers);
    }
  }
  for (const [name, consumers] of consumersForName) {
    const allowed = name === "DATABASE_URL" ? ["api", "worker"] : name === "MGT_EDGE_TOKEN" ? ["edge", "api"] : [];
    if (consumers.length > 1 && (consumers.length !== allowed.length || consumers.some((consumer) => !allowed.includes(consumer)))) errors.push("a secret variable may not be materialized for unrelated workloads");
  }
}

/**
 * Build a redacted, candidate-bound admission report. `inventories` contains
 * only the names read from private files; no secret value is accepted or
 * serialized by this function.
 */
export function buildSecretInjectionAdmission({ environment, candidateCommit, stagingContract, productionContract, inventories = {}, composeProjectName = "", privateFilesDistinct = true, fileSecurity = "provider_acl_required", generatedAt = new Date().toISOString() } = {}) {
  const errors = [];
  if (!ENVIRONMENT.has(environment)) errors.push("environment must be staging or production");
  if (!SHA.test(text(candidateCommit))) errors.push("candidate_commit must be a commit SHA");
  const pair = validateSecretInjectionContractPair({ staging: stagingContract, production: productionContract });
  if (!pair.ok) errors.push("staging and production secret-injection contracts are invalid or not isolated");
  const targetContract = environment === "staging" ? stagingContract : productionContract;
  if (text(targetContract?.candidate_commit) !== text(candidateCommit)) errors.push("target secret-injection contract must bind the candidate commit");
  if (targetContract?.environment !== environment) errors.push("target secret-injection contract must match the admitted environment");
  if (text(composeProjectName) !== expectedComposeProjectName(environment)) errors.push("Compose project name must be the approved stage-scoped identifier");
  if (!privateFilesDistinct) errors.push("runtime configuration and secret materialization files must remain six distinct private files");
  if (!["verified", "provider_acl_required"].includes(fileSecurity)) errors.push("private runtime input security state must be known");

  for (const consumer of RUNTIME_INPUT_CONSUMERS) validateConsumer({ consumer, assignment: inventories[consumer], contract: targetContract, errors });
  validateCrossConsumerSecretUse(inventories, errors);

  const document = {
    version: SECRET_INJECTION_ADMISSION_VERSION,
    generated_at: new Date(generatedAt).toISOString(),
    environment: ENVIRONMENT.has(environment) ? environment : null,
    candidate_commit: SHA.test(text(candidateCommit)) ? text(candidateCommit) : null,
    compose_project_name: text(composeProjectName),
    status: errors.length ? "blocked" : "pass",
    contract_checksums: {
      staging: stagingContract && typeof stagingContract === "object" ? safeContractChecksum(stagingContract) : null,
      production: productionContract && typeof productionContract === "object" ? safeContractChecksum(productionContract) : null
    },
    private_file_security: fileSecurity,
    feature_posture: featurePosture(inventories),
    workloads: Object.fromEntries(RUNTIME_INPUT_CONSUMERS.map((consumer) => {
      const inventory = configInventory(inventories[consumer]);
      return [consumer, {
        config_variables: inventory.keys,
        secret_variables: secretInventory(inventories[consumer])
      }];
    })),
    errors: [...new Set(errors)]
  };
  return { ...document, admission_checksum: secretInjectionAdmissionChecksum(document) };
}

export function validateSecretInjectionAdmission(document, { environment, candidateCommit, expectedContractChecksums, requirePass = true } = {}) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["secret-injection admission must be an object"] };
  if (!exactObjectKeys(document, ADMISSION_FIELDS)) errors.push("secret-injection admission must retain its exact redacted field set");
  if (document.version !== SECRET_INJECTION_ADMISSION_VERSION) errors.push(`secret-injection admission version must be ${SECRET_INJECTION_ADMISSION_VERSION}`);
  if (!Number.isFinite(Date.parse(text(document.generated_at))) || Date.parse(text(document.generated_at)) > Date.now()) errors.push("secret-injection admission generated_at must be a past ISO timestamp");
  if (!ENVIRONMENT.has(document.environment)) errors.push("secret-injection admission environment must be staging or production");
  if (environment && document.environment !== environment) errors.push("secret-injection admission environment does not match the evidence context");
  if (!SHA.test(text(document.candidate_commit))) errors.push("secret-injection admission candidate_commit must be a commit SHA");
  if (candidateCommit && text(document.candidate_commit) !== text(candidateCommit)) errors.push("secret-injection admission candidate_commit does not match the evidence context");
  if (text(document.compose_project_name) !== expectedComposeProjectName(document.environment)) errors.push("secret-injection admission must retain the approved stage-scoped Compose project name");
  if (!validContractChecksums(document.contract_checksums)) errors.push("secret-injection admission must retain both contract checksums");
  if (expectedContractChecksums !== undefined) {
    if (!validContractChecksums(expectedContractChecksums)) errors.push("expected secret-injection contract checksums must be complete");
    else if (text(document.contract_checksums?.staging) !== text(expectedContractChecksums.staging) || text(document.contract_checksums?.production) !== text(expectedContractChecksums.production)) errors.push("secret-injection admission contract checksums do not match the approved contract pair");
  }
  if (!["verified", "provider_acl_required"].includes(document.private_file_security)) errors.push("secret-injection admission private file security state must be known");
  const posture = document.feature_posture;
  const validPostureShape = exactObjectKeys(posture, ["api", "worker"])
    && exactObjectKeys(posture?.api, API_FEATURE_POSTURE_FIELDS)
    && exactObjectKeys(posture?.worker, WORKER_FEATURE_POSTURE_FIELDS);
  if (!validPostureShape) errors.push("secret-injection admission must retain its complete feature posture");
  if (validPostureShape) {
    for (const name of ["ollama_enabled", "openclaw_enabled", "hosted_openai_enabled", "backup_attestation_enabled", "subscriptions_enabled", "omni_retail_enabled", "retail_partner_authorization_reviewed", "sponsored_content_enabled", "sponsored_content_reviewed"]) {
      if (!["true", "false"].includes(posture.api[name])) errors.push("secret-injection admission feature posture contains an invalid API toggle");
    }
    if (posture.api.openclaw_enabled === "true" && !["ollama", "openai-completions"].includes(posture.api.openclaw_api_mode)) errors.push("secret-injection admission feature posture requires a valid OpenClaw mode");
    if (posture.api.openclaw_enabled === "false" && posture.api.openclaw_api_mode !== "") errors.push("secret-injection admission feature posture retains disabled OpenClaw configuration");
    if (!["in_app", "webhook"].includes(posture.worker.notification_delivery)) errors.push("secret-injection admission feature posture contains an invalid notification delivery mode");
  }
  if (!Array.isArray(document.errors) || document.errors.some((entry) => typeof entry !== "string" || isSecretLikeValue(entry))) errors.push("secret-injection admission errors must be a redacted string array");
  if (!["pass", "blocked"].includes(document.status)) errors.push("secret-injection admission status must be known");
  if (requirePass && document.status !== "pass") errors.push("secret-injection admission must be pass");
  if (document.status === "pass" && document.errors?.length) errors.push("passing secret-injection admission cannot contain errors");
  if (!CHECKSUM.test(text(document.admission_checksum)) || text(document.admission_checksum) !== secretInjectionAdmissionChecksum(document)) errors.push("secret-injection admission checksum must match canonical content");
  const workloads = document.workloads;
  if (!workloads || typeof workloads !== "object" || Array.isArray(workloads) || Object.keys(workloads).length !== RUNTIME_INPUT_CONSUMERS.length || RUNTIME_INPUT_CONSUMERS.some((consumer) => !own(workloads, consumer))) errors.push("secret-injection admission must contain exactly edge, api, and worker workloads");
  else for (const consumer of RUNTIME_INPUT_CONSUMERS) {
    const workload = workloads[consumer];
    if (!exactObjectKeys(workload, ["config_variables", "secret_variables"])) { errors.push(`${consumer} workload summary must be a redacted variable inventory`); continue; }
    const configVariables = workload.config_variables;
    const secretVariables = workload.secret_variables;
    if (!Array.isArray(configVariables) || !exactArray(configVariables, sortedUnique(configVariables))) errors.push(`${consumer} config_variables must be a sorted unique list`);
    if (!Array.isArray(secretVariables) || !exactArray(secretVariables, sortedUnique(secretVariables))) errors.push(`${consumer} secret_variables must be a sorted unique list`);
    for (const name of configVariables || []) if (!RUNTIME_CONFIG_VARIABLES[consumer].includes(name) || ALL_SECRET_VARIABLES.has(name) || FORBIDDEN_CONFIGURATION_NAME.test(name)) errors.push(`${consumer} config_variables contain an invalid name`);
    for (const name of secretVariables || []) if (!SECRET_INJECTION_VARIABLES[consumer].includes(name)) errors.push(`${consumer} secret_variables contain an invalid name`);
    for (const name of REQUIRED_CONFIG_VARIABLES[consumer]) if (!(configVariables || []).includes(name)) errors.push(`${consumer} config_variables are missing a required runtime control`);
  }
  if (validPostureShape && workloads?.api && workloads?.worker && workloads?.edge) {
    const api = posture.api;
    const worker = posture.worker;
    const apiFeatureConfig = {
      OLLAMA_ENABLED: api.ollama_enabled,
      OPENCLAW_ENABLED: api.openclaw_enabled,
      OPENCLAW_API_MODE: api.openclaw_api_mode,
      HOSTED_OPENAI_ENABLED: api.hosted_openai_enabled,
      BACKUP_ATTESTATION_ENABLED: api.backup_attestation_enabled,
      SUBSCRIPTIONS_ENABLED: api.subscriptions_enabled,
      MGT_OMNI_RETAIL_ENABLED: api.omni_retail_enabled,
      MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED: api.retail_partner_authorization_reviewed,
      MGT_SPONSORED_CONTENT_ENABLED: api.sponsored_content_enabled,
      MGT_SPONSORED_CONTENT_REVIEWED: api.sponsored_content_reviewed
    };
    const workerFeatureConfig = { NOTIFICATION_DELIVERY: worker.notification_delivery };
    const edgeSecrets = workloads.edge.secret_variables || [];
    const apiConfig = workloads?.api?.config_variables || [];
    const apiSecrets = workloads?.api?.secret_variables || [];
    const workerConfig = workloads?.worker?.config_variables || [];
    const workerSecrets = workloads?.worker?.secret_variables || [];
    const requireSecrets = (consumer, variables, config) => {
      for (const name of requiredSecrets(consumer, config)) if (!variables.includes(name)) errors.push(`${consumer} admission is missing a required secret variable`);
      for (const name of variables) if (!allowedSecrets(consumer, config).includes(name)) errors.push(`${consumer} admission retains a disabled or unapproved secret variable`);
    };
    requireSecrets("edge", edgeSecrets, {});
    requireSecrets("api", apiSecrets, apiFeatureConfig);
    requireSecrets("worker", workerSecrets, workerFeatureConfig);
    if (api.ollama_enabled === "true" && !apiConfig.includes("OLLAMA_BASE_URL")) errors.push("api admission posture requires OLLAMA_BASE_URL");
    if (api.openclaw_enabled === "true" && (!["OPENCLAW_BASE_URL", "OPENCLAW_API_MODE"].every((name) => apiConfig.includes(name)))) errors.push("api admission posture requires OpenClaw configuration");
    if (api.openclaw_enabled === "true" && api.openclaw_api_mode === "openai-completions" && !apiSecrets.includes("OPENCLAW_API_KEY")) errors.push("api admission posture requires OPENCLAW_API_KEY");
    if (api.hosted_openai_enabled === "true" && !apiSecrets.includes("OPENAI_API_KEY")) errors.push("api admission posture requires OPENAI_API_KEY");
    if (api.backup_attestation_enabled === "true" && (!["BACKUP_ATTESTATION_KEY_ID", "BACKUP_ATTESTATION_MAX_AGE_SECONDS"].every((name) => apiConfig.includes(name)) || !apiSecrets.includes("BACKUP_ATTESTATION_SECRET"))) errors.push("api admission posture requires backup-attestation inputs");
    if (api.subscriptions_enabled === "true" && (!["SUBSCRIPTION_TERMS_APPROVED", "STRIPE_LIVE_MODE", "STRIPE_PREMIUM_PRODUCT_ID", "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_ANNUAL_PRICE_ID"].every((name) => apiConfig.includes(name)) || !["STRIPE_SECRET_KEY", "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET"].every((name) => apiSecrets.includes(name)))) errors.push("api admission posture requires subscription inputs");
    if (worker.notification_delivery === "webhook" && (!["NOTIFICATION_WEBHOOK_URL", "NOTIFICATION_WEBHOOK_KEY_ID", "NOTIFICATION_WEBHOOK_TIMEOUT_MS"].every((name) => workerConfig.includes(name)) || !workerSecrets.includes("NOTIFICATION_WEBHOOK_TOKEN"))) errors.push("worker admission posture requires notification-webhook inputs");
    if (api.ollama_enabled === "false" && apiConfig.includes("OLLAMA_BASE_URL")) errors.push("api admission retains disabled Ollama configuration");
    if (api.openclaw_enabled === "false" && (["OPENCLAW_BASE_URL", "OPENCLAW_API_MODE"].some((name) => apiConfig.includes(name)) || apiSecrets.includes("OPENCLAW_API_KEY"))) errors.push("api admission retains disabled OpenClaw configuration");
    if (api.openclaw_enabled === "true" && api.openclaw_api_mode === "ollama" && apiSecrets.includes("OPENCLAW_API_KEY")) errors.push("api admission retains an OpenClaw credential in native Ollama mode");
    if (api.hosted_openai_enabled === "false" && apiSecrets.includes("OPENAI_API_KEY")) errors.push("api admission retains disabled hosted OpenAI configuration");
    if (api.backup_attestation_enabled === "false" && (["BACKUP_ATTESTATION_KEY_ID", "BACKUP_ATTESTATION_MAX_AGE_SECONDS"].some((name) => apiConfig.includes(name)) || apiSecrets.includes("BACKUP_ATTESTATION_SECRET"))) errors.push("api admission retains disabled backup-attestation configuration");
    if (api.subscriptions_enabled === "false" && (["SUBSCRIPTION_TERMS_APPROVED", "STRIPE_LIVE_MODE", "STRIPE_PREMIUM_PRODUCT_ID", "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_ANNUAL_PRICE_ID", "STRIPE_STUDIO_MONTHLY_PRICE_ID", "STRIPE_STUDIO_ANNUAL_PRICE_ID"].some((name) => apiConfig.includes(name)) || ["STRIPE_SECRET_KEY", "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET"].some((name) => apiSecrets.includes(name)))) errors.push("api admission retains disabled subscription configuration");
    if (api.sponsored_content_enabled === "true" && (!["MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE", "MGT_SPONSORED_CONTENT_APPROVED_AT"].every((name) => apiConfig.includes(name)) || api.sponsored_content_reviewed !== "true" || api.omni_retail_enabled !== "true" || api.retail_partner_authorization_reviewed !== "true")) errors.push("api admission posture requires approved sponsored-content inputs");
    if (api.sponsored_content_enabled === "false" && (["MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE", "MGT_SPONSORED_CONTENT_APPROVED_AT"].some((name) => apiConfig.includes(name)) || api.sponsored_content_reviewed !== "false")) errors.push("api admission retains disabled sponsored-content configuration");
    if (worker.notification_delivery === "in_app" && (["NOTIFICATION_WEBHOOK_URL", "NOTIFICATION_WEBHOOK_KEY_ID", "NOTIFICATION_WEBHOOK_TIMEOUT_MS"].some((name) => workerConfig.includes(name)) || workerSecrets.includes("NOTIFICATION_WEBHOOK_TOKEN"))) errors.push("worker admission retains disabled webhook configuration");
    validateCrossConsumerSecretUse({ edge: { secret_keys: edgeSecrets }, api: { secret_keys: apiSecrets }, worker: { secret_keys: workerSecrets } }, errors);
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function readPrivateInput(filePath, { retainValues = false, rejectSecretLikeValues = false } = {}) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("private runtime input must be a regular non-symlink file");
  if (stat.size < 1 || stat.size > MAX_PRIVATE_INPUT_BYTES) throw new Error("private runtime input must have a bounded non-zero size");
  const content = fs.readFileSync(filePath, "utf8");
  const values = {};
  for (const line of content.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = line.match(ASSIGNMENT);
    if (!match || !match[2].trim()) throw new Error("private runtime input must contain only non-empty KEY=value assignments or comments");
    if (own(values, match[1])) throw new Error("private runtime input must not repeat an environment variable");
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (rejectSecretLikeValues && isSecretLikeValue(value)) throw new Error("non-secret runtime configuration must not contain a secret-like value");
    values[match[1]] = retainValues ? value : true;
  }
  if (!Object.keys(values).length) throw new Error("private runtime input must declare at least one environment variable");
  return { values, real_path: fs.realpathSync(filePath), mode: stat.mode };
}

function safeJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { throw new Error("secret-injection contract must be valid JSON"); }
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

function resolvePrivateInput(value) {
  if (!value) throw new Error("all six private runtime input paths are required");
  return path.resolve(value);
}

function runCli() {
  const args = process.argv.slice(2);
  const environment = argumentValue(args, "--environment");
  const candidateCommit = argumentValue(args, "--candidate-commit");
  const output = argumentValue(args, "--output");
  const composeProjectName = argumentValue(args, "--compose-project-name");
  const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
  if (!environment || !candidateCommit || !composeProjectName || !output) throw new Error("Usage: node infra/portal/secret-injection-admission.mjs --environment staging|production --compose-project-name mgt-skin-care-staging|mgt-skin-care-production --candidate-commit <sha> --staging-contract <path> --production-contract <path> --edge-config <private-file> --edge-secrets <private-file> --api-config <private-file> --api-secrets <private-file> --worker-config <private-file> --worker-secrets <private-file> --output work/<environment>/secret-injection-admission.json");
  const contractPaths = { staging: argumentValue(args, "--staging-contract"), production: argumentValue(args, "--production-contract") };
  if (!contractPaths.staging || !contractPaths.production) throw new Error("both candidate-bound staging and production secret-injection contracts are required");
  const privatePaths = Object.fromEntries(RUNTIME_INPUT_CONSUMERS.map((consumer) => [consumer, {
    config: resolvePrivateInput(argumentValue(args, `--${consumer}-config`)),
    secrets: resolvePrivateInput(argumentValue(args, `--${consumer}-secrets`))
  }]));
  const parsed = {};
  const paths = [];
  for (const consumer of RUNTIME_INPUT_CONSUMERS) {
    const config = readPrivateInput(privatePaths[consumer].config, { retainValues: true, rejectSecretLikeValues: true });
    const secrets = readPrivateInput(privatePaths[consumer].secrets);
    paths.push(config.real_path, secrets.real_path);
    parsed[consumer] = { config_values: config.values, config_keys: Object.keys(config.values), secret_keys: Object.keys(secrets.values) };
  }
  const privateFilesDistinct = new Set(paths).size === paths.length;
  const unixPermissions = process.platform === "win32" ? "provider_acl_required" : paths.length && Object.values(privatePaths).flatMap((entry) => [entry.config, entry.secrets]).every((input) => (fs.statSync(input).mode & 0o077) === 0) ? "verified" : "provider_acl_required";
  const report = buildSecretInjectionAdmission({
    environment,
    candidateCommit,
    stagingContract: safeJson(path.resolve(contractPaths.staging)),
    productionContract: safeJson(path.resolve(contractPaths.production)),
    inventories: parsed,
    composeProjectName,
    privateFilesDistinct,
    fileSecurity: unixPermissions
  });
  const outputPath = path.resolve(output);
  const inputPaths = [...paths, ...Object.values(contractPaths).map((input) => fs.realpathSync(path.resolve(input)))];
  const comparableOutputPath = fs.existsSync(outputPath) ? fs.realpathSync(outputPath) : outputPath;
  if (inputPaths.some((input) => input === comparableOutputPath)) throw new Error("evidence output must not overwrite a private runtime input or secret-injection contract");
  const relative = path.relative(root, outputPath).replaceAll("\\", "/");
  if (!/^(?:work|infra)\/[A-Za-z0-9._/-]+\.json$/.test(relative) || relative.includes("..")) throw new Error("output must be a safe work/ or infra/ JSON evidence path");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Secret-injection admission: ${relative}`);
  if (report.status !== "pass") process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { runCli(); }
  catch (error) { console.error(`Unable to validate secret-injection inputs: ${error.message}`); process.exitCode = 1; }
}
