import { stagingPromotionHandoffChecksum } from "./staging-promotion-handoff.mjs";

const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;
const SECRET_VALUE = /(?:sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@|(?:OPENAI|SUPABASE|STRIPE)_[A-Z_]*\s*=\s*\S+)/i;

export const STAGING_PROMOTION_APPROVAL_VERSION = "1.0";
export const STAGING_PROMOTION_APPROVAL_ROLES = Object.freeze(["release", "platform"]);
export const DEFAULT_STAGING_APPROVAL_MAX_AGE_MINUTES = 60;

function text(value) {
  return String(value || "").trim();
}

function validReference(value) {
  const reference = text(value);
  return (/^https:\/\//.test(reference) || /^(?:work|infra)\//.test(reference)) && !PLACEHOLDER.test(reference);
}

function validApprovalWindow(window, now) {
  const start = Date.parse(text(window?.start));
  const end = Date.parse(text(window?.end));
  return Number.isFinite(start) && Number.isFinite(end) && start >= now && end > start && end - start <= 4 * 60 * 60 * 1000;
}

export function createStagingPromotionApprovalTemplate({ role, handoff } = {}) {
  return {
    version: STAGING_PROMOTION_APPROVAL_VERSION,
    role: role || "REPLACE_WITH_RELEASE_OR_PLATFORM_ROLE",
    decision: "pending",
    approver: "REPLACE_WITH_NAMED_APPROVER",
    approved_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP",
    handoff_checksum: handoff ? stagingPromotionHandoffChecksum(handoff) : "sha256:REPLACE_WITH_64_HEX_CHECKSUM",
    reference: "work/approvals/REPLACE_WITH_PROMOTION_APPROVAL.md",
    execution_window: {
      start: "REPLACE_WITH_FUTURE_ISO_TIMESTAMP",
      end: "REPLACE_WITH_FUTURE_ISO_TIMESTAMP"
    }
  };
}

export function validateStagingPromotionApproval(approval, { handoff, now = Date.now(), maxAgeMinutes = DEFAULT_STAGING_APPROVAL_MAX_AGE_MINUTES } = {}) {
  const errors = [];
  const nowMs = new Date(now).getTime();
  const maxAgeMs = Number(maxAgeMinutes) * 60 * 1000;
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) return { ok: false, errors: ["must be an object"] };
  if (approval.version !== STAGING_PROMOTION_APPROVAL_VERSION) errors.push(`version must be ${STAGING_PROMOTION_APPROVAL_VERSION}`);
  if (!STAGING_PROMOTION_APPROVAL_ROLES.includes(approval.role)) errors.push("role must be release or platform");
  if (approval.decision !== "approve") errors.push("decision must be approve");
  if (text(approval.approver).length < 2 || PLACEHOLDER.test(text(approval.approver))) errors.push("approver must name a human approver");
  const approvedAt = Date.parse(text(approval.approved_at));
  if (!Number.isFinite(approvedAt) || approvedAt > nowMs) errors.push("approved_at must be a past ISO timestamp");
  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 60 * 1000 || maxAgeMs > 24 * 60 * 60 * 1000) errors.push("maxAgeMinutes must be between 1 and 1440");
  if (Number.isFinite(approvedAt) && Number.isFinite(maxAgeMs) && nowMs - approvedAt > maxAgeMs) errors.push("approved_at exceeds the permitted freshness window");
  if (!CHECKSUM.test(text(approval.handoff_checksum))) errors.push("handoff_checksum must be a sha256 checksum");
  if (handoff && text(approval.handoff_checksum) !== stagingPromotionHandoffChecksum(handoff)) errors.push("handoff_checksum must match the promotion handoff");
  if (!validReference(approval.reference)) errors.push("reference must be a non-placeholder approval record");
  if (!validApprovalWindow(approval.execution_window, nowMs)) errors.push("execution_window must be a future window of four hours or less");
  if (SECRET_VALUE.test(JSON.stringify(approval))) errors.push("must not contain credential-like values");
  return { ok: errors.length === 0, errors };
}
