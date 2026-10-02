import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectStagingArtifact, resolveStagingArtifactPath } from "./staging-artifacts.mjs";
import { canonicalChecksum, DEFAULT_STAGING_REVIEW_MAX_AGE_MINUTES, validateStagingEvidenceReview } from "./staging-evidence-review.mjs";
import { validateStagingEvidence } from "./staging-evidence.mjs";

const SHA = /^[0-9a-f]{40}$/i;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;

export const STAGING_PROMOTION_HANDOFF_VERSION = "1.0";

function text(value) {
  return String(value || "").trim();
}

function redactedError(error) {
  return String(error || "").replace(/(?:sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres(?:ql)?:\/\/\S+|(?:OPENAI|SUPABASE|STRIPE)_[A-Z_]*\s*=\s*\S+)/gi, "[redacted]");
}

function validOrigin(value) {
  try {
    const origin = new URL(text(value));
    return origin.protocol === "https:" && origin.pathname === "/" && !origin.search && !origin.hash && !PLACEHOLDER.test(origin.hostname);
  } catch {
    return false;
  }
}

function validHandoffTime(value, now) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) && parsed <= now;
}

function loadJsonArtifact({ root, reference }) {
  const inspection = inspectStagingArtifact({ root, reference });
  return { inspection, value: JSON.parse(fs.readFileSync(resolveStagingArtifactPath({ root, reference }), "utf8")) };
}

function statusFor(result) {
  return result.ok ? "pass" : "fail";
}

export function stagingPromotionHandoffChecksum(handoff) {
  return canonicalChecksum(handoff);
}

export function buildStagingPromotionHandoff({ root = process.cwd(), ledgerReference, reviewReference, now = new Date().toISOString(), maxReviewAgeMinutes = DEFAULT_STAGING_REVIEW_MAX_AGE_MINUTES } = {}) {
  const nowMs = new Date(now).getTime();
  const reviewAgeMinutes = Number(maxReviewAgeMinutes);
  if (!Number.isFinite(nowMs)) throw new Error("now must be a valid timestamp.");
  if (!Number.isInteger(reviewAgeMinutes) || reviewAgeMinutes < 1 || reviewAgeMinutes > 1440) throw new Error("maxReviewAgeMinutes must be an integer between 1 and 1440.");
  const ledgerArtifact = loadJsonArtifact({ root, reference: ledgerReference });
  const reviewArtifact = loadJsonArtifact({ root, reference: reviewReference });
  const ledger = ledgerArtifact.value.staging_evidence || ledgerArtifact.value;
  const review = reviewArtifact.value;
  const evidence = validateStagingEvidence(ledger, { candidateCommit: ledger.target?.candidate_commit, images: ledger.target?.images, owners: {} });
  const reviewValidation = validateStagingEvidenceReview(review, { ledger, now: nowMs, maxAgeMinutes: reviewAgeMinutes });
  const target = ledger.target || {};
  const targetValid = SHA.test(text(target.candidate_commit)) && validOrigin(target.origin);
  const checks = [
    { id: "ledger_contract", status: statusFor(evidence), error_count: evidence.errors.length },
    { id: "review_binding", status: statusFor(reviewValidation), error_count: reviewValidation.errors.length },
    { id: "target_identity", status: targetValid ? "pass" : "fail", error_count: targetValid ? 0 : 1 },
    { id: "human_promotion_approval", status: "pending", error_count: 0 }
  ];
  const blockers = [...evidence.errors, ...reviewValidation.errors];
  if (!targetValid) blockers.push("staging target identity is incomplete or unsafe");
  const readyForHumanApproval = checks.slice(0, 3).every((check) => check.status === "pass");
  return {
    version: STAGING_PROMOTION_HANDOFF_VERSION,
    created_at: new Date(nowMs).toISOString(),
    status: readyForHumanApproval ? "pending_human_promotion_approval" : "blocked",
    candidate_commit: SHA.test(text(target.candidate_commit)) ? text(target.candidate_commit) : null,
    staging_origin: validOrigin(target.origin) ? text(target.origin) : null,
    images: target.images && typeof target.images === "object" ? { node: text(target.images.node), ollama: text(target.images.ollama), caddy: text(target.images.caddy) } : null,
    evidence: {
      ledger: { reference: text(ledgerReference), checksum: ledgerArtifact.inspection.checksum, bytes: ledgerArtifact.inspection.bytes },
      review: { reference: text(reviewReference), checksum: reviewArtifact.inspection.checksum, bytes: reviewArtifact.inspection.bytes, reviewed_at: text(review.reviewed_at), max_age_minutes: reviewAgeMinutes }
    },
    checks,
    required_human_approvals: ["release", "platform"],
    blockers: blockers.map(redactedError)
  };
}

