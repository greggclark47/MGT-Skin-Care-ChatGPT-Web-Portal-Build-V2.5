import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectReleaseArtifact, validateReleaseExport } from "./release-export.mjs";
import { validateProductionAuthorizationReview } from "./production-authorization-review.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const REVIEW_VERSION = "1.0";
export const PRODUCTION_EXECUTION_READINESS_RECORD_IDS = Object.freeze([
  "operator_identity", "dual_approval", "execution_session", "release_window", "change_ticket",
  "candidate_identity", "artifact_manifest", "image_digest", "production_host", "edge_configuration",
  "secret_store_reference", "database_target", "migration_plan", "migration_backup", "rollback_target",
  "monitoring_dashboard", "alert_route", "support_on_call", "customer_communication", "accessibility_smoke",
  "billing_boundary", "ai_boundary", "notification_boundary", "stop_criteria", "execution_hold"
]);
function text(value) { return String(value || "").trim(); }
function canonicalize(value) { if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`; return JSON.stringify(value); }
export function productionExecutionReadinessChecksum(document) { const { production_execution_readiness_checksum: _ignored, ...unsigned } = document || {}; return `sha256:${createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`; }
function validPastIso(value, now) { const parsed = Date.parse(text(value)); return Number.isFinite(parsed) && parsed <= new Date(now).getTime(); }
function inspectRecord({ root, id, record, now }) { if (!record || typeof record !== "object") throw new Error(`${id} record is required`); const inspected = inspectReleaseArtifact({ root, reference: record.reference }); if (record.checksum && text(record.checksum) !== inspected.checksum) throw new Error(`${id} checksum does not match its local artifact`); if (record.bytes != null && record.bytes !== inspected.bytes) throw new Error(`${id} byte count does not match its local artifact`); if (text(record.status) && text(record.status) !== "pass") throw new Error(`${id} record status must be pass`); if (text(record.owner).length < 2) throw new Error(`${id} record must name an owner`); if (!validPastIso(record.reviewed_at, now)) throw new Error(`${id} reviewed_at must be a past ISO timestamp`); return { id, ...inspected, owner: text(record.owner), reviewed_at: text(record.reviewed_at), status: "pass" }; }
export function buildProductionExecutionReadinessReview({ root = process.cwd(), manifest, productionAuthorizationReview, records = {}, now = new Date().toISOString() } = {}) {
  const baseErrors = validateReleaseExport(manifest, { now: Date.parse(now) }).errors.map((error) => `manifest.${error}`);
  if (productionAuthorizationReview?.status === "ready_for_production_authorization") baseErrors.push(...validateProductionAuthorizationReview(productionAuthorizationReview, { manifest, productionReconciliationReview: { status: "ready_for_production_reconciliation", production_reconciliation_checksum: productionAuthorizationReview.production_reconciliation_checksum }, now: Date.parse(now) }).errors.map((error) => `production_authorization.${error}`));
  const recordErrors = [];
  const entries = [];
  for (const id of PRODUCTION_EXECUTION_READINESS_RECORD_IDS) { try { entries.push(inspectRecord({ root, id, record: records[id], now })); } catch (error) { recordErrors.push(error.message); } }
  const errors = [...baseErrors, ...recordErrors];
  const status = baseErrors.length ? "blocked" : productionAuthorizationReview?.status !== "ready_for_production_authorization" ? "pending_production_authorization" : recordErrors.length ? "blocked" : "ready_for_production_execution";
  const document = { version: REVIEW_VERSION, candidate_commit: text(manifest?.candidate_commit), bundle_checksum: text(manifest?.bundle_checksum), production_authorization_checksum: text(productionAuthorizationReview?.production_authorization_checksum), generated_at: new Date(now).toISOString(), status, entries, errors };
  return { ...document, production_execution_readiness_checksum: productionExecutionReadinessChecksum(document) };
}
export function validateProductionExecutionReadinessReview(document, { manifest, productionAuthorizationReview, now = Date.now() } = {}) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["must be an object"] };
  if (document.version !== REVIEW_VERSION) errors.push(`version must be ${REVIEW_VERSION}`);
  if (!SHA.test(text(document.candidate_commit)) || text(document.candidate_commit) !== text(manifest?.candidate_commit)) errors.push("candidate_commit must match the export manifest");
  if (!CHECKSUM.test(text(document.bundle_checksum)) || text(document.bundle_checksum) !== text(manifest?.bundle_checksum)) errors.push("bundle_checksum must match the export manifest");
  if (!CHECKSUM.test(text(document.production_authorization_checksum)) || text(document.production_authorization_checksum) !== text(productionAuthorizationReview?.production_authorization_checksum)) errors.push("production_authorization_checksum must match the authorization review");
  if (!validPastIso(document.generated_at, now)) errors.push("generated_at must be a past ISO timestamp");
  if (!CHECKSUM.test(text(document.production_execution_readiness_checksum)) || text(document.production_execution_readiness_checksum) !== productionExecutionReadinessChecksum(document)) errors.push("production_execution_readiness_checksum must match the canonical review");
  if (!["blocked", "pending_production_authorization", "ready_for_production_execution"].includes(document.status)) errors.push("status must be a known production-execution state");
  for (const id of PRODUCTION_EXECUTION_READINESS_RECORD_IDS) if (Array.isArray(document.entries) ? document.entries.filter((entry) => entry?.id === id).length !== 1 : true) errors.push(`${id} must appear exactly once`);
  if (document.status === "ready_for_production_execution" && productionAuthorizationReview?.status !== "ready_for_production_authorization") errors.push("ready_for_production_execution requires ready_for_production_authorization");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
export function verifyProductionExecutionReadinessReview({ root = process.cwd(), document } = {}) { const errors = []; const verified = []; for (const entry of Array.isArray(document?.entries) ? document.entries : []) { try { const inspected = inspectReleaseArtifact({ root, reference: entry.reference }); if (inspected.checksum !== text(entry.checksum)) errors.push(`${entry.id} checksum does not match its local artifact`); if (inspected.bytes !== entry.bytes) errors.push(`${entry.id} byte count does not match its local artifact`); if (inspected.checksum === text(entry.checksum) && inspected.bytes === entry.bytes) verified.push(entry.id); } catch (error) { errors.push(`${entry?.id || "entry"} could not be verified: ${error.message}`); } } return { ok: errors.length === 0, errors: [...new Set(errors)], verified }; }
function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const args = process.argv.slice(2); const manifestReference = argumentValue(args, "--manifest"); const authorizationReference = argumentValue(args, "--production-authorization"); const recordsReference = argumentValue(args, "--records"); const output = argumentValue(args, "--output"); if (!manifestReference || !authorizationReference || !output) { console.error("Usage: node infra/portal/production-execution-readiness-review.mjs --manifest work/exports/release-export.json --production-authorization work/exports/production-authorization-review.json --records work/exports/production-execution-readiness-records.json --output work/exports/production-execution-readiness-review.json"); process.exitCode = 1; } else try { const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url))); const manifest = JSON.parse(fs.readFileSync(path.resolve(root, manifestReference), "utf8")); const productionAuthorizationReview = JSON.parse(fs.readFileSync(path.resolve(root, authorizationReference), "utf8")); const records = recordsReference ? JSON.parse(fs.readFileSync(path.resolve(root, recordsReference), "utf8")) : {}; const document = buildProductionExecutionReadinessReview({ root, manifest, productionAuthorizationReview, records }); const destination = path.resolve(root, output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Production execution readiness review: ${destination}`); if (document.status === "blocked") process.exitCode = 2; } catch (error) { console.error(`Unable to build production execution readiness review: ${error.message}`); process.exitCode = 1; } }
