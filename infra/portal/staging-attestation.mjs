const SHA = /^[0-9a-f]{40}$/i;
const DIGEST = /^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$/;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;
const SECRET_VALUE = /(?:sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@|(?:OPENAI|SUPABASE|STRIPE)_[A-Z_]*(?:KEY|SECRET)[A-Z_]*\s*=\s*\S+)/i;

export const STAGING_ATTESTATION_VERSION = "1.0";

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

export function createStagingAttestationTemplate({ candidateCommit, origin, images = {} } = {}) {
  return {
    version: STAGING_ATTESTATION_VERSION,
    candidate_commit: candidateCommit || "REPLACE_WITH_40_CHARACTER_COMMIT_SHA",
    target_origin: origin || "https://REPLACE_WITH_STAGING_ORIGIN",
    images: {
      node: images.node || "node@sha256:REPLACE_WITH_64_HEX_DIGEST",
      ollama: images.ollama || "ollama/ollama@sha256:REPLACE_WITH_64_HEX_DIGEST",
      caddy: images.caddy || "caddy@sha256:REPLACE_WITH_64_HEX_DIGEST"
    },
    generated_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP",
    status: "pending",
    preflight: { status: "pending", reference: "work/staging/REPLACE_WITH_PREFLIGHT_REPORT.md", checksum: "sha256:REPLACE_WITH_64_HEX_CHECKSUM" },
    probe: { status: "pending", reference: "work/staging/REPLACE_WITH_PROBE_REPORT.json", checksum: "sha256:REPLACE_WITH_64_HEX_CHECKSUM" }
  };
}

export function validateStagingAttestation(attestation, { candidateCommit, origin, images = {} } = {}) {
  const errors = [];
  if (!attestation || typeof attestation !== "object" || Array.isArray(attestation)) return { ok: false, errors: ["must be an object"] };
  if (attestation.version !== STAGING_ATTESTATION_VERSION) errors.push(`version must be ${STAGING_ATTESTATION_VERSION}`);
  if (!SHA.test(text(attestation.candidate_commit))) errors.push("candidate_commit must be a 40-character commit SHA");
  if (candidateCommit && SHA.test(text(candidateCommit)) && text(attestation.candidate_commit) !== text(candidateCommit)) errors.push("candidate_commit must match the ship candidate");
  if (!/^https:\/\//.test(text(attestation.target_origin)) || PLACEHOLDER.test(text(attestation.target_origin))) errors.push("target_origin must be a non-placeholder HTTPS origin");
  if (origin && text(attestation.target_origin) !== text(origin)) errors.push("target_origin must match the staging target");
  for (const key of ["node", "ollama", "caddy"]) {
    if (!DIGEST.test(text(attestation.images?.[key]))) errors.push(`images.${key} must be an immutable @sha256 digest`);
    if (DIGEST.test(text(images[key])) && text(attestation.images?.[key]) !== text(images[key])) errors.push(`images.${key} must match the ship packet image`);
  }
  if (!validPastIso(attestation.generated_at)) errors.push("generated_at must be a past ISO timestamp");
  if (attestation.status !== "pass") errors.push("status must be pass");
  for (const kind of ["preflight", "probe"]) {
    const record = attestation[kind] || {};
    if (record.status !== "pass") errors.push(`${kind}.status must be pass`);
    if (!validReference(record.reference)) errors.push(`${kind}.reference must be an immutable evidence reference`);
    if (!CHECKSUM.test(text(record.checksum))) errors.push(`${kind}.checksum must be a sha256 checksum`);
  }
  if (SECRET_VALUE.test(JSON.stringify(attestation))) errors.push("must not contain credential-like values");
  return { ok: errors.length === 0, errors };
}