export function validateStagingPromotionHandoff(handoff, { now = Date.now() } = {}) {
  const errors = [];
  const nowMs = new Date(now).getTime();
  if (!handoff || typeof handoff !== "object" || Array.isArray(handoff)) return { ok: false, errors: ["must be an object"] };
  if (handoff.version !== STAGING_PROMOTION_HANDOFF_VERSION) errors.push(`version must be ${STAGING_PROMOTION_HANDOFF_VERSION}`);
  if (!validHandoffTime(handoff.created_at, nowMs)) errors.push("created_at must be a past ISO timestamp");
  if (!["blocked", "pending_human_promotion_approval"].includes(handoff.status)) errors.push("status must remain blocked or pending_human_promotion_approval");
  if (handoff.status === "pending_human_promotion_approval" && (!SHA.test(text(handoff.candidate_commit)) || !validOrigin(handoff.staging_origin))) errors.push("a pending human handoff needs a candidate and staging origin");
  const checks = Array.isArray(handoff.checks) ? handoff.checks : [];
  for (const id of ["ledger_contract", "review_binding", "target_identity", "human_promotion_approval"]) {
    const matches = checks.filter((check) => check?.id === id);
    if (matches.length !== 1) errors.push(`${id} must appear exactly once`);
  }
  if (checks.find((check) => check?.id === "human_promotion_approval")?.status !== "pending") errors.push("human_promotion_approval must remain pending");
  if (handoff.status === "pending_human_promotion_approval" && checks.filter((check) => check?.id !== "human_promotion_approval").some((check) => check.status !== "pass" || check.error_count !== 0)) errors.push("a pending human handoff requires all automated checks to pass");
  if (!Array.isArray(handoff.required_human_approvals) || handoff.required_human_approvals.join(",") !== "release,platform") errors.push("release and platform human approvals are required");
  if (!handoff.evidence || !/^sha256:[a-f0-9]{64}$/i.test(text(handoff.evidence.ledger?.checksum)) || !/^sha256:[a-f0-9]{64}$/i.test(text(handoff.evidence.review?.checksum))) errors.push("handoff must bind both local artifact checksums");
  if (!Number.isInteger(handoff.evidence?.review?.max_age_minutes) || handoff.evidence.review.max_age_minutes < 1 || handoff.evidence.review.max_age_minutes > 1440) errors.push("handoff must retain a bounded review freshness window");
  if (handoff.status === "blocked" && (!Array.isArray(handoff.blockers) || handoff.blockers.length === 0)) errors.push("a blocked handoff must name a redacted blocker");
  if (handoff.status === "pending_human_promotion_approval" && Array.isArray(handoff.blockers) && handoff.blockers.length) errors.push("a pending human handoff cannot retain blockers");
  return { ok: errors.length === 0, errors: errors.map(redactedError) };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const ledger = argumentValue(args, "--ledger");
  const review = argumentValue(args, "--review");
  const output = argumentValue(args, "--output");
  const maxReviewAgeMinutes = argumentValue(args, "--max-review-age-minutes") || DEFAULT_STAGING_REVIEW_MAX_AGE_MINUTES;
  if (!ledger || !review || !output) {
    console.error("Usage: node infra/portal/staging-promotion-handoff.mjs --ledger work/staging/staging-evidence.json --review work/staging/review.json --output work/staging/handoff.json [--max-review-age-minutes 60]");
    process.exitCode = 1;
  } else {
    try {
      const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const handoff = buildStagingPromotionHandoff({ root, ledgerReference: ledger, reviewReference: review, maxReviewAgeMinutes });
      const destination = path.resolve(output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(handoff, null, 2)}\n`);
      console.log(`Staging promotion handoff: ${destination}`);
      if (handoff.status !== "pending_human_promotion_approval") process.exitCode = 2;
    } catch (error) {
      console.error(`Unable to build staging promotion handoff: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
