const SHA = /^[0-9a-f]{40}$/i;
const DIGEST = /^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$/;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;
const SECRET_VALUE = /(?:sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@|(?:OPENAI|SUPABASE|STRIPE)_[A-Z_]*(?:KEY|SECRET)[A-Z_]*\s*=\s*\S+)/i;

export const STAGING_TARGET_VERSION = "1.0";

function text(value) {
  return String(value || "").trim();
}

function validReference(value) {
  const reference = text(value);
  return (/^https:\/\//.test(reference) || /^(?:work|infra)\//.test(reference)) && !PLACEHOLDER.test(reference);
}

function validOrigin(value) {
  try {
    const origin = new URL(text(value));
    return origin.protocol === "https:" && !PLACEHOLDER.test(origin.hostname) && origin.pathname === "/" && !origin.search && !origin.hash;
  } catch {
    return false;
  }
}

export function createStagingTargetTemplate({ candidateCommit, images = {} } = {}) {
  return {
    version: STAGING_TARGET_VERSION,
    environment: "staging",
    candidate_commit: candidateCommit || "REPLACE_WITH_40_CHARACTER_COMMIT_SHA",
    origin: "https://REPLACE_WITH_STAGING_ORIGIN",
    deployment_reference: "work/staging/REPLACE_WITH_DEPLOYMENT_REPORT.md",
    isolation_reference: "work/staging/REPLACE_WITH_ISOLATION_REPORT.md",
    secret_injection_reference: "work/staging/REPLACE_WITH_SECRET_INJECTION_REPORT.md",
    images: {
      node: images.node || "node@sha256:REPLACE_WITH_64_HEX_DIGEST",
      ollama: images.ollama || "ollama/ollama@sha256:REPLACE_WITH_64_HEX_DIGEST",
      caddy: images.caddy || "caddy@sha256:REPLACE_WITH_64_HEX_DIGEST"
    }
  };
}

export function validateStagingTarget(target, { candidateCommit, images = {} } = {}) {
  const errors = [];
  if (!target || typeof target !== "object" || Array.isArray(target)) return { ok: false, errors: ["must be an object"] };
  if (target.version !== STAGING_TARGET_VERSION) errors.push(`version must be ${STAGING_TARGET_VERSION}`);
  if (target.environment !== "staging") errors.push("environment must be staging");
  if (!SHA.test(text(target.candidate_commit))) errors.push("candidate_commit must be a 40-character commit SHA");
  if (candidateCommit && SHA.test(text(candidateCommit)) && text(target.candidate_commit) !== text(candidateCommit)) errors.push("candidate_commit must match the ship candidate");
  if (!validOrigin(target.origin)) errors.push("origin must be a non-placeholder HTTPS origin");
  for (const field of ["deployment_reference", "isolation_reference", "secret_injection_reference"]) if (!validReference(target[field])) errors.push(`${field} must be a non-placeholder evidence reference`);
  for (const key of ["node", "ollama", "caddy"]) {
    if (!DIGEST.test(text(target.images?.[key]))) errors.push(`images.${key} must be an immutable @sha256 digest`);
    if (DIGEST.test(text(images[key])) && text(target.images?.[key]) !== text(images[key])) errors.push(`images.${key} must match the ship packet image`);
  }
  if (SECRET_VALUE.test(JSON.stringify(target))) errors.push("must not contain credential-like values");
  return { ok: errors.length === 0, errors };
}
