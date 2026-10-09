import fs from "node:fs";
import { utcTimestamp, sameExecutionWindow } from "./approval-window.mjs";
import { isAccountableOwner, accountableOwnerError } from "./ownership.mjs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectStagingArtifact, resolveStagingArtifactPath } from "./staging-artifacts.mjs";
import { canonicalChecksum } from "./staging-evidence-review.mjs";
import { DEFAULT_STAGING_APPROVAL_MAX_AGE_MINUTES, STAGING_PROMOTION_APPROVAL_ROLES, validateStagingPromotionApproval } from "./staging-promotion-approval.mjs";
import { stagingPromotionHandoffChecksum, validateStagingPromotionHandoff } from "./staging-promotion-handoff.mjs";

const SHA = /^[0-9a-f]{40}$/i;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;

export const STAGING_PROMOTION_AUTHORIZATION_VERSION = "1.1";

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

function approvalArtifactPath(approval) {
  const reference = approval?.artifact?.reference;
  if (typeof reference !== "string" || reference !== reference.trim()) return null;
  try {
    const resolved = resolveStagingArtifactPath({ reference });
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  } catch {
    return null;
  }
}

function statusFor(result) {
  return result.ok ? "pass" : "fail";
}

export function stagingPromotionAuthorizationChecksum(authorization) {
  return canonicalChecksum(authorization);
}

export function buildStagingPromotionAuthorization({ root = process.cwd(), handoffReference, releaseApprovalReference, platformApprovalReference, now = new Date().toISOString(), maxApprovalAgeMinutes = DEFAULT_STAGING_APPROVAL_MAX_AGE_MINUTES } = {}) {
  const nowMs = new Date(now).getTime();
  const approvalAgeMinutes = Number(maxApprovalAgeMinutes);
  if (!Number.isFinite(nowMs)) throw new Error("now must be a valid timestamp.");
  if (!Number.isInteger(approvalAgeMinutes) || approvalAgeMinutes < 1 || approvalAgeMinutes > 1440) throw new Error("maxApprovalAgeMinutes must be an integer between 1 and 1440.");
  const handoffArtifact = loadJsonArtifact({ root, reference: handoffReference });
  const releaseArtifact = loadJsonArtifact({ root, reference: releaseApprovalReference });
  const platformArtifact = loadJsonArtifact({ root, reference: platformApprovalReference });
  const handoff = handoffArtifact.value;
  const approvals = [releaseArtifact.value, platformArtifact.value];
  const handoffValidation = validateStagingPromotionHandoff(handoff, { now: nowMs });
  const approvalResults = approvals.map((approval) => validateStagingPromotionApproval(approval, { handoff, now: nowMs, maxAgeMinutes: approvalAgeMinutes }));
  const roles = approvals.map((approval) => approval.role);
  const roleSetValid = roles[0] === "release" && roles[1] === "platform";
  const windowValid = roleSetValid && sameExecutionWindow(approvals[0]?.execution_window, approvals[1]?.execution_window);
  const handoffReady = handoff.status === "pending_human_promotion_approval";
  const checks = [
    { id: "handoff_integrity", status: handoffReady && handoffValidation.ok ? "pass" : "fail", error_count: handoffValidation.errors.length + (handoffReady ? 0 : 1) },
    { id: "release_approval", status: statusFor(approvalResults[0]), error_count: approvalResults[0].errors.length },
    { id: "platform_approval", status: statusFor(approvalResults[1]), error_count: approvalResults[1].errors.length },
    { id: "shared_execution_window", status: windowValid ? "pass" : "fail", error_count: windowValid ? 0 : 1 },
    { id: "operator_execution", status: "pending", error_count: 0 }
  ];
  const blockers = [...handoffValidation.errors, ...approvalResults.flatMap((result) => result.errors)];
  if (!handoffReady) blockers.push("handoff is not pending human promotion approval");
  if (!roleSetValid) blockers.push("release and platform approval records must appear exactly once");
  if (!windowValid) blockers.push("release and platform approvals must share one execution window");
  const readyForOperator = checks.slice(0, 4).every((check) => check.status === "pass");
  return {
    version: STAGING_PROMOTION_AUTHORIZATION_VERSION,
    created_at: new Date(nowMs).toISOString(),
    max_approval_age_minutes: approvalAgeMinutes,
    status: readyForOperator ? "pending_operator_execution" : "blocked",
    candidate_commit: SHA.test(text(handoff.candidate_commit)) ? text(handoff.candidate_commit) : null,
    staging_origin: validOrigin(handoff.staging_origin) ? text(handoff.staging_origin) : null,
    handoff: { reference: text(handoffReference), checksum: handoffArtifact.inspection.checksum, canonical_checksum: stagingPromotionHandoffChecksum(handoff), bytes: handoffArtifact.inspection.bytes },
    approvals: approvals.map((approval, index) => ({ version: approval.version, decision: approval.decision, role: approval.role, approver: approval.approver, approved_at: approval.approved_at, handoff_checksum: approval.handoff_checksum, execution_window: approval.execution_window, reference: approval.reference, artifact: { reference: index === 0 ? text(releaseApprovalReference) : text(platformApprovalReference), checksum: index === 0 ? releaseArtifact.inspection.checksum : platformArtifact.inspection.checksum } })),
    execution_window: windowValid ? approvals[0].execution_window : null,
    checks,
    operator_execution: { status: "pending", restriction: "No deployment, traffic, or publish command is included in this authorization artifact." },
    blockers: blockers.map(redactedError)
  };
}

