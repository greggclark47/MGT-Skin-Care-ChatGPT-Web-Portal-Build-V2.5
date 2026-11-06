import test from "node:test";
import assert from "node:assert/strict";
import {
  SECRET_INJECTION_CONSUMERS,
  SECRET_INJECTION_VARIABLES,
  createSecretInjectionContractTemplate,
  validateSecretInjectionContract,
  validateSecretInjectionContractPair
} from "./secret-injection-contract.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";

function pathName(name) {
  return name.toLowerCase().replaceAll("_", "-");
}

function completed(environment) {
  const namespace = `secret://approved/mgt-skin-care/${environment}`;
  const secretReferences = Object.fromEntries(SECRET_INJECTION_CONSUMERS.map((consumer) => [consumer, Object.fromEntries(
    SECRET_INJECTION_VARIABLES[consumer].map((name) => [name, `${namespace}/${pathName(name)}`])
  )]));
  secretReferences.api.MGT_EDGE_TOKEN = secretReferences.edge.MGT_EDGE_TOKEN;
  secretReferences.worker.DATABASE_URL = secretReferences.api.DATABASE_URL;
  return createSecretInjectionContractTemplate({
    environment,
    candidateCommit: COMMIT,
    providerReference: "secret-manager://approved/mgt-skin-care",
    namespaceReference: namespace,
    workloadIdentities: {
      edge: `workload://mgt-skin-care/${environment}/edge`,
      api: `workload://mgt-skin-care/${environment}/api`,
      worker: `workload://mgt-skin-care/${environment}/worker`
    },
    secretReferences
  });
}

test("creates a non-secret operator intake shape with no web assignment", () => {
  const result = createSecretInjectionContractTemplate();
  assert.equal(result.environment, "staging");
  assert.equal(result.secret_manager.provider_reference, null);
  assert.deepEqual(SECRET_INJECTION_VARIABLES.edge, ["MGT_EDGE_TOKEN"]);
  assert.deepEqual(SECRET_INJECTION_VARIABLES.api, [
    "DATABASE_URL",
    "MGT_EDGE_TOKEN",
    "SUPABASE_ANON_KEY",
    "BACKUP_ATTESTATION_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET",
    "OPENAI_API_KEY",
    "OPENCLAW_API_KEY"
  ]);
  assert.deepEqual(SECRET_INJECTION_VARIABLES.worker, [
    "DATABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPERATIONS_ALERT_WEBHOOK_TOKEN",
    "NOTIFICATION_WEBHOOK_TOKEN"
  ]);
  assert.deepEqual(result.consumer_assignments.web, { workload_identity_reference: null, secret_references: {} });
  assert.deepEqual(Object.values(result.consumer_assignments.api.secret_references), Array(SECRET_INJECTION_VARIABLES.api.length).fill(null));
  assert.equal(validateSecretInjectionContract(result, { requireComplete: false }).ok, true);
  assert.match(validateSecretInjectionContract(result).errors.join("; "), /candidate_commit must be supplied/);
});

test("keeps a ready contract candidate-bound and rejects extra plaintext fields", () => {
  const contract = completed("staging");
  contract.candidate_commit = null;
  assert.match(validateSecretInjectionContract(contract).errors.join("; "), /candidate_commit must be supplied/);

  contract.candidate_commit = COMMIT;
  contract.plaintext = "not-accepted";
  assert.match(validateSecretInjectionContract(contract).errors.join("; "), /exact reference-only field set/);
});

test("accepts mapped reference-only staging and production contracts", () => {
  const staging = completed("staging");
  const production = completed("production");
  assert.deepEqual(validateSecretInjectionContract(staging), { ok: true, errors: [] });
  assert.deepEqual(validateSecretInjectionContract(production), { ok: true, errors: [] });
  assert.deepEqual(validateSecretInjectionContractPair({ staging, production }), { ok: true, errors: [] });
});

test("rejects plaintext-like values without returning them in errors", () => {
  const contract = completed("staging");
  contract.consumer_assignments.api.secret_references.DATABASE_URL = "postgresql://mgt:password@db.example/mgt";
  const result = validateSecretInjectionContract(contract);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("; "), /safe secret-manager path/);
  assert.doesNotMatch(result.errors.join("; "), /password|postgresql/i);

  contract.consumer_assignments.api.secret_references.OPENAI_API_KEY = "sk_live_not-a-reference";
  assert.match(validateSecretInjectionContract(contract).errors.join("; "), /safe secret-manager path/);
});

