// Provider-neutral, reference-only admission contract for secret injection.
// It deliberately describes _where_ a workload may resolve a secret, never a
// secret value or an instruction to perform the resolution.

export const SECRET_INJECTION_CONTRACT_VERSION = "1.0";
export const SECRET_INJECTION_CONSUMERS = Object.freeze(["edge", "api", "worker", "web"]);

// These are environment-variable names, not values.  The web application has
// no permitted secret assignment; browser-safe public configuration belongs in
// the ordinary non-secret deployment configuration instead.
export const SECRET_INJECTION_VARIABLES = Object.freeze({
  edge: Object.freeze(["MGT_EDGE_TOKEN"]),
  api: Object.freeze([
    "DATABASE_URL",
    "MGT_EDGE_TOKEN",
    "SUPABASE_ANON_KEY",
    "BACKUP_ATTESTATION_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET",
    "OPENAI_API_KEY",
    "OPENCLAW_API_KEY"
  ]),
  worker: Object.freeze([
    "DATABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPERATIONS_ALERT_WEBHOOK_TOKEN",
    "NOTIFICATION_WEBHOOK_TOKEN"
  ]),
  web: Object.freeze([])
});

const ENVIRONMENTS = new Set(["staging", "production"]);
const SHA = /^[a-f0-9]{40}$/i;
const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{2,1023}$/;
const PLACEHOLDER = /(?:replace[_-]?with|change[_-]?me|your[-_]|example(?:\.com)?|localhost|127\.0\.0\.1|dummy|plaintext)/i;
const VALUE_LIKE = /(?:-----BEGIN|\b(?:sk_(?:live|test)|whsec_)|(?:postgres|postgresql):\/\/|\beyJ[A-Za-z0-9_-]{8,}|(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|secret|token)\s*(?:=|:(?!\/\/)))/i;
const REQUIRED_ASSIGNMENTS = Object.freeze({
  edge: Object.freeze(["MGT_EDGE_TOKEN"]),
  api: Object.freeze(["DATABASE_URL", "MGT_EDGE_TOKEN", "SUPABASE_ANON_KEY"]),
  worker: Object.freeze(["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPERATIONS_ALERT_WEBHOOK_TOKEN"]),
  web: Object.freeze([])
});
const SHARED_ASSIGNMENTS = Object.freeze({
  DATABASE_URL: Object.freeze(["api", "worker"]),
  MGT_EDGE_TOKEN: Object.freeze(["edge", "api"])
});

// Secret-manager references are compared as opaque strings.  Before doing so,
// reject path syntax that a provider could normalize differently (for example
// `staging/../production` or a duplicate separator).  The `//` in a URI scheme
// is permitted; separators in the path itself must be unambiguous.
function canonicalReferencePath(value) {
  const scheme = value.indexOf("://");
  const authorityAndPath = scheme >= 0 ? value.slice(scheme + 3) : value;
  const separator = authorityAndPath.indexOf("/");
  if (separator < 0) return authorityAndPath !== "." && authorityAndPath !== "..";
  const authority = authorityAndPath.slice(0, separator);
  const path = authorityAndPath.slice(separator + 1);
  return authority.length > 0
    && authority !== "."
    && authority !== ".."
    && path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return plainObject(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => own(value, key));
}

function validReference(value) {
  return typeof value === "string"
    && value === value.trim()
    && REFERENCE.test(value)
    && canonicalReferencePath(value)
    && !/[\u0000-\u001f\u007f]/.test(value)
    && !PLACEHOLDER.test(value)
    && !isSecretLikeValue(value);
}

// Keep the detector deliberately conservative. It is used only to stop a
// credential-shaped value from being placed in a non-secret input; it never
// reports the value that caused the rejection.
export function isSecretLikeValue(value) {
  return VALUE_LIKE.test(String(value || ""));
}

function nullableReference(value) {
  return value === null || validReference(value);
}

function namespaceContains(namespace, reference) {
  return validReference(namespace)
    && validReference(reference)
    && reference.startsWith(`${namespace}/`)
    && reference.length > namespace.length + 1;
}

function assignmentRecord(values = {}) {
  return Object.fromEntries(values.map((key) => [key, null]));
}

function completeReferenceError(field) {
  return `${field} must be supplied before a secret-injection contract is ready`;
}

function collectReferences(contract) {
  const references = [];
  for (const consumer of SECRET_INJECTION_CONSUMERS) {
    const assignments = contract?.consumer_assignments?.[consumer]?.secret_references;
    if (!plainObject(assignments)) continue;
    for (const [name, reference] of Object.entries(assignments)) {
      if (typeof reference === "string") references.push({ consumer, name, reference });
    }
  }
  return references;
}

