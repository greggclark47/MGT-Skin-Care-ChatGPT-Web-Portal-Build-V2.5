import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectReleaseArtifact } from "./release-export.mjs";
import { validateProductionEnvironmentReview } from "./production-environment-review.mjs";
import { utcTimestamp } from "./approval-window.mjs";
import { accountableOwnerError, isAccountableOwner } from "./ownership.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const VERSION = "1.1";
const GROUPS = Object.freeze({
  configuration: ["node_env", "demo_mode", "public_origin", "portal_domain", "database_url", "auto_migrate", "image_policy", "worker_policy", "backup_policy", "notification_policy"],
  hosting: ["hosting_account", "production_project", "staging_project", "dns_record", "tls_certificate", "edge_route", "api_origin", "web_origin", "health_route", "readiness_route"],
  database: ["database_identity", "migration_version", "migration_plan", "rls_policy", "session_isolation", "role_boundary", "transaction_rollback", "concurrency_probe", "retention_policy", "deletion_policy"],
  security: ["secret_manager", "secret_rotation", "credential_scan", "log_redaction", "transport_security", "csrf_policy", "origin_policy", "rate_limits", "audit_log", "incident_route"],
  identity: ["signup_flow", "signin_flow", "session_expiry", "password_reset", "account_deletion", "owner_visibility", "admin_boundary", "superadmin_boundary", "operator_audit", "consent_record"],
  operations: ["worker_startup", "worker_heartbeat", "worker_staleness", "backup_creation", "backup_checksum", "restore_drill", "restore_duration", "monitoring_dashboard", "alert_route", "rollback_target"],
  support: ["support_owner", "support_backup", "support_route", "support_coverage", "ticket_create", "ticket_status", "ticket_reply", "ticket_privacy", "ticket_audit", "support_escalation"],
  accessibility: ["keyboard_navigation", "focus_management", "escape_behavior", "screen_reader", "contrast", "zoom_reflow", "mobile_width", "browser_matrix", "reduced_motion", "forced_colors"],
  optional: ["catalog_approval", "content_approval", "billing_scope", "stripe_prices", "webhook_signature", "ai_scope", "ai_consent", "ai_spend_limit", "notification_scope", "partner_disclosure"],
  release: ["candidate_commit", "bundle_checksum", "image_digests", "staging_ledger", "production_gate", "owner_matrix", "launch_window", "go_no_go", "operator_receipt", "archive_receipt"]
});
export const PRODUCTION_EVIDENCE_RECORD_IDS = Object.freeze(Object.values(GROUPS).flat());
export const PRODUCTION_EVIDENCE_GROUP_COUNTS = Object.freeze(Object.fromEntries(Object.entries(GROUPS).map(([name, ids]) => [name, ids.length])));
function text(value) { return String(value || "").trim(); }
function canonicalize(value) { if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`; return JSON.stringify(value); }
export function productionEvidenceMatrixChecksum(document) { const { production_evidence_matrix_checksum: _ignored, ...unsigned } = document || {}; return `sha256:${createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`; }
function validPastIso(value, now) { const parsed = utcTimestamp(value); return Number.isFinite(parsed) && parsed <= new Date(now).getTime(); }
function inspectRecord({ root, id, record, now }) { if (!record || typeof record !== "object") throw new Error(`${id} record is required`); const inspected = inspectReleaseArtifact({ root, reference: record.reference }); if (record.checksum && text(record.checksum) !== inspected.checksum) throw new Error(`${id} checksum does not match its local artifact`); if (record.bytes != null && record.bytes !== inspected.bytes) throw new Error(`${id} byte count does not match its local artifact`); if (text(record.status) !== "pass") throw new Error(`${id} record status must be pass`); if (!isAccountableOwner(record.owner)) throw new Error(accountableOwnerError(`${id}.owner`)); if (!validPastIso(record.reviewed_at, now)) throw new Error(`${id} reviewed_at must be a past UTC ISO timestamp`); return { id, ...inspected, owner: record.owner, reviewed_at: record.reviewed_at, status: "pass" }; }
function readyEnvironmentErrors(environmentReview, now) {
  if (environmentReview?.status !== "ready_for_production_environment") return [];
  const prerequisiteReview = { candidate_commit: environmentReview.candidate_commit, prerequisite_review_checksum: environmentReview.prerequisite_review_checksum, status: "ready_for_prerequisite_review" };
  return validateProductionEnvironmentReview(environmentReview, { prerequisiteReview, now: Date.parse(now) }).errors.map((error) => `environment_review.${error}`);
}
export function buildProductionEvidenceMatrixReview({ root = process.cwd(), environmentReview, records = {}, now = new Date().toISOString() } = {}) { const baseErrors = []; if (!environmentReview || typeof environmentReview !== "object") baseErrors.push("environment review is required"); else { if (!SHA.test(text(environmentReview.candidate_commit))) baseErrors.push("environment review candidate_commit must be a commit SHA"); if (!CHECKSUM.test(text(environmentReview.production_environment_review_checksum))) baseErrors.push("environment review checksum is required"); if (environmentReview.status === "blocked") baseErrors.push("environment review is blocked"); baseErrors.push(...readyEnvironmentErrors(environmentReview, now)); }
  const recordErrors = []; const entries = []; for (const id of PRODUCTION_EVIDENCE_RECORD_IDS) { try { entries.push(inspectRecord({ root, id, record: records[id], now })); } catch (error) { recordErrors.push(error.message); } }
  const errors = [...baseErrors, ...recordErrors]; const status = baseErrors.length ? "blocked" : environmentReview?.status !== "ready_for_production_environment" ? "pending_environment_review" : recordErrors.length ? "pending_evidence_records" : "ready_for_production_evidence"; const document = { version: VERSION, candidate_commit: text(environmentReview?.candidate_commit), environment_review_checksum: text(environmentReview?.production_environment_review_checksum), generated_at: new Date(now).toISOString(), status, groups: PRODUCTION_EVIDENCE_GROUP_COUNTS, entries, errors }; return { ...document, production_evidence_matrix_checksum: productionEvidenceMatrixChecksum(document) }; }
export function validateProductionEvidenceMatrixStructure(document, { now = Date.now() } = {}) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["must be an object"] };
  if (document.version !== VERSION) errors.push(`version must be ${VERSION}`);
  if (!SHA.test(text(document.candidate_commit))) errors.push("candidate_commit must be a commit SHA");
  if (!CHECKSUM.test(text(document.environment_review_checksum))) errors.push("environment_review_checksum is required");
  if (!validPastIso(document.generated_at, now)) errors.push("generated_at must be a past UTC ISO timestamp");
  if (!CHECKSUM.test(text(document.production_evidence_matrix_checksum)) || text(document.production_evidence_matrix_checksum) !== productionEvidenceMatrixChecksum(document)) errors.push("production_evidence_matrix_checksum must match canonical matrix");
  if (!["blocked", "pending_environment_review", "pending_evidence_records", "ready_for_production_evidence"].includes(document.status)) errors.push("status must be known");
  if (!document.groups || typeof document.groups !== "object" || Array.isArray(document.groups)) errors.push("groups must be an object");
  else {
    const expectedNames = Object.keys(PRODUCTION_EVIDENCE_GROUP_COUNTS);
    const actualNames = Object.keys(document.groups);
    if (actualNames.length !== expectedNames.length || actualNames.some((name) => !expectedNames.includes(name))) errors.push("groups must contain the exact production evidence groups");
    for (const [name, count] of Object.entries(PRODUCTION_EVIDENCE_GROUP_COUNTS)) if (document.groups[name] !== count) errors.push(`${name} group must contain ${count} records`);
  }
  if (!Array.isArray(document.entries)) errors.push("entries must be an array");
  if (!Array.isArray(document.errors)) errors.push("errors must be an array");
  const entries = Array.isArray(document.entries) ? document.entries : [];
  const ready = document.status === "ready_for_production_evidence";
  for (const id of PRODUCTION_EVIDENCE_RECORD_IDS) {
    const count = entries.filter((entry) => entry?.id === id).length;
    if (count > 1 || (ready && count !== 1)) errors.push(`${id} must appear exactly once in a ready matrix`);
  }
  for (const entry of entries) {
    if (!entry || !PRODUCTION_EVIDENCE_RECORD_IDS.includes(entry.id)) { errors.push("entries contain an unknown production evidence record"); continue; }
    if (entry.status !== "pass") errors.push(`${entry.id} record status must be pass`);
    if (!isAccountableOwner(entry.owner)) errors.push(accountableOwnerError(`${entry.id}.owner`));
    if (!validPastIso(entry.reviewed_at, now)) errors.push(`${entry.id} reviewed_at must be a past UTC ISO timestamp`);
    if (typeof entry.reference !== "string" || !entry.reference) errors.push(`${entry.id} reference is required`);
    if (!CHECKSUM.test(text(entry.checksum))) errors.push(`${entry.id} checksum is required`);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 1) errors.push(`${entry.id} byte count must be positive`);
  }
  if (ready && (!Array.isArray(document.errors) || document.errors.length)) errors.push("ready production evidence matrix cannot contain errors");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
export function validateProductionEvidenceMatrixReview(document, { environmentReview, now = Date.now() } = {}) { const errors = [...validateProductionEvidenceMatrixStructure(document, { now }).errors]; if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors }; if (!SHA.test(text(document.candidate_commit)) || text(document.candidate_commit) !== text(environmentReview?.candidate_commit)) errors.push("candidate_commit must match environment review"); if (!CHECKSUM.test(text(document.environment_review_checksum)) || text(document.environment_review_checksum) !== text(environmentReview?.production_environment_review_checksum)) errors.push("environment_review_checksum must match environment review"); if (document.status === "ready_for_production_evidence" && environmentReview?.status !== "ready_for_production_environment") errors.push("ready_for_production_evidence requires ready_for_production_environment"); if (document.status === "ready_for_production_evidence" && environmentReview?.status === "ready_for_production_environment") errors.push(...readyEnvironmentErrors(environmentReview, new Date(now).toISOString())); return { ok: errors.length === 0, errors: [...new Set(errors)] }; }
export function verifyProductionEvidenceMatrixReview({ root = process.cwd(), document } = {}) { const errors = []; const verified = []; for (const entry of Array.isArray(document?.entries) ? document.entries : []) { try { const inspected = inspectReleaseArtifact({ root, reference: entry.reference }); if (inspected.checksum !== text(entry.checksum)) errors.push(`${entry.id} checksum does not match local artifact`); if (inspected.bytes !== entry.bytes) errors.push(`${entry.id} byte count does not match local artifact`); if (inspected.checksum === text(entry.checksum) && inspected.bytes === entry.bytes) verified.push(entry.id); } catch (error) { errors.push(`${entry?.id || "entry"} could not be verified: ${error.message}`); } } return { ok: errors.length === 0, errors: [...new Set(errors)], verified }; }
function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const args = process.argv.slice(2); const environmentReference = argumentValue(args, "--environment-review"); const recordsReference = argumentValue(args, "--records"); const output = argumentValue(args, "--output"); if (!environmentReference || !output) { console.error("Usage: node infra/portal/production-evidence-matrix-review.mjs --environment-review work/production/environment-review.json --records work/production/evidence-records.json --output work/production/evidence-matrix-review.json"); process.exitCode = 1; } else try { const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url))); const environmentReview = JSON.parse(fs.readFileSync(path.resolve(root, environmentReference), "utf8")); const records = recordsReference ? JSON.parse(fs.readFileSync(path.resolve(root, recordsReference), "utf8")) : {}; const document = buildProductionEvidenceMatrixReview({ root, environmentReview, records }); const destination = path.resolve(root, output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Production evidence matrix review: ${destination}`); } catch (error) { console.error(`Unable to build production evidence matrix review: ${error.message}`); process.exitCode = 1; } }