export function validateStagingPromotionAuthorization(authorization, { now = Date.now() } = {}) {
  const errors = [];
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) errors.push("now must be a valid timestamp");
  if (!authorization || typeof authorization !== "object" || Array.isArray(authorization)) return { ok: false, errors: ["must be an object"] };
  if (authorization.version !== STAGING_PROMOTION_AUTHORIZATION_VERSION) errors.push(`version must be ${STAGING_PROMOTION_AUTHORIZATION_VERSION}`);
  const issuedAt = utcTimestamp(authorization.created_at);
  if (!Number.isFinite(issuedAt) || issuedAt > nowMs) errors.push("created_at must be a past UTC ISO timestamp");
  if (!["blocked", "pending_operator_execution"].includes(authorization.status)) errors.push("status must remain blocked or pending_operator_execution");
  if (authorization.status === "pending_operator_execution" && (!SHA.test(text(authorization.candidate_commit)) || !validOrigin(authorization.staging_origin))) errors.push("a pending operator authorization needs a candidate and staging origin");
  if (!/^sha256:[a-f0-9]{64}$/i.test(text(authorization.handoff?.checksum)) || !/^sha256:[a-f0-9]{64}$/i.test(text(authorization.handoff?.canonical_checksum))) errors.push("authorization must bind the handoff checksums");
  const roles = Array.isArray(authorization.approvals) ? authorization.approvals.map((approval) => approval?.role) : [];
  if (authorization.status === "pending_operator_execution") {
    if (!Number.isInteger(authorization.max_approval_age_minutes) || authorization.max_approval_age_minutes < 1 || authorization.max_approval_age_minutes > 1440) errors.push("max_approval_age_minutes must be an integer between 1 and 1440");
    if (roles.length !== 2) errors.push("authorization requires exactly two separate approval records");
    for (const approval of Array.isArray(authorization.approvals) ? authorization.approvals : []) {
      if (!isAccountableOwner(approval?.approver)) errors.push(accountableOwnerError("approvals.approver"));
      // Revalidate at issuance, not at audit time: historical receipts remain auditable.
      const validation = validateStagingPromotionApproval(approval, { now: issuedAt, maxAgeMinutes: authorization.max_approval_age_minutes });
      errors.push(...validation.errors.map(error => `approvals.${error}`));
      if (approval?.handoff_checksum !== authorization.handoff?.canonical_checksum) errors.push("approval must bind the authorization handoff");
      if (!sameExecutionWindow(approval?.execution_window, authorization.execution_window)) errors.push("approval must bind the exact shared execution window");
      if (!approvalArtifactPath(approval) || !/^sha256:[a-f0-9]{64}$/i.test(text(approval?.artifact?.checksum))) errors.push("approval must bind its inspected local artifact");
    }
    const references = Array.isArray(authorization.approvals) ? authorization.approvals.map(approvalArtifactPath) : [];
    if (new Set(references).size !== 2) errors.push("approval artifacts must remain separate");
  }
  for (const role of STAGING_PROMOTION_APPROVAL_ROLES) if (roles.filter((value) => value === role).length !== 1) errors.push(`approvals must contain exactly one ${role} approval`);
  const checks = Array.isArray(authorization.checks) ? authorization.checks : [];
  if (checks.length !== 5) errors.push("authorization requires exactly five checks");
  for (const id of ["handoff_integrity", "release_approval", "platform_approval", "shared_execution_window", "operator_execution"]) if (checks.filter((check) => check?.id === id).length !== 1) errors.push(`${id} must appear exactly once`);
  if (checks.find((check) => check?.id === "operator_execution")?.status !== "pending" || authorization.operator_execution?.status !== "pending") errors.push("operator execution must remain pending");
  if (authorization.status === "pending_operator_execution" && checks.some(check => check?.error_count !== 0)) errors.push("a pending operator authorization cannot retain check errors");
  if (authorization.status === "pending_operator_execution" && checks.filter((check) => check?.id !== "operator_execution").some((check) => check?.status !== "pass" || check?.error_count !== 0)) errors.push("a pending operator authorization requires all approval checks to pass");
  if (authorization.status === "pending_operator_execution" && (!Array.isArray(authorization.blockers) || authorization.blockers.length !== 0)) errors.push("a pending operator authorization cannot retain blockers");
  if (authorization.status === "blocked" && (!Array.isArray(authorization.blockers) || authorization.blockers.length === 0)) errors.push("a blocked authorization must name a redacted blocker");
  return { ok: errors.length === 0, errors: errors.map(redactedError) };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const handoff = argumentValue(args, "--handoff");
  const releaseApproval = argumentValue(args, "--release-approval");
  const platformApproval = argumentValue(args, "--platform-approval");
  const output = argumentValue(args, "--output");
  const maxApprovalAgeMinutes = argumentValue(args, "--max-approval-age-minutes") || DEFAULT_STAGING_APPROVAL_MAX_AGE_MINUTES;
  if (!handoff || !releaseApproval || !platformApproval || !output) {
    console.error("Usage: node infra/portal/staging-promotion-authorization.mjs --handoff work/staging/handoff.json --release-approval work/approvals/release.json --platform-approval work/approvals/platform.json --output work/staging/authorization.json [--max-approval-age-minutes 60]");
    process.exitCode = 1;
  } else {
    try {
      const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const authorization = buildStagingPromotionAuthorization({ root, handoffReference: handoff, releaseApprovalReference: releaseApproval, platformApprovalReference: platformApproval, maxApprovalAgeMinutes });
      const destination = path.resolve(output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(authorization, null, 2)}\n`);
      console.log(`Staging promotion authorization: ${destination}`);
      if (authorization.status !== "pending_operator_execution") process.exitCode = 2;
    } catch (error) {
      console.error(`Unable to build staging promotion authorization: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
