import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  RUNTIME_CONFIG_VARIABLES,
  RUNTIME_INPUT_CONSUMERS,
  REQUIRED_CONFIG_VARIABLES,
  buildSecretInjectionAdmission,
  secretInjectionAdmissionChecksum,
  validateSecretInjectionAdmission
} from "./secret-injection-admission.mjs";
import {
  SECRET_INJECTION_CONSUMERS,
  SECRET_INJECTION_VARIABLES,
  createSecretInjectionContractTemplate
} from "./secret-injection-contract.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";

function pathName(name) {
  return name.toLowerCase().replaceAll("_", "-");
}

function contract(environment) {
  const namespace = `secret://approved/mgt-skin-care/${environment}`;
  const secretReferences = Object.fromEntries(SECRET_INJECTION_CONSUMERS.map((consumer) => [consumer, Object.fromEntries(
    SECRET_INJECTION_VARIABLES[consumer].map((name) => [name, null])
  )]));
  for (const [consumer, names] of Object.entries({ edge: ["MGT_EDGE_TOKEN"], api: ["DATABASE_URL", "MGT_EDGE_TOKEN", "SUPABASE_ANON_KEY"], worker: ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPERATIONS_ALERT_WEBHOOK_TOKEN"] })) {
    for (const name of names) secretReferences[consumer][name] = `${namespace}/${pathName(name)}`;
  }
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

function configValues(consumer) {
  if (consumer === "edge") return { PORTAL_DOMAIN: "portal.mgt-skin-care.test" };
  const value = Object.fromEntries(REQUIRED_CONFIG_VARIABLES[consumer].map((name) => [name, "configured"]));
  value.NODE_ENV = "production";
  value.DEMO_MODE = "false";
  value.PORTAL_AUTO_MIGRATE = "false";
  if (consumer === "api") {
    value.PUBLIC_ORIGIN = "https://portal.mgt-skin-care.test";
    value.PORTAL_DOMAIN = "portal.mgt-skin-care.test";
    value.HOST = "0.0.0.0";
    value.PORT = "3100";
    value.OLLAMA_ENABLED = "false";
    value.OPENCLAW_ENABLED = "false";
    value.OLLAMA_CLOUD_ENABLED = "false";
    value.HOSTED_OPENAI_ENABLED = "false";
    value.BACKUP_ATTESTATION_ENABLED = "false";
    value.SUBSCRIPTIONS_ENABLED = "false";
    value.MGT_OMNI_RETAIL_ENABLED = "false";
    value.MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED = "false";
    value.MGT_SPONSORED_CONTENT_ENABLED = "false";
    value.MGT_SPONSORED_CONTENT_REVIEWED = "false";
  }
  if (consumer === "worker") value.NOTIFICATION_DELIVERY = "in_app";
  return value;
}

function inventories() {
  const api = configValues("api");
  const worker = configValues("worker");
  return {
    edge: { config_values: configValues("edge"), config_keys: ["PORTAL_DOMAIN"], secret_keys: ["MGT_EDGE_TOKEN"] },
    api: { config_values: api, config_keys: Object.keys(api), secret_keys: ["DATABASE_URL", "MGT_EDGE_TOKEN", "SUPABASE_ANON_KEY"] },
    worker: { config_values: worker, config_keys: Object.keys(worker), secret_keys: ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPERATIONS_ALERT_WEBHOOK_TOKEN"] }
  };
}

function admission(overrides = {}) {
  return buildSecretInjectionAdmission({
    environment: "staging",
    composeProjectName: "mgt-skin-care-staging",
    candidateCommit: COMMIT,
    stagingContract: contract("staging"),
    productionContract: contract("production"),
    inventories: inventories(),
    privateFilesDistinct: true,
    fileSecurity: "verified",
    generatedAt: "2026-10-24T19:30:00.000Z",
    ...overrides
  });
}

test("admits only candidate-bound role-scoped runtime inputs without values", () => {
  const result = admission();
  assert.equal(result.status, "pass", result.errors.join("\n"));
  assert.equal(validateSecretInjectionAdmission(result, { environment: "staging", candidateCommit: COMMIT }).ok, true);
  assert.deepEqual(Object.keys(result.workloads), RUNTIME_INPUT_CONSUMERS);
  assert.deepEqual(result.workloads.edge.secret_variables, ["MGT_EDGE_TOKEN"]);
  assert.deepEqual(result.workloads.api.secret_variables, ["DATABASE_URL", "MGT_EDGE_TOKEN", "SUPABASE_ANON_KEY"]);
  assert.deepEqual(result.workloads.worker.secret_variables, ["DATABASE_URL", "OPERATIONS_ALERT_WEBHOOK_TOKEN", "SUPABASE_SERVICE_ROLE_KEY"]);
  assert.doesNotMatch(JSON.stringify(result), /postgresql:|super-secret|password=/i);
});

test("rejects shared private files, cross-role secrets, and secret-like configuration", () => {
  const sharedFile = admission({ privateFilesDistinct: false });
  assert.equal(sharedFile.status, "blocked");
  assert.match(sharedFile.errors.join("; "), /six distinct private files/);

  const withPeerSecret = inventories();
  withPeerSecret.api.secret_keys.push("SUPABASE_SERVICE_ROLE_KEY");
  const peerSecret = admission({ inventories: withPeerSecret });
  assert.equal(peerSecret.status, "blocked");
  assert.match(peerSecret.errors.join("; "), /unassigned variable/);

  const withSecretConfig = inventories();
  withSecretConfig.edge.config_values.DATABASE_URL = "not-serialized";
  withSecretConfig.edge.config_keys.push("DATABASE_URL");
  const secretConfig = admission({ inventories: withSecretConfig });
  assert.equal(secretConfig.status, "blocked");
  assert.match(secretConfig.errors.join("; "), /secret-like variable/);
  assert.doesNotMatch(JSON.stringify(secretConfig), /not-serialized/);

  const withSecretValue = inventories();
  withSecretValue.edge.config_values.PORTAL_DOMAIN = "postgresql://user:password@database.example/mgt";
  const secretValue = admission({ inventories: withSecretValue });
  assert.equal(secretValue.status, "blocked");
  assert.match(secretValue.errors.join("; "), /secret-like value/);
  assert.doesNotMatch(JSON.stringify(secretValue), /postgresql:|password@/i);

  const overscopedStaging = contract("staging");
  const overscopedProduction = contract("production");
  for (const current of [overscopedStaging, overscopedProduction]) current.consumer_assignments.api.secret_references.STRIPE_SECRET_KEY = `${current.secret_manager.namespace_reference}/stripe-secret-key`;
  const overscoped = admission({ stagingContract: overscopedStaging, productionContract: overscopedProduction });
  assert.equal(overscoped.status, "blocked");
  assert.match(overscoped.errors.join("; "), /approved contract retains a disabled or unapproved secret/);

  const crossedStage = admission({ composeProjectName: "mgt-skin-care-production" });
  assert.equal(crossedStage.status, "blocked");
  assert.match(crossedStage.errors.join("; "), /stage-scoped identifier/);
});

test("requires conditional secret-manager outputs only for enabled features", () => {
  const inputs = inventories();
  inputs.api.config_values.BACKUP_ATTESTATION_ENABLED = "true";
  inputs.api.config_values.BACKUP_ATTESTATION_KEY_ID = "primary";
  inputs.api.config_values.BACKUP_ATTESTATION_MAX_AGE_SECONDS = "3600";
  inputs.api.config_keys.push("BACKUP_ATTESTATION_KEY_ID", "BACKUP_ATTESTATION_MAX_AGE_SECONDS");
  const missingBackupSecret = admission({ inventories: inputs });
  assert.equal(missingBackupSecret.status, "blocked");
  assert.match(missingBackupSecret.errors.join("; "), /missing a required secret/);

  inputs.api.secret_keys.push("BACKUP_ATTESTATION_SECRET");
  const stagingContract = contract("staging");
  const productionContract = contract("production");
  for (const current of [stagingContract, productionContract]) current.consumer_assignments.api.secret_references.BACKUP_ATTESTATION_SECRET = `${current.secret_manager.namespace_reference}/backup-attestation-secret`;
  const enabled = admission({ inventories: inputs, stagingContract, productionContract });
  assert.equal(enabled.status, "pass", enabled.errors.join("\n"));

  const hostedInputs = inventories();
  hostedInputs.api.config_values.HOSTED_OPENAI_ENABLED = "true";
  const missingHostedSecret = admission({ inventories: hostedInputs });
  assert.equal(missingHostedSecret.status, "blocked");
  assert.match(missingHostedSecret.errors.join("; "), /missing a required secret/);

  hostedInputs.api.secret_keys.push("OPENAI_API_KEY");
  const hostedStaging = contract("staging");
  const hostedProduction = contract("production");
  for (const current of [hostedStaging, hostedProduction]) current.consumer_assignments.api.secret_references.OPENAI_API_KEY = `${current.secret_manager.namespace_reference}/openai-api-key`;
  const hosted = admission({ inventories: hostedInputs, stagingContract: hostedStaging, productionContract: hostedProduction });
  assert.equal(hosted.status, "pass", hosted.errors.join("\n"));

  const dormantHostedInputs = inventories();
  dormantHostedInputs.api.secret_keys.push("OPENAI_API_KEY");
  const dormantHosted = admission({ inventories: dormantHostedInputs, stagingContract: hostedStaging, productionContract: hostedProduction });
  assert.equal(dormantHosted.status, "blocked");
  assert.match(dormantHosted.errors.join("; "), /disabled or unapproved secret/);

  const cloudInputs = inventories();
  Object.assign(cloudInputs.api.config_values, {
    OLLAMA_CLOUD_ENABLED: "true",
    OLLAMA_CLOUD_BASE_URL: "https://ollama.com",
    OLLAMA_CLOUD_MODEL: "deepseek-v4.1-flash"
  });
  cloudInputs.api.config_keys.push("OLLAMA_CLOUD_BASE_URL", "OLLAMA_CLOUD_MODEL");
  assert.equal(admission({ inventories: cloudInputs }).status, "blocked");
  cloudInputs.api.secret_keys.push("OLLAMA_CLOUD_API_KEY");
  const cloudStaging = contract("staging"), cloudProduction = contract("production");
  for (const current of [cloudStaging, cloudProduction]) current.consumer_assignments.api.secret_references.OLLAMA_CLOUD_API_KEY = `${current.secret_manager.namespace_reference}/ollama-cloud-api-key`;
  const cloudEnabled = admission({ inventories: cloudInputs, stagingContract: cloudStaging, productionContract: cloudProduction });
  assert.equal(cloudEnabled.status, "pass", cloudEnabled.errors.join("\n"));

  const sponsoredInputs = inventories();
  Object.assign(sponsoredInputs.api.config_values, {
    MGT_OMNI_RETAIL_ENABLED: "true",
    MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED: "true",
    MGT_SPONSORED_CONTENT_ENABLED: "true",
    MGT_SPONSORED_CONTENT_REVIEWED: "true"
  });
  const missingSponsorApproval = admission({ inventories: sponsoredInputs });
  assert.equal(missingSponsorApproval.status, "blocked");
  assert.match(missingSponsorApproval.errors.join("; "), /MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE/);

  Object.assign(sponsoredInputs.api.config_values, {
    MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE: "merchant-review-20261103",
    MGT_SPONSORED_CONTENT_APPROVED_AT: "2026-11-03T00:00:00.000Z"
  });
  sponsoredInputs.api.config_keys.push("MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE", "MGT_SPONSORED_CONTENT_APPROVED_AT");
  const sponsored = admission({ inventories: sponsoredInputs });
  assert.equal(sponsored.status, "pass", sponsored.errors.join("\n"));

  const dormantSponsorInputs = inventories();
  dormantSponsorInputs.api.config_values.MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE = "merchant-review-20261103";
  dormantSponsorInputs.api.config_keys.push("MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE");
  const dormantSponsor = admission({ inventories: dormantSponsorInputs });
  assert.equal(dormantSponsor.status, "blocked");
  assert.match(dormantSponsor.errors.join("; "), /disabled sponsored-content approval configuration/);
});

test("report verification rejects altered candidate, unsafe status, and reordered inventory", () => {
  const result = admission();
  result.candidate_commit = "f".repeat(40);
  assert.equal(validateSecretInjectionAdmission(result, { environment: "staging", candidateCommit: COMMIT }).ok, false);

  const reordered = admission();
  reordered.workloads.api.config_variables.reverse();
  assert.equal(validateSecretInjectionAdmission(reordered, { environment: "staging", candidateCommit: COMMIT }).ok, false);

  const blocked = admission();
  blocked.status = "blocked";
  blocked.errors = ["bounded failure"];
  assert.equal(validateSecretInjectionAdmission(blocked, { environment: "staging", candidateCommit: COMMIT }).ok, false);

  const noSecrets = admission();
  for (const workload of Object.values(noSecrets.workloads)) workload.secret_variables = [];
  noSecrets.admission_checksum = secretInjectionAdmissionChecksum(noSecrets);
  const missingBaselineSecrets = validateSecretInjectionAdmission(noSecrets, { environment: "staging", candidateCommit: COMMIT });
  assert.equal(missingBaselineSecrets.ok, false);
  assert.match(missingBaselineSecrets.errors.join("; "), /missing a required secret variable/);

  const malformedPosture = admission();
  malformedPosture.feature_posture.api.openclaw_enabled = "not-a-toggle";
  malformedPosture.admission_checksum = secretInjectionAdmissionChecksum(malformedPosture);
  assert.equal(validateSecretInjectionAdmission(malformedPosture, { environment: "staging", candidateCommit: COMMIT }).ok, false);

  const wrongContracts = admission();
  const expectedContracts = { ...wrongContracts.contract_checksums, production: `sha256:${"f".repeat(64)}` };
  assert.equal(validateSecretInjectionAdmission(wrongContracts, { environment: "staging", candidateCommit: COMMIT, expectedContractChecksums: expectedContracts }).ok, false);
});

test("published configuration sets do not permit secret names", () => {
  for (const consumer of RUNTIME_INPUT_CONSUMERS) {
    for (const name of RUNTIME_CONFIG_VARIABLES[consumer]) {
      assert.equal(SECRET_INJECTION_VARIABLES[consumer].includes(name), false);
    }
  }
});

test("CLI reads private files without serializing their paths or values", () => {
  const root = process.cwd();
  const parent = path.join(root, "work");
  fs.mkdirSync(parent, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(parent, "secret-injection-admission-"));
  try {
    const contracts = { staging: contract("staging"), production: contract("production") };
    const contractPaths = {};
    for (const [environment, value] of Object.entries(contracts)) {
      contractPaths[environment] = path.join(temporary, `${environment}-contract.json`);
      fs.writeFileSync(contractPaths[environment], `${JSON.stringify(value, null, 2)}\n`);
    }
    const inputs = inventories();
    const argumentsForInputs = [];
    for (const consumer of RUNTIME_INPUT_CONSUMERS) {
      const configPath = path.join(temporary, `${consumer}.config`);
      const secretsPath = path.join(temporary, `${consumer}.secrets`);
      fs.writeFileSync(configPath, `${Object.entries(inputs[consumer].config_values).map(([key, value]) => `${key}=${value}`).join("\n")}\n`);
      fs.writeFileSync(secretsPath, `${inputs[consumer].secret_keys.map((key) => `${key}=private-value-that-must-not-appear`).join("\n")}\n`);
      argumentsForInputs.push(`--${consumer}-config`, configPath, `--${consumer}-secrets`, secretsPath);
    }
    const output = path.join(temporary, "admission.json");
    const result = spawnSync(process.execPath, [
      "infra/portal/secret-injection-admission.mjs", "--environment", "staging", "--compose-project-name", "mgt-skin-care-staging",
      "--candidate-commit", COMMIT, "--staging-contract", contractPaths.staging, "--production-contract", contractPaths.production,
      ...argumentsForInputs, "--output", path.relative(root, output).replaceAll("\\", "/")
    ], { cwd: root, encoding: "utf8", windowsHide: true });
    const report = fs.readFileSync(output, "utf8");
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}\n${report}`);
    assert.doesNotMatch(report, /private-value-that-must-not-appear/);
    assert.doesNotMatch(report, new RegExp(temporary.replaceAll("\\", "\\\\"), "i"));
    assert.equal(validateSecretInjectionAdmission(JSON.parse(report), { environment: "staging", candidateCommit: COMMIT }).ok, true);

    const configPath = path.join(temporary, "edge.config");
    fs.writeFileSync(configPath, "PORTAL_DOMAIN=postgresql://user:password@database.example/mgt\n");
    const unsafe = spawnSync(process.execPath, [
      "infra/portal/secret-injection-admission.mjs", "--environment", "staging", "--compose-project-name", "mgt-skin-care-staging",
      "--candidate-commit", COMMIT, "--staging-contract", contractPaths.staging, "--production-contract", contractPaths.production,
      ...argumentsForInputs, "--output", path.relative(root, output).replaceAll("\\", "/")
    ], { cwd: root, encoding: "utf8", windowsHide: true });
    assert.notEqual(unsafe.status, 0);
    assert.doesNotMatch(`${unsafe.stdout}\n${unsafe.stderr}`, /user:password@/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
