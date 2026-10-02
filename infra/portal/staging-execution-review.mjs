import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectStagingArtifact, resolveStagingArtifactPath } from "./staging-artifacts.mjs";
import { validateStagingProbe } from "./staging-probe.mjs";
import { stagingPromotionAuthorizationChecksum, validateStagingPromotionAuthorization } from "./staging-promotion-authorization.mjs";

const SHA = /^[0-9a-f]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;

export const STAGING_EXECUTION_RECEIPT_VERSION = "1.0";
export const STAGING_EXECUTION_REVIEW_VERSION = "1.0";

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

function loadJsonArtifact({ root, reference }) {
  const inspection = inspectStagingArtifact({ root, reference });
  return { inspection, value: JSON.parse(fs.readFileSync(resolveStagingArtifactPath({ root, reference }), "utf8")) };
}

function withinAuthorizationWindow(executedAt, authorization) {
  const value = Date.parse(text(executedAt));
  const start = Date.parse(text(authorization.execution_window?.start));
  const end = Date.parse(text(authorization.execution_window?.end));
  return Number.isFinite(value) && Number.isFinite(start) && Number.isFinite(end) && value >= start && value <= end;
}

function statusFor(result) {
  return result.ok ? "pass" : "fail";
}

export function createStagingExecutionReceiptTemplate({ authorization } = {}) {
  return {
    version: STAGING_EXECUTION_RECEIPT_VERSION,
    status: "pending",
    authorization_checksum: authorization ? stagingPromotionAuthorizationChecksum(authorization) : "sha256:REPLACE_WITH_64_HEX_CHECKSUM",
    operator: "REPLACE_WITH_NAMED_OPERATOR",
    executed_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP",
    operation: {
      reference: "work/staging/REPLACE_WITH_NON_SECRET_OPERATION_RECORD.md",
      checksum: "sha256:REPLACE_WITH_64_HEX_CHECKSUM",
      bytes: null
    },
    post_execution_probe: {
      reference: "work/staging/REPLACE_WITH_POST_EXECUTION_PROBE.json",
      checksum: "sha256:REPLACE_WITH_64_HEX_CHECKSUM"
    }
  };
}

export function validateStagingExecutionReceipt(receipt, { authorization, operation, probe, probeInspection, now = Date.now() } = {}) {
  const errors = [];
  const nowMs = new Date(now).getTime();
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return { ok: false, errors: ["must be an object"] };
  if (receipt.version !== STAGING_EXECUTION_RECEIPT_VERSION) errors.push(`version must be ${STAGING_EXECUTION_RECEIPT_VERSION}`);
  if (receipt.status !== "recorded") errors.push("status must be recorded");
  if (!CHECKSUM.test(text(receipt.authorization_checksum))) errors.push("authorization_checksum must be a sha256 checksum");
  if (authorization && text(receipt.authorization_checksum) !== stagingPromotionAuthorizationChecksum(authorization)) errors.push("authorization_checksum must match the promotion authorization");
  if (text(receipt.operator).length < 2 || PLACEHOLDER.test(text(receipt.operator))) errors.push("operator must name the human operator");
  const executedAt = Date.parse(text(receipt.executed_at));
  if (!Number.isFinite(executedAt) || executedAt > nowMs) errors.push("executed_at must be a past ISO timestamp");
  if (authorization && !withinAuthorizationWindow(receipt.executed_at, authorization)) errors.push("executed_at must fall within the approved execution window");
  if (!receipt.operation || text(receipt.operation.reference) !== text(operation?.reference) || text(receipt.operation.checksum) !== text(operation?.checksum) || receipt.operation.bytes !== operation?.bytes) errors.push("operation must match the inspected local operation record");
  if (!receipt.post_execution_probe || text(receipt.post_execution_probe.reference) !== text(probeInspection?.reference) || text(receipt.post_execution_probe.checksum) !== text(probeInspection?.checksum)) errors.push("post_execution_probe must match the inspected local probe artifact");
  const probeValidation = validateStagingProbe(probe, { origin: authorization?.staging_origin });
  errors.push(...probeValidation.errors.map((error) => `post_execution_probe.${error}`));
  const capturedAt = Date.parse(text(probe?.captured_at));
  if (Number.isFinite(executedAt) && Number.isFinite(capturedAt) && capturedAt < executedAt) errors.push("post_execution_probe.captured_at must not predate execution");
  return { ok: errors.length === 0, errors: errors.map(redactedError) };
}

