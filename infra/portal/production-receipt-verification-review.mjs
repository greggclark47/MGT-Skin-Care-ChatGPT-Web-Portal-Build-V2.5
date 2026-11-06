import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectReleaseArtifact, validateReleaseExport } from "./release-export.mjs";
import { validateProductionExecutionReceiptReview } from "./production-execution-receipt-review.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const REVIEW_VERSION = "1.0";
export const PRODUCTION_RECEIPT_VERIFICATION_RECORD_IDS = Object.freeze([
  "receipt_integrity", "receipt_freshness", "operator_receipt_match", "execution_timestamp_match",
  "scope_match", "target_match", "candidate_match", "bundle_match", "artifact_match", "image_match",
  "deployment_match", "migration_match", "backup_match", "health_match", "readiness_match",
  "route_home_match", "route_signin_match", "route_customer_match", "route_support_match", "auth_match",
  "database_match", "rls_match", "worker_match", "support_match", "billing_match", "ai_match",
  "notification_match", "monitoring_match", "alert_match", "rollback_match", "audit_match",
  "communication_match", "accessibility_match", "privacy_match", "final_verification_hold"
]);
function text(value) { return String(value || "").trim(); }
function canonicalize(value) { if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`; return JSON.stringify(value); }
export function productionReceiptVerificationChecksum(document) { const { production_receipt_verification_checksum: _ignored, ...unsigned } = document || {}; return `sha256:${createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`; }
function validPastIso(value, now) { const parsed = Date.parse(text(value)); return Number.isFinite(parsed) && parsed <= new Date(now).getTime(); }
function inspectRecord({ root, id, record, now }) { if (!record || typeof record !== "object") throw new Error(`${id} record is required`); const inspected = inspectReleaseArtifact({ root, reference: record.reference }); if (record.checksum && text(record.checksum) !== inspected.checksum) throw new Error(`${id} checksum does not match its local artifact`); if (record.bytes != null && record.bytes !== inspected.bytes) throw new Error(`${id} byte count does not match its local artifact`); if (text(record.status) && text(record.status) !== "pass") throw new Error(`${id} record status must be pass`); if (text(record.owner).length < 2) throw new Error(`${id} record must name an owner`); if (!validPastIso(record.reviewed_at, now)) throw new Error(`${id} reviewed_at must be a past ISO timestamp`); return { id, ...inspected, owner: text(record.owner), reviewed_at: text(record.reviewed_at), status: "pass" }; }
export function buildProductionReceiptVerificationReview({ root = process.cwd(), manifest, productionExecutionReceiptReview, records = {}, now = new Date().toISOString() } = {}) {
  const baseErrors = validateReleaseExport(manifest, { now: Date.parse(now) }).errors.map((error) => `manifest.${error}`);
  if (productionExecutionReceiptReview?.status === "ready_for_production_execution_receipt") baseErrors.push(...validateProductionExecutionReceiptReview(productionExecutionReceiptReview, { manifest, productionExecutionReview: { status: "ready_for_production_execution_review", production_execution_checksum: productionExecutionReceiptReview.production_execution_checksum }, now: Date.parse(now) }).errors.map((error) => `production_execution_receipt.${error}`));
  const recordErrors = [];
  const entries = [];
  for (const id of PRODUCTION_RECEIPT_VERIFICATION_RECORD_IDS) { try { entries.push(inspectRecord({ root, id, record: records[id], now })); } catch (error) { recordErrors.push(error.message); } }
  const errors = [...baseErrors, ...recordErrors];
  const status = baseErrors.length ? "blocked" : productionExecutionReceiptReview?.status !== "ready_for_production_execution_receipt" ? "pending_production_execution_receipt" : recordErrors.length ? "blocked" : "ready_for_production_receipt_verification";
  const document = { version: REVIEW_VERSION, candidate_commit: text(manifest?.candidate_commit), bundle_checksum: text(manifest?.bundle_checksum), production_execution_receipt_checksum: text(productionExecutionReceiptReview?.production_execution_receipt_checksum), generated_at: new Date(now).toISOString(), status, entries, errors };
  return { ...document, production_receipt_verification_checksum: productionReceiptVerificationChecksum(document) };
}
export function validateProductionReceiptVerificationReview(document, { manifest, productionExecutionReceiptReview, now = Date.now() } = {}) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["must be an object"] };
  if (document.version !== REVIEW_VERSION) errors.push(`version must be ${REVIEW_VERSION}`);
  if (!SHA.test(text(document.candidate_commit)) || text(document.candidate_commit) !== text(manifest?.candidate_commit)) errors.push("candidate_commit must match the export manifest");
  if (!CHECKSUM.test(text(document.bundle_checksum)) || text(document.bundle_checksum) !== text(manifest?.bundle_checksum)) errors.push("bundle_checksum must match the export manifest");
  if (!CHECKSUM.test(text(document.production_execution_receipt_checksum)) || text(document.production_execution_receipt_checksum) !== text(productionExecutionReceiptReview?.production_execution_receipt_checksum)) errors.push("production_execution_receipt_checksum must match the execution-receipt review");
  if (!validPastIso(document.generated_at, now)) errors.push("generated_at must be a past ISO timestamp");
  if (!CHECKSUM.test(text(document.production_receipt_verification_checksum)) || text(document.production_receipt_verification_checksum) !== productionReceiptVerificationChecksum(document)) errors.push("production_receipt_verification_checksum must match the canonical review");
  if (!["blocked", "pending_production_execution_receipt", "ready_for_production_receipt_verification"].includes(document.status)) errors.push("status must be a known receipt-verification state");
  for (const id of PRODUCTION_RECEIPT_VERIFICATION_RECORD_IDS) if (Array.isArray(document.entries) ? document.entries.filter((entry) => entry?.id === id).length !== 1 : true) errors.push(`${id} must appear exactly once`);
  if (document.status === "ready_for_production_receipt_verification" && productionExecutionReceiptReview?.status !== "ready_for_production_execution_receipt") errors.push("ready_for_production_receipt_verification requires ready_for_production_execution_receipt");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
export function verifyProductionReceiptVerificationReview({ root = process.cwd(), document } = {}) { const errors = []; const verified = []; for (const entry of Array.isArray(document?.entries) ? document.entries : []) { try { const inspected = inspectReleaseArtifact({ root, reference: entry.reference }); if (inspected.checksum !== text(entry.checksum)) errors.push(`${entry.id} checksum does not match its local artifact`); if (inspected.bytes !== entry.bytes) errors.push(`${entry.id} byte count does not match its local artifact`); if (inspected.checksum === text(entry.checksum) && inspected.bytes === entry.bytes) verified.push(entry.id); } catch (error) { errors.push(`${entry?.id || "entry"} could not be verified: ${error.message}`); } } return { ok: errors.length === 0, errors: [...new Set(errors)], verified }; }
function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const args = process.argv.slice(2); const manifestReference = argumentValue(args, "--manifest"); const receiptReference = argumentValue(args, "--production-execution-receipt"); const recordsReference = argumentValue(args, "--records"); const output = argumentValue(args, "--output"); if (!manifestReference || !receiptReference || !output) { console.error("Usage: node infra/portal/production-receipt-verification-review.mjs --manifest work/exports/release-export.json --production-execution-receipt work/exports/production-execution-receipt-review.json --records work/exports/production-receipt-verification-records.json --output work/exports/production-receipt-verification-review.json"); process.exitCode = 1; } else try { const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url))); const manifest = JSON.parse(fs.readFileSync(path.resolve(root, manifestReference), "utf8")); const productionExecutionReceiptReview = JSON.parse(fs.readFileSync(path.resolve(root, receiptReference), "utf8")); const records = recordsReference ? JSON.parse(fs.readFileSync(path.resolve(root, recordsReference), "utf8")) : {}; const document = buildProductionReceiptVerificationReview({ root, manifest, productionExecutionReceiptReview, records }); const destination = path.resolve(root, output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Production receipt verification review: ${destination}`); if (document.status === "blocked") process.exitCode = 2; } catch (error) { console.error(`Unable to build production receipt verification review: ${error.message}`); process.exitCode = 1; } }
