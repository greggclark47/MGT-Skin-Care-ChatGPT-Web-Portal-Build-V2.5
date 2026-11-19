import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectReleaseArtifact, validateReleaseExport } from "./release-export.mjs";
import { validateProductionReconciliationReview } from "./production-reconciliation-review.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const REVIEW_VERSION = "1.0";
export const PRODUCTION_AUTHORIZATION_RECORD_IDS = Object.freeze([
  "release_scope_confirmation", "release_window_confirmation", "change_freeze_confirmation",
  "candidate_commit_confirmation", "bundle_checksum_confirmation", "image_digest_confirmation",
  "production_host_confirmation", "dns_change_confirmation", "tls_certificate_confirmation",
  "database_migration_plan", "migration_backup_confirmation", "rls_policy_confirmation",
  "auth_provider_confirmation", "support_roster_confirmation", "accessibility_signoff",
  "privacy_signoff", "billing_enablement_decision", "ai_enablement_decision",
  "notification_enablement_decision", "monitoring_dashboard_confirmation", "alert_route_confirmation",
  "rollback_command_confirmation", "incident_commander_confirmation", "customer_communication_confirmation",
  "final_go_no_go_approval"
]);
function text(value) { return String(value || "").trim(); }
function canonicalize(value) { if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`; return JSON.stringify(value); }
export function productionAuthorizationChecksum(document) { const { production_authorization_checksum: _ignored, ...unsigned } = document || {}; return `sha256:${createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`; }
function validPastIso(value, now) { const parsed = Date.parse(text(value)); return Number.isFinite(parsed) && parsed <= new Date(now).getTime(); }
function inspectRecord({ root, id, record, now }) { if (!record || typeof record !== "object") throw new Error(`${id} record is required`); const inspected = inspectReleaseArtifact({ root, reference: record.reference }); if (record.checksum && text(record.checksum) !== inspected.checksum) throw new Error(`${id} checksum does not match its local artifact`); if (record.bytes != null && record.bytes !== inspected.bytes) throw new Error(`${id} byte count does not match its local artifact`); if (text(record.status) && text(record.status) !== "pass") throw new Error(`${id} record status must be pass`); if (text(record.owner).length < 2) throw new Error(`${id} record must name an owner`); if (!validPastIso(record.reviewed_at, now)) throw new Error(`${id} reviewed_at must be a past ISO timestamp`); return { id, ...inspected, owner: text(record.owner), reviewed_at: text(record.reviewed_at), status: "pass" }; }
export function buildProductionAuthorizationReview({ root = process.cwd(), manifest, productionReconciliationReview, records = {}, now = new Date().toISOString() } = {}) {
  const baseErrors = validateReleaseExport(manifest, { now: Date.parse(now) }).errors.map((error) => `manifest.${error}`);
  if (productionReconciliationReview?.status === "ready_for_production_reconciliation") baseErrors.push(...validateProductionReconciliationReview(productionReconciliationReview, { manifest, productionCloseoutReview: { status: "ready_for_production_closeout_review", production_closeout_checksum: productionReconciliationReview.production_closeout_checksum }, now: Date.parse(now) }).errors.map((error) => `production_reconciliation.${error}`));
  const recordErrors = [];
  const entries = [];
  for (const id of PRODUCTION_AUTHORIZATION_RECORD_IDS) { try { entries.push(inspectRecord({ root, id, record: records[id], now })); } catch (error) { recordErrors.push(error.message); } }
  const errors = [...baseErrors, ...recordErrors];
  const status = baseErrors.length ? "blocked" : productionReconciliationReview?.status !== "ready_for_production_reconciliation" ? "pending_production_reconciliation" : recordErrors.length ? "blocked" : "ready_for_production_authorization";
  const document = { version: REVIEW_VERSION, candidate_commit: text(manifest?.candidate_commit), bundle_checksum: text(manifest?.bundle_checksum), production_reconciliation_checksum: text(productionReconciliationReview?.production_reconciliation_checksum), generated_at: new Date(now).toISOString(), status, entries, errors };
  return { ...document, production_authorization_checksum: productionAuthorizationChecksum(document) };
}
export function validateProductionAuthorizationReview(document, { manifest, productionReconciliationReview, now = Date.now() } = {}) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["must be an object"] };
  if (document.version !== REVIEW_VERSION) errors.push(`version must be ${REVIEW_VERSION}`);
  if (!SHA.test(text(document.candidate_commit)) || text(document.candidate_commit) !== text(manifest?.candidate_commit)) errors.push("candidate_commit must match the export manifest");
  if (!CHECKSUM.test(text(document.bundle_checksum)) || text(document.bundle_checksum) !== text(manifest?.bundle_checksum)) errors.push("bundle_checksum must match the export manifest");
  if (!CHECKSUM.test(text(document.production_reconciliation_checksum)) || text(document.production_reconciliation_checksum) !== text(productionReconciliationReview?.production_reconciliation_checksum)) errors.push("production_reconciliation_checksum must match the reconciliation review");
  if (!validPastIso(document.generated_at, now)) errors.push("generated_at must be a past ISO timestamp");
  if (!CHECKSUM.test(text(document.production_authorization_checksum)) || text(document.production_authorization_checksum) !== productionAuthorizationChecksum(document)) errors.push("production_authorization_checksum must match the canonical review");
  if (!["blocked", "pending_production_reconciliation", "ready_for_production_authorization"].includes(document.status)) errors.push("status must be a known production-authorization state");
  for (const id of PRODUCTION_AUTHORIZATION_RECORD_IDS) if (Array.isArray(document.entries) ? document.entries.filter((entry) => entry?.id === id).length !== 1 : true) errors.push(`${id} must appear exactly once`);
  if (document.status === "ready_for_production_authorization" && productionReconciliationReview?.status !== "ready_for_production_reconciliation") errors.push("ready_for_production_authorization requires ready_for_production_reconciliation");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
export function verifyProductionAuthorizationReview({ root = process.cwd(), document } = {}) { const errors = []; const verified = []; for (const entry of Array.isArray(document?.entries) ? document.entries : []) { try { const inspected = inspectReleaseArtifact({ root, reference: entry.reference }); if (inspected.checksum !== text(entry.checksum)) errors.push(`${entry.id} checksum does not match its local artifact`); if (inspected.bytes !== entry.bytes) errors.push(`${entry.id} byte count does not match its local artifact`); if (inspected.checksum === text(entry.checksum) && inspected.bytes === entry.bytes) verified.push(entry.id); } catch (error) { errors.push(`${entry?.id || "entry"} could not be verified: ${error.message}`); } } return { ok: errors.length === 0, errors: [...new Set(errors)], verified }; }
function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const args = process.argv.slice(2); const manifestReference = argumentValue(args, "--manifest"); const reconciliationReference = argumentValue(args, "--production-reconciliation"); const recordsReference = argumentValue(args, "--records"); const output = argumentValue(args, "--output"); if (!manifestReference || !reconciliationReference || !output) { console.error("Usage: node infra/portal/production-authorization-review.mjs --manifest work/exports/release-export.json --production-reconciliation work/exports/production-reconciliation-review.json --records work/exports/production-authorization-records.json --output work/exports/production-authorization-review.json"); process.exitCode = 1; } else try { const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url))); const manifest = JSON.parse(fs.readFileSync(path.resolve(root, manifestReference), "utf8")); const productionReconciliationReview = JSON.parse(fs.readFileSync(path.resolve(root, reconciliationReference), "utf8")); const records = recordsReference ? JSON.parse(fs.readFileSync(path.resolve(root, recordsReference), "utf8")) : {}; const document = buildProductionAuthorizationReview({ root, manifest, productionReconciliationReview, records }); const destination = path.resolve(root, output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Production authorization review: ${destination}`); if (document.status === "blocked") process.exitCode = 2; } catch (error) { console.error(`Unable to build production authorization review: ${error.message}`); process.exitCode = 1; } }
