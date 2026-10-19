import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { productionBuildSubmissionChecksum, validateProductionBuildSubmission } from "./production-build-submission.mjs";

const VERSION = "1.0";
const SHA = /^[a-f0-9]{40}$/i;
const INPUT_KEYS = Object.freeze(["hosting_provider", "production_origin", "portal_domain", "deployment_project_or_service", "supabase_project_reference", "database_host_reference", "secret_manager_provider", "secret_manager_path_reference", "node_image_digest", "api_image_digest", "web_image_digest", "ollama_image_digest", "caddy_image_digest", "support_owner_name", "support_owner_email", "monitoring_dashboard_url", "incident_route_reference", "accessibility_report_url", "accessibility_validated_at", "rollback_artifact_reference"]);
const DECISION_KEYS = Object.freeze(["local_ai_posture", "enable_subscriptions_for_launch", "stripe_launch_mode", "retention_policy_approved", "customer_image_production_storage_approved"]);
const SECRET_REFERENCE_KEYS = Object.freeze(["database_url_secret_name", "supabase_anon_key_secret_name", "supabase_service_role_key_secret_name", "stripe_secret_key_secret_name", "stripe_webhook_secret_name", "notification_webhook_token_secret_name", "openai_api_key_secret_name_if_enabled", "openclaw_api_key_secret_name_if_enabled"]);
const APPROVAL_KEYS = Object.freeze(["primary_accountable_owner", "production_configuration_owner", "database_migration_owner", "billing_owner", "support_owner", "security_and_privacy_owner", "accessibility_sign_off_owner", "rollback_owner", "release_execution_owner", "post_launch_review_owner", "final_closeout_owner", "go_no_go_owner", "approved_launch_window_iso"]);
const EVIDENCE_REFERENCE_KEYS = Object.freeze(["production_configuration", "hosting_target", "database_target", "secret_manager", "backup_restore", "support_owner", "accessibility_report", "rollback_authority", "launch_approval", "github_receipt", "drive_receipt"]);

function text(value) { return String(value || "").trim(); }
function keysObject(keys) { return Object.fromEntries(keys.map((key) => [key, null])); }
function canonical(document) { const { intake_checksum: _ignored, ...unsigned } = document || {}; return JSON.stringify(unsigned, (_key, value) => !value || typeof value !== "object" || Array.isArray(value) ? value : Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]))); }
function safeField(value) {
  const candidate = text(value); if (!candidate) return true;
  return !/(?:\b(?:sk|whsec|xox[bap])-|-----BEGIN|postgres(?:ql)?:\/\/[^\s/@]+:[^\s/@]+@|\b(?:api[_-]?key|password|token)\s*[=:])/i.test(candidate);
}
function exactNullableKeys(value, keys) { return value && typeof value === "object" && !Array.isArray(value) && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()) && Object.values(value).every((item) => item === null || (typeof item === "string" && safeField(item))); }

export function productionBuildIntakeChecksum(document) { return `sha256:${createHash("sha256").update(canonical(document)).digest("hex")}`; }

export function validateProductionBuildIntake(document, { now = Date.now() } = {}) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["intake must be an object"] };
  if (document.version !== VERSION) errors.push(`intake version must be ${VERSION}`);
  if (!SHA.test(text(document.candidate_commit))) errors.push("intake candidate_commit must be a commit SHA");
  if (!/^sha256:[a-f0-9]{64}$/.test(text(document.submission_checksum))) errors.push("intake submission_checksum must be a sha256 checksum");
  if (!Number.isFinite(Date.parse(text(document.generated_at))) || Date.parse(text(document.generated_at)) > now) errors.push("intake generated_at must be a past ISO timestamp");
  if (document.status !== "awaiting_operator_inputs") errors.push("intake must remain awaiting operator inputs");
  if (text(document.statement) !== "Intake only; do not enter secret values, deploy services, run migrations, transfer customer data, or change traffic from this record.") errors.push("intake must preserve its safety statement");
  if (!exactNullableKeys(document.non_secret_inputs, INPUT_KEYS)) errors.push("non_secret_inputs must retain its exact safe field set");
  if (!exactNullableKeys(document.decisions, DECISION_KEYS)) errors.push("decisions must retain its exact safe field set");
  if (!exactNullableKeys(document.secret_references_only, SECRET_REFERENCE_KEYS)) errors.push("secret_references_only must retain its exact safe field set");
  if (!exactNullableKeys(document.approvals, APPROVAL_KEYS)) errors.push("approvals must retain its exact safe field set");
  if (!exactNullableKeys(document.evidence_references, EVIDENCE_REFERENCE_KEYS)) errors.push("evidence_references must retain its exact safe field set");
  if (!Array.isArray(document.required_evidence) || document.required_evidence.length !== EVIDENCE_REFERENCE_KEYS.length || document.required_evidence.some((entry) => !entry || !EVIDENCE_REFERENCE_KEYS.includes(entry.id) || typeof entry.requirement !== "string" || entry.status !== "awaiting_reference")) errors.push("required_evidence must contain only bounded awaiting-reference entries");
  if (text(document.intake_checksum) !== productionBuildIntakeChecksum(document)) errors.push("intake_checksum must match the complete canonical intake");
  return { ok: errors.length === 0, errors };
}

export function buildProductionBuildIntake({ submission, now = new Date().toISOString() } = {}) {
  const submissionValidation = validateProductionBuildSubmission(submission);
  if (!submissionValidation.ok) throw new Error(`submission is invalid: ${submissionValidation.errors.join("; ")}`);
  if (submission.status !== "blocked_on_production_inputs") throw new Error("submission must retain the production-input hold");
  if (text(submission.submission_checksum) !== productionBuildSubmissionChecksum(submission)) throw new Error("submission checksum must match before intake");
  const document = {
    version: VERSION,
    candidate_commit: submission.candidate_commit,
    submission_checksum: submission.submission_checksum,
    generated_at: new Date(now).toISOString(),
    status: "awaiting_operator_inputs",
    statement: "Intake only; do not enter secret values, deploy services, run migrations, transfer customer data, or change traffic from this record.",
    non_secret_inputs: keysObject(INPUT_KEYS),
    decisions: keysObject(DECISION_KEYS),
    secret_references_only: keysObject(SECRET_REFERENCE_KEYS),
    approvals: keysObject(APPROVAL_KEYS),
    evidence_references: keysObject(EVIDENCE_REFERENCE_KEYS),
    required_evidence: submission.on_hold.map(({ id, requirement }) => ({ id, requirement, status: "awaiting_reference" })),
    instructions: ["Enter identifiers, decisions, owner names, and evidence references only.", "Keep all secret values in the approved secret manager; record only a secret name or path.", "Keep subscriptions and production customer-image storage disabled until their separate approvals and validation are complete."]
  };
  return { ...document, intake_checksum: productionBuildIntakeChecksum(document) };
}

function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2); const submissionFile = argumentValue(args, "--submission"); const output = argumentValue(args, "--output"); const generatedAt = argumentValue(args, "--generated-at");
  if (!submissionFile || !output) { console.error("Usage: node infra/portal/production-build-intake.mjs --submission work/production/submission.json --output work/production/intake.json [--generated-at <ISO timestamp>]"); process.exitCode = 1; }
  else { const submission = JSON.parse(fs.readFileSync(path.resolve(submissionFile), "utf8")); const document = buildProductionBuildIntake({ submission, now: generatedAt || new Date().toISOString() }); const result = validateProductionBuildIntake(document); if (!result.ok) throw new Error(result.errors.join("; ")); const destination = path.resolve(output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Production build intake: ${destination}`); }
}