export function buildStagingExecutionReview({ root = process.cwd(), authorizationReference, receiptReference, probeReference, now = new Date().toISOString() } = {}) {
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new Error("now must be a valid timestamp.");
  const authorizationArtifact = loadJsonArtifact({ root, reference: authorizationReference });
  const receiptArtifact = loadJsonArtifact({ root, reference: receiptReference });
  const probeArtifact = loadJsonArtifact({ root, reference: probeReference });
  const authorization = authorizationArtifact.value;
  const receipt = receiptArtifact.value;
  const operation = inspectStagingArtifact({ root, reference: receipt.operation?.reference });
  const authorizationValidation = validateStagingPromotionAuthorization(authorization, { now: nowMs });
  const authorizationReady = authorization.status === "pending_operator_execution";
  const probeValidation = validateStagingProbe(probeArtifact.value, { origin: authorization.staging_origin });
  const receiptValidation = validateStagingExecutionReceipt(receipt, { authorization, operation, probe: probeArtifact.value, probeInspection: probeArtifact.inspection, now: nowMs });
  const checks = [
    { id: "authorization_integrity", status: authorizationReady && authorizationValidation.ok ? "pass" : "fail", error_count: authorizationValidation.errors.length + (authorizationReady ? 0 : 1) },
    { id: "execution_receipt", status: statusFor(receiptValidation), error_count: receiptValidation.errors.length },
    { id: "post_execution_probe", status: statusFor(probeValidation), error_count: probeValidation.errors.length },
    { id: "external_release_gate", status: "pending", error_count: 0 }
  ];
  const blockers = [...authorizationValidation.errors, ...receiptValidation.errors, ...probeValidation.errors];
  if (!authorizationReady) blockers.push("authorization is not pending operator execution");
  const verified = checks.slice(0, 3).every((check) => check.status === "pass");
  return {
    version: STAGING_EXECUTION_REVIEW_VERSION,
    reviewed_at: new Date(nowMs).toISOString(),
    status: verified ? "awaiting_external_release_gate" : "blocked",
    candidate_commit: SHA.test(text(authorization.candidate_commit)) ? text(authorization.candidate_commit) : null,
    staging_origin: validOrigin(authorization.staging_origin) ? text(authorization.staging_origin) : null,
    authorization: { reference: text(authorizationReference), checksum: authorizationArtifact.inspection.checksum, canonical_checksum: stagingPromotionAuthorizationChecksum(authorization) },
    receipt: { reference: text(receiptReference), checksum: receiptArtifact.inspection.checksum, operator: text(receipt.operator), executed_at: text(receipt.executed_at), operation },
    post_execution_probe: { reference: text(probeReference), checksum: probeArtifact.inspection.checksum, captured_at: text(probeArtifact.value.captured_at) },
    checks,
    external_release_gate: { status: "pending", restriction: "This evidence review does not approve production, publish a release, or change traffic." },
    blockers: blockers.map(redactedError)
  };
}

export function validateStagingExecutionReview(review, { now = Date.now() } = {}) {
  const errors = [];
  const nowMs = new Date(now).getTime();
  if (!review || typeof review !== "object" || Array.isArray(review)) return { ok: false, errors: ["must be an object"] };
  if (review.version !== STAGING_EXECUTION_REVIEW_VERSION) errors.push(`version must be ${STAGING_EXECUTION_REVIEW_VERSION}`);
  if (!Number.isFinite(Date.parse(text(review.reviewed_at))) || Date.parse(text(review.reviewed_at)) > nowMs) errors.push("reviewed_at must be a past ISO timestamp");
  if (!["blocked", "awaiting_external_release_gate"].includes(review.status)) errors.push("status must remain blocked or awaiting_external_release_gate");
  if (review.status === "awaiting_external_release_gate" && (!SHA.test(text(review.candidate_commit)) || !validOrigin(review.staging_origin))) errors.push("a waiting review needs a candidate and staging origin");
  const checks = Array.isArray(review.checks) ? review.checks : [];
  for (const id of ["authorization_integrity", "execution_receipt", "post_execution_probe", "external_release_gate"]) if (checks.filter((check) => check?.id === id).length !== 1) errors.push(`${id} must appear exactly once`);
  if (checks.find((check) => check?.id === "external_release_gate")?.status !== "pending" || review.external_release_gate?.status !== "pending") errors.push("external_release_gate must remain pending");
  if (review.status === "awaiting_external_release_gate" && checks.filter((check) => check?.id !== "external_release_gate").some((check) => check.status !== "pass" || check.error_count !== 0)) errors.push("a waiting review requires all execution checks to pass");
  if (review.status === "awaiting_external_release_gate" && (!Array.isArray(review.blockers) || review.blockers.length !== 0)) errors.push("a waiting review cannot retain blockers");
  if (review.status === "blocked" && (!Array.isArray(review.blockers) || review.blockers.length === 0)) errors.push("a blocked review must name a redacted blocker");
  return { ok: errors.length === 0, errors: errors.map(redactedError) };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const authorization = argumentValue(args, "--authorization");
  const receipt = argumentValue(args, "--receipt");
  const probe = argumentValue(args, "--probe");
  const output = argumentValue(args, "--output");
  if (!authorization || !receipt || !probe || !output) {
    console.error("Usage: node infra/portal/staging-execution-review.mjs --authorization work/staging/authorization.json --receipt work/staging/execution-receipt.json --probe work/staging/post-execution-probe.json --output work/staging/execution-review.json");
    process.exitCode = 1;
  } else {
    try {
      const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const review = buildStagingExecutionReview({ root, authorizationReference: authorization, receiptReference: receipt, probeReference: probe });
      const destination = path.resolve(output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(review, null, 2)}\n`);
      console.log(`Staging execution review: ${destination}`);
      if (review.status !== "awaiting_external_release_gate") process.exitCode = 2;
    } catch (error) {
      console.error(`Unable to build staging execution review: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