function validateSharedAssignments(contract, errors) {
  for (const [name, consumers] of Object.entries(SHARED_ASSIGNMENTS)) {
    const values = consumers
      .map((consumer) => contract?.consumer_assignments?.[consumer]?.secret_references?.[name])
      .filter((value) => typeof value === "string");
    if (values.length === consumers.length && new Set(values).size !== 1) {
      errors.push(`${name} must resolve from the same approved path for its mapped consumers`);
    }
  }

  const byReference = new Map();
  for (const entry of collectReferences(contract)) {
    const entries = byReference.get(entry.reference) || [];
    entries.push(entry);
    byReference.set(entry.reference, entries);
  }
  for (const entries of byReference.values()) {
    if (entries.length < 2) continue;
    const names = [...new Set(entries.map((entry) => entry.name))];
    const consumers = [...new Set(entries.map((entry) => entry.consumer))].sort();
    const permitted = names.length === 1
      && SHARED_ASSIGNMENTS[names[0]]
      && consumers.length === SHARED_ASSIGNMENTS[names[0]].length
      && consumers.every((consumer) => SHARED_ASSIGNMENTS[names[0]].includes(consumer));
    if (!permitted) errors.push("a secret path may not be reused across unrelated consumer assignments");
  }
}

/**
 * Creates an operator-intake shape.  All injected secret fields are null by
 * default.  Supplying references makes no provider request and cannot inject
 * a secret.
 */
export function createSecretInjectionContractTemplate({
  environment = "staging",
  candidateCommit = null,
  providerReference = null,
  namespaceReference = null,
  workloadIdentities = {},
  secretReferences = {}
} = {}) {
  return {
    version: SECRET_INJECTION_CONTRACT_VERSION,
    environment,
    candidate_commit: candidateCommit,
    secret_manager: {
      provider_reference: providerReference,
      namespace_reference: namespaceReference
    },
    consumer_assignments: Object.fromEntries(SECRET_INJECTION_CONSUMERS.map((consumer) => [consumer, {
      workload_identity_reference: consumer === "web" ? null : (own(workloadIdentities, consumer) ? workloadIdentities[consumer] : null),
      secret_references: Object.fromEntries(SECRET_INJECTION_VARIABLES[consumer].map((name) => [
        name,
        own(secretReferences?.[consumer], name) ? secretReferences[consumer][name] : null
      ]))
    }]))
  };
}

/**
 * Validates a single environment's non-secret injection plan.  Set
 * `requireComplete: false` while collecting an operator intake; use the
 * default before treating the plan as ready for provider-side binding.
 */
