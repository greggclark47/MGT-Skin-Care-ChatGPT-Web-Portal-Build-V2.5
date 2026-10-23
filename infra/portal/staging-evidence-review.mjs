import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { STAGING_ARTIFACT_IDS, verifyStagingArtifacts } from "./staging-artifacts.mjs";
import { validateStagingEvidence } from "./staging-evidence.mjs";

export const STAGING_EVIDENCE_REVIEW_VERSION = "1.0";
export const DEFAULT_STAGING_REVIEW_MAX_AGE_MINUTES = 60;

function text(value) {
  return String(value || "").trim();
}

function redactedError(error) {
  return String(error || "").replace(/(?:sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres(?:ql)?:\/\/\S+|(?:OPENAI|SUPABASE|STRIPE)_[A-Z_]*\s*=\s*\S+)/gi, "[redacted]");
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  return value;
}

function validPastIso(value, now) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) && parsed <= now;
}

export function canonicalChecksum(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(canonicalValue(value))).digest("hex")}`;
}

export function stagingLedgerChecksum(ledger) {
  return canonicalChecksum(ledger);
}

export function validateStagingEvidenceReview(review, { ledger, now = Date.now(), maxAgeMinutes = DEFAULT_STAGING_REVIEW_MAX_AGE_MINUTES } = {}) {
  const errors = [];
  const nowMs = new Date(now).getTime();
  const maxAgeMs = Number(maxAgeMinutes) * 60 * 1000;
  if (!review || typeof review !== "object" || Array.isArray(review)) return { ok: false, errors: ["must be an object"] };
  if (review.version !== STAGING_EVIDENCE_REVIEW_VERSION) errors.push(`version must be ${STAGING_EVIDENCE_REVIEW_VERSION}`);
  if (!Number.isFinite(nowMs)) errors.push("now must be a valid timestamp");
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 60 * 1000 || maxAgeMs > 24 * 60 * 60 * 1000) errors.push("maxAgeMinutes must be between 1 and 1440");
  const reviewedAt = Date.parse(text(review.reviewed_at));
  if (!validPastIso(review.reviewed_at, nowMs)) errors.push("reviewed_at must be a past ISO timestamp");
  if (Number.isFinite(reviewedAt) && Number.isFinite(maxAgeMs) && nowMs - reviewedAt > maxAgeMs) errors.push("reviewed_at exceeds the permitted freshness window");
  if (review.status !== "pass") errors.push("status must be pass");
  if (!/^[0-9a-f]{40}$/i.test(text(review.candidate_commit))) errors.push("candidate_commit must be a 40-character commit SHA");
  if (!/^sha256:[a-f0-9]{64}$/i.test(text(review.ledger_checksum))) errors.push("ledger_checksum must be a sha256 checksum");
  if (ledger) {
    const targetCommit = text(ledger.target?.candidate_commit);
    if (/^[0-9a-f]{40}$/i.test(targetCommit) && text(review.candidate_commit) !== targetCommit) errors.push("candidate_commit must match the staged ledger");
    if (text(review.ledger_checksum) !== stagingLedgerChecksum(ledger)) errors.push("ledger_checksum must match the staged ledger");
  }
  const checks = Array.isArray(review.checks) ? review.checks : [];
  for (const id of ["ledger_contract", "local_artifact_integrity"]) {
    const matches = checks.filter((check) => check?.id === id);
    if (matches.length !== 1 || matches[0].status !== "pass" || !Number.isSafeInteger(matches[0].error_count) || matches[0].error_count !== 0) errors.push(`${id} must be a passing zero-error check`);
  }
  const verified = Array.isArray(review.verified_artifacts) ? review.verified_artifacts : [];
  if (verified.length !== STAGING_ARTIFACT_IDS.length || STAGING_ARTIFACT_IDS.some((id) => !verified.includes(id))) errors.push("verified_artifacts must contain every required artifact exactly once");
  if (!Array.isArray(review.errors) || review.errors.length !== 0) errors.push("errors must be an empty array for a passing review");
  return { ok: errors.length === 0, errors: errors.map(redactedError) };
}

export function reviewStagingEvidence({ root = process.cwd(), ledger, now = new Date().toISOString() } = {}) {
  const target = ledger?.target || {};
  const evidence = validateStagingEvidence(ledger, {
    candidateCommit: target.candidate_commit,
    images: target.images,
    owners: {}
  });
  const artifacts = verifyStagingArtifacts({ root, artifacts: ledger?.artifacts });
  const checks = [
    { id: "ledger_contract", status: evidence.ok ? "pass" : "fail", error_count: evidence.errors.length },
    { id: "local_artifact_integrity", status: artifacts.ok ? "pass" : "fail", error_count: artifacts.errors.length }
  ];
  return {
    version: STAGING_EVIDENCE_REVIEW_VERSION,
    reviewed_at: new Date(now).toISOString(),
    status: checks.every((check) => check.status === "pass") ? "pass" : "fail",
    candidate_commit: /^[0-9a-f]{40}$/i.test(text(target.candidate_commit)) ? text(target.candidate_commit) : null,
    ledger_checksum: stagingLedgerChecksum(ledger),
    checks,
    errors: [...evidence.errors, ...artifacts.errors].map(redactedError),
    verified_artifacts: artifacts.verified
  };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const ledgerPath = argumentValue(args, "--ledger");
  const output = argumentValue(args, "--output");
  if (!ledgerPath || !output) {
    console.error("Usage: node infra/portal/staging-evidence-review.mjs --ledger path/to/staging-evidence.json --output work/staging/review.json");
    process.exitCode = 1;
  } else {
    try {
      const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const document = JSON.parse(fs.readFileSync(path.resolve(ledgerPath), "utf8"));
      const ledger = document.staging_evidence || document;
      const review = reviewStagingEvidence({ root, ledger });
      const destination = path.resolve(output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(review, null, 2)}\n`);
      console.log(`Staging evidence review: ${destination}`);
      if (review.status !== "pass") process.exitCode = 2;
    } catch (error) {
      console.error(`Unable to review staging evidence: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
