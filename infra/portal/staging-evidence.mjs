import { createStagingAttestationTemplate, validateStagingAttestation } from "./staging-attestation.mjs";
import { createStagingArtifactsTemplate, validateStagingArtifacts } from "./staging-artifacts.mjs";
import { createStagingProbeTemplate, validateStagingProbe } from "./staging-probe.mjs";
import { createStagingTargetTemplate, validateStagingTarget } from "./staging-target.mjs";

const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;
const SECRET_VALUE = /(?:sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@|(?:OPENAI|SUPABASE|STRIPE)_[A-Z_]*\s*=\s*\S+)/i;

export const STAGING_EVIDENCE_VERSION = "1.2";
export const STAGING_EVIDENCE_GATES = Object.freeze([
  { id: "staging_provisioning", phase: "F437", owner_role: "platform", gate: "Staging target isolation", requirement: "A separate staging origin and deployment target are provisioned outside production." },
  { id: "secret_injection", phase: "F438", owner_role: "platform", gate: "Secret injection boundary", requirement: "Required values are injected through the approved secret manager without copying values into source control or evidence." },
  { id: "artifact_health", phase: "F439", owner_role: "platform", gate: "Immutable artifact and health", requirement: "The exact candidate images are deployed and staging /healthz and /readyz return the recorded healthy result." },
  { id: "evidence_ledger", phase: "F440", owner_role: "release", gate: "Staging evidence ledger", requirement: "The release owner records attributable, immutable staging evidence for the exact candidate and rollback target." }
]);

function text(value) {
  return String(value || "").trim();
}

function validPastIso(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) && parsed <= Date.now();
}

function validReference(value) {
  const reference = text(value);
  return (/^https:\/\//.test(reference) || /^(?:work|infra)\//.test(reference)) && !PLACEHOLDER.test(reference);
}

function validText(value) {
  return text(value).length >= 3 && !PLACEHOLDER.test(text(value));
}

function recordTemplate(gate) {
  return {
    id: gate.id,
    phase: gate.phase,
    gate: gate.gate,
    requirement: gate.requirement,
    owner: `REPLACE_WITH_${gate.owner_role.toUpperCase()}_OWNER`,
    captured_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP",
    environment: "staging",
    action: "REPLACE_WITH_RECORDED_ACTION_OR_COMMAND",
    expected_result: "REPLACE_WITH_EXPECTED_RESULT",
    actual_result: "REPLACE_WITH_ACTUAL_RESULT",
    status: "pending",
    reference: `work/staging/REPLACE_WITH_${gate.id.toUpperCase()}_EVIDENCE.md`,
    checksum: "sha256:REPLACE_WITH_64_HEX_CHECKSUM",
    blocker_state: "pending",
    rollback_reference: "work/rollback/REPLACE_WITH_STAGING_ROLLBACK_EVIDENCE.md"
  };
}

export function createStagingEvidenceTemplate({ candidateCommit, images = {} } = {}) {
  const target = createStagingTargetTemplate({ candidateCommit, images });
  return {
    version: STAGING_EVIDENCE_VERSION,
    environment: "staging",
    target,
    health_probe: createStagingProbeTemplate({ origin: target.origin }),
    attestation: createStagingAttestationTemplate({ candidateCommit: target.candidate_commit, origin: target.origin, images: target.images }),
    artifacts: createStagingArtifactsTemplate({ candidateCommit: target.candidate_commit }),
    records: STAGING_EVIDENCE_GATES.map((gate) => recordTemplate(gate))
  };
}

export function validateStagingEvidence(ledger, { candidateCommit, images = {}, owners = {} } = {}) {
  const errors = [];
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) return { ok: false, errors: ["must be an object"] };
  if (ledger.version !== STAGING_EVIDENCE_VERSION) errors.push(`version must be ${STAGING_EVIDENCE_VERSION}`);
  if (ledger.environment !== "staging") errors.push("environment must be staging");

  const target = ledger.target || {};
  const targetValidation = validateStagingTarget(target, { candidateCommit, images });
  errors.push(...targetValidation.errors.map((error) => `target.${error}`));
  const probeValidation = validateStagingProbe(ledger.health_probe, { origin: target.origin });
  errors.push(...probeValidation.errors.map((error) => `health_probe.${error}`));
  const attestationValidation = validateStagingAttestation(ledger.attestation, { candidateCommit, origin: target.origin, images });
  errors.push(...attestationValidation.errors.map((error) => `attestation.${error}`));

  const records = Array.isArray(ledger.records) ? ledger.records : [];
  const artifactsValidation = validateStagingArtifacts(ledger.artifacts, { candidateCommit, target, attestation: ledger.attestation, records });
  errors.push(...artifactsValidation.errors.map((error) => `artifacts.${error}`));
  const allowed = new Set(STAGING_EVIDENCE_GATES.map((gate) => gate.id));
  for (const record of records) if (!allowed.has(record?.id)) errors.push("records contain an unknown gate");
  for (const definition of STAGING_EVIDENCE_GATES) {
    const matches = records.filter((record) => record?.id === definition.id);
    if (matches.length !== 1) {
      errors.push(`${definition.id} must appear exactly once`);
      continue;
    }
    const record = matches[0];
    if (record.phase !== definition.phase) errors.push(`${definition.id}.phase must be ${definition.phase}`);
    if (record.gate !== definition.gate) errors.push(`${definition.id}.gate must preserve the required gate name`);
    if (!validText(record.requirement)) errors.push(`${definition.id}.requirement must be recorded`);
    if (!validText(record.owner)) errors.push(`${definition.id}.owner must name an accountable owner`);
    if (validText(owners[definition.owner_role]) && text(record.owner) !== text(owners[definition.owner_role])) errors.push(`${definition.id}.owner must match owners.${definition.owner_role}`);
    if (!validPastIso(record.captured_at)) errors.push(`${definition.id}.captured_at must be a past ISO timestamp`);
    if (record.environment !== "staging") errors.push(`${definition.id}.environment must be staging`);
    for (const field of ["action", "expected_result", "actual_result"]) if (!validText(record[field])) errors.push(`${definition.id}.${field} must be recorded without placeholders`);
    if (record.status !== "pass") errors.push(`${definition.id}.status must be pass`);
    if (!validReference(record.reference)) errors.push(`${definition.id}.reference must be an immutable evidence reference`);
    if (!CHECKSUM.test(text(record.checksum))) errors.push(`${definition.id}.checksum must be a sha256 checksum`);
    if (record.blocker_state !== "resolved") errors.push(`${definition.id}.blocker_state must be resolved`);
    if (!validReference(record.rollback_reference)) errors.push(`${definition.id}.rollback_reference must identify the staged rollback evidence`);
  }
  if (SECRET_VALUE.test(JSON.stringify(ledger))) errors.push("must not contain credential-like values");
  return { ok: errors.length === 0, errors };
}