export function validateSecretInjectionContract(contract, { requireComplete = true } = {}) {
  const errors = [];
  if (!plainObject(contract)) return { ok: false, errors: ["secret-injection contract must be an object"] };
  if (!exactKeys(contract, ["version", "environment", "candidate_commit", "secret_manager", "consumer_assignments"])) {
    errors.push("secret-injection contract must retain its exact reference-only field set");
  }
  if (contract.version !== SECRET_INJECTION_CONTRACT_VERSION) errors.push(`secret-injection contract version must be ${SECRET_INJECTION_CONTRACT_VERSION}`);
  if (!ENVIRONMENTS.has(contract.environment)) errors.push("secret-injection contract environment must be staging or production");
  if (contract.candidate_commit !== null && (typeof contract.candidate_commit !== "string" || !SHA.test(contract.candidate_commit))) errors.push("candidate_commit must be a commit SHA or null");
  if (requireComplete && contract.candidate_commit === null) errors.push(completeReferenceError("candidate_commit"));

  const manager = contract.secret_manager;
  if (!exactKeys(manager, ["provider_reference", "namespace_reference"])) {
    errors.push("secret_manager must contain only provider_reference and namespace_reference");
  } else {
    for (const field of ["provider_reference", "namespace_reference"]) {
      if (!nullableReference(manager[field])) errors.push(`secret_manager.${field} must be a safe provider reference or null`);
      if (requireComplete && manager[field] === null) errors.push(completeReferenceError(`secret_manager.${field}`));
    }
    if (typeof manager.namespace_reference === "string" && manager.namespace_reference.endsWith("/")) errors.push("secret_manager.namespace_reference must not end with a slash");
  }

  const assignments = contract.consumer_assignments;
  if (!exactKeys(assignments, SECRET_INJECTION_CONSUMERS)) {
    errors.push("consumer_assignments must contain exactly edge, api, worker, and web");
  } else {
    const identities = new Map();
    for (const consumer of SECRET_INJECTION_CONSUMERS) {
      const entry = assignments[consumer];
      const allowedVariables = SECRET_INJECTION_VARIABLES[consumer];
      if (!exactKeys(entry, ["workload_identity_reference", "secret_references"])) {
        errors.push(`${consumer} assignment must contain only workload_identity_reference and secret_references`);
        continue;
      }
      if (!exactKeys(entry.secret_references, allowedVariables)) errors.push(`${consumer} secret_references must retain its exact mapped field set`);

      if (!nullableReference(entry.workload_identity_reference)) errors.push(`${consumer} workload_identity_reference must be a safe provider reference or null`);
      if (consumer === "web" && (entry.workload_identity_reference !== null || !exactKeys(entry.secret_references, []))) {
        errors.push("web must not receive a secret-manager workload identity or secret assignment");
      }
      if (consumer !== "web" && requireComplete && entry.workload_identity_reference === null) errors.push(completeReferenceError(`${consumer} workload_identity_reference`));
      if (consumer !== "web" && typeof entry.workload_identity_reference === "string") {
        const duplicateConsumer = identities.get(entry.workload_identity_reference);
        if (duplicateConsumer) errors.push("each non-web consumer must use a distinct workload identity reference");
        else identities.set(entry.workload_identity_reference, consumer);
      }

      if (!plainObject(entry.secret_references)) continue;
      for (const name of allowedVariables) {
        const reference = entry.secret_references[name];
        if (!nullableReference(reference)) errors.push(`${consumer}.${name} must be a safe secret-manager path or null`);
        if (typeof reference === "string" && typeof manager?.namespace_reference === "string" && !namespaceContains(manager.namespace_reference, reference)) {
          errors.push(`${consumer}.${name} must stay within the declared secret-manager namespace`);
        }
        if (typeof reference === "string" && manager?.namespace_reference === null) errors.push("a mapped secret path requires a declared secret-manager namespace");
        if (requireComplete && REQUIRED_ASSIGNMENTS[consumer].includes(name) && reference === null) errors.push(completeReferenceError(`${consumer}.${name}`));
      }
    }
  }

  if (plainObject(assignments)) validateSharedAssignments(contract, errors);
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

/**
 * Validates two independently scoped contracts before promotion.  This is a
 * data-only comparison: it does not authenticate, resolve, rotate, or expose
 * any secret.
 */
export function validateSecretInjectionContractPair({ staging, production } = {}, options = {}) {
  const errors = [];
  const stagingResult = validateSecretInjectionContract(staging, options);
  const productionResult = validateSecretInjectionContract(production, options);
  errors.push(...stagingResult.errors.map((error) => `staging: ${error}`));
  errors.push(...productionResult.errors.map((error) => `production: ${error}`));
  if (staging?.environment !== "staging") errors.push("staging contract must declare staging environment");
  if (production?.environment !== "production") errors.push("production contract must declare production environment");

  const stagingNamespace = staging?.secret_manager?.namespace_reference;
  const productionNamespace = production?.secret_manager?.namespace_reference;
  if (typeof stagingNamespace === "string" && typeof productionNamespace === "string" && stagingNamespace === productionNamespace) {
    errors.push("staging and production secret-manager namespaces must remain distinct");
  }
  const stagingCommit = staging?.candidate_commit;
  const productionCommit = production?.candidate_commit;
  if (typeof stagingCommit === "string" && typeof productionCommit === "string" && stagingCommit !== productionCommit) {
    errors.push("staging and production secret-injection contracts must bind the same candidate commit");
  }

  const stagingIdentities = new Set(SECRET_INJECTION_CONSUMERS
    .filter((consumer) => consumer !== "web")
    .map((consumer) => staging?.consumer_assignments?.[consumer]?.workload_identity_reference)
    .filter((value) => typeof value === "string"));
  const productionIdentities = new Set(SECRET_INJECTION_CONSUMERS
    .filter((consumer) => consumer !== "web")
    .map((consumer) => production?.consumer_assignments?.[consumer]?.workload_identity_reference)
    .filter((value) => typeof value === "string"));
  if ([...stagingIdentities].some((identity) => productionIdentities.has(identity))) {
    errors.push("staging and production workload identities must remain distinct");
  }

  const stagingPaths = new Set(collectReferences(staging).map((entry) => entry.reference));
  const productionPaths = new Set(collectReferences(production).map((entry) => entry.reference));
  if ([...stagingPaths].some((reference) => productionPaths.has(reference))) {
    errors.push("staging and production secret-manager paths must remain distinct");
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