test("rejects web secret-manager identities or secret assignment fields", () => {
  const contract = completed("staging");
  contract.consumer_assignments.web.workload_identity_reference = "workload://mgt-skin-care/staging/web";
  assert.match(validateSecretInjectionContract(contract).errors.join("; "), /web must not receive a secret-manager workload identity/);

  contract.consumer_assignments.web.workload_identity_reference = null;
  contract.consumer_assignments.web.secret_references = { OPENAI_API_KEY: "secret://approved/mgt-skin-care/staging/openai-api-key" };
  assert.match(validateSecretInjectionContract(contract).errors.join("; "), /web must not receive a secret-manager workload identity or secret assignment/);
});

test("enforces consumer/path mapping and least-privilege identities", () => {
  const contract = completed("staging");
  contract.consumer_assignments.worker.secret_references.DATABASE_URL = "secret://approved/mgt-skin-care/staging/worker-database-url";
  assert.match(validateSecretInjectionContract(contract).errors.join("; "), /DATABASE_URL must resolve from the same approved path/);

  contract.consumer_assignments.worker.secret_references.DATABASE_URL = contract.consumer_assignments.api.secret_references.DATABASE_URL;
  contract.consumer_assignments.api.secret_references.OPENCLAW_API_KEY = contract.consumer_assignments.api.secret_references.OPENAI_API_KEY;
  assert.match(validateSecretInjectionContract(contract).errors.join("; "), /may not be reused across unrelated consumer assignments/);

  contract.consumer_assignments.api.secret_references.OPENCLAW_API_KEY = "secret://approved/mgt-skin-care/staging/openclaw-api-key";
  contract.consumer_assignments.worker.workload_identity_reference = contract.consumer_assignments.api.workload_identity_reference;
  assert.match(validateSecretInjectionContract(contract).errors.join("; "), /distinct workload identity reference/);
});

test("requires namespace-rooted paths and stage/production isolation", () => {
  const staging = completed("staging");
  const production = completed("production");
  const hostedApiKey = "OPENAI_API_KEY";
  staging.consumer_assignments.api.secret_references[hostedApiKey] = "secret://approved/mgt-skin-care/other/openai-api-key";
  assert.match(validateSecretInjectionContract(staging).errors.join("; "), /must stay within the declared secret-manager namespace/);

  staging.consumer_assignments.api.secret_references[hostedApiKey] = "secret://approved/mgt-skin-care/staging/openai-api-key";
  production.consumer_assignments.edge.workload_identity_reference = staging.consumer_assignments.edge.workload_identity_reference;
  const identityResult = validateSecretInjectionContractPair({ staging, production });
  assert.match(identityResult.errors.join("; "), /staging and production workload identities must remain distinct/);

  production.consumer_assignments.edge.workload_identity_reference = "workload://mgt-skin-care/production/edge";
  production.secret_manager.namespace_reference = staging.secret_manager.namespace_reference;
  const namespaceResult = validateSecretInjectionContractPair({ staging, production });
  assert.match(namespaceResult.errors.join("; "), /staging and production secret-manager namespaces must remain distinct/);
});

test("rejects provider paths whose normalization could cross a namespace boundary", () => {
  const staging = completed("staging");
  const production = completed("production");
  staging.consumer_assignments.api.secret_references.DATABASE_URL = "secret://approved/mgt-skin-care/staging/../production/database-url";
  staging.consumer_assignments.worker.secret_references.DATABASE_URL = staging.consumer_assignments.api.secret_references.DATABASE_URL;
  const traversal = validateSecretInjectionContract(staging);
  assert.equal(traversal.ok, false);
  assert.match(traversal.errors.join("; "), /safe secret-manager path|must stay within/);

  staging.consumer_assignments.api.secret_references.DATABASE_URL = "secret://approved/mgt-skin-care/staging//database-url";
  staging.consumer_assignments.worker.secret_references.DATABASE_URL = staging.consumer_assignments.api.secret_references.DATABASE_URL;
  const duplicateSeparator = validateSecretInjectionContractPair({ staging, production });
  assert.equal(duplicateSeparator.ok, false);
  assert.match(duplicateSeparator.errors.join("; "), /safe secret-manager path|must stay within/);
});
