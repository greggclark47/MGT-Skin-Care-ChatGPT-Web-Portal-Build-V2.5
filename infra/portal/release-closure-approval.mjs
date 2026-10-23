import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectReleaseArtifact, validateReleaseExport } from "./release-export.mjs";
import { validateReleaseClosureReview } from "./release-closure-review.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const REVIEW_VERSION = "1.0";
export const CLOSURE_APPROVAL_RECORD_IDS = Object.freeze([
  "closure_review_acknowledgement", "release_owner_signoff", "support_owner_signoff",
  "technical_owner_signoff", "rollback_owner_signoff", "compliance_owner_signoff",
  "monitoring_window", "incident_route", "archive_pointer", "final_release_decision"
]);

function text(value) { return String(value || "").trim(); }
function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function releaseClosureApprovalChecksum(document) {
  const { closure_approval_checksum: _ignored, ...unsigned } = document || {};
  return `sha256:${createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`;
}
function validPastIso(value, now) { const parsed = Date.parse(text(value)); return Number.isFinite(parsed) && parsed <= new Date(now).getTime(); }
function inspectRecord({ root, id, record, now }) {
  if (!record || typeof record !== "object") throw new Error(`${id} record is required`);
  const inspected = inspectReleaseArtifact({ root, reference: record.reference });
  if (record.checksum && text(record.checksum) !== inspected.checksum) throw new Error(`${id} checksum does not match its local artifact`);
  if (record.bytes != null && record.bytes !== inspected.bytes) throw new Error(`${id} byte count does not match its local artifact`);
  if (text(record.status) && text(record.status) !== "pass") throw new Error(`${id} record status must be pass`);
  if (text(record.owner).length < 2) throw new Error(`${id} record must name an owner`);
  if (!validPastIso(record.reviewed_at, now)) throw new Error(`${id} reviewed_at must be a past ISO timestamp`);
  return { id, ...inspected, owner: text(record.owner), reviewed_at: text(record.reviewed_at), status: "pass" };
}
export function buildReleaseClosureApproval({ root = process.cwd(), manifest, closureReview, records = {}, now = new Date().toISOString() } = {}) {
  const baseErrors = validateReleaseExport(manifest, { now: Date.parse(now) }).errors.map((error) => `manifest.${error}`);
  if (closureReview?.status === "ready_for_closure_review") baseErrors.push(...validateReleaseClosureReview(closureReview, { manifest, postExecutionReview: { status: "ready_for_post_execution_review", post_execution_review_checksum: closureReview.post_execution_review_checksum }, now: Date.parse(now) }).errors.map((error) => `closure_review.${error}`));
  const recordErrors = []; const entries = [];
  for (const id of CLOSURE_APPROVAL_RECORD_IDS) { try { entries.push(inspectRecord({ root, id, record: records[id], now })); } catch (error) { recordErrors.push(error.message); } }
  const errors = [...baseErrors, ...recordErrors];
  const status = baseErrors.length ? "blocked" : closureReview?.status !== "ready_for_closure_review" ? "pending_closure_review" : recordErrors.length ? "blocked" : "ready_for_release_decision";
  const document = { version: REVIEW_VERSION, candidate_commit: text(manifest?.candidate_commit), bundle_checksum: text(manifest?.bundle_checksum), closure_review_checksum: text(closureReview?.closure_review_checksum), generated_at: new Date(now).toISOString(), status, entries, errors };
  return { ...document, closure_approval_checksum: releaseClosureApprovalChecksum(document) };
}
export function validateReleaseClosureApproval(document, { manifest, closureReview, now = Date.now() } = {}) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["must be an object"] };
  if (document.version !== REVIEW_VERSION) errors.push(`version must be ${REVIEW_VERSION}`);
  if (!SHA.test(text(document.candidate_commit)) || text(document.candidate_commit) !== text(manifest?.candidate_commit)) errors.push("candidate_commit must match the export manifest");
  if (!CHECKSUM.test(text(document.bundle_checksum)) || text(document.bundle_checksum) !== text(manifest?.bundle_checksum)) errors.push("bundle_checksum must match the export manifest");
  if (!CHECKSUM.test(text(document.closure_review_checksum)) || text(document.closure_review_checksum) !== text(closureReview?.closure_review_checksum)) errors.push("closure_review_checksum must match the closure review");
  if (!validPastIso(document.generated_at, now)) errors.push("generated_at must be a past ISO timestamp");
  if (!CHECKSUM.test(text(document.closure_approval_checksum)) || text(document.closure_approval_checksum) !== releaseClosureApprovalChecksum(document)) errors.push("closure_approval_checksum must match the canonical approval");
  if (!["blocked", "pending_closure_review", "ready_for_release_decision"].includes(document.status)) errors.push("status must be a known closure approval state");
  for (const id of CLOSURE_APPROVAL_RECORD_IDS) if (Array.isArray(document.entries) ? document.entries.filter((entry) => entry?.id === id).length !== 1 : true) errors.push(`${id} must appear exactly once`);
  if (document.status === "ready_for_release_decision" && closureReview?.status !== "ready_for_closure_review") errors.push("ready_for_release_decision requires ready_for_closure_review");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}
export function verifyReleaseClosureApproval({ root = process.cwd(), document } = {}) {
  const errors = []; const verified = [];
  for (const entry of Array.isArray(document?.entries) ? document.entries : []) { try { const inspected = inspectReleaseArtifact({ root, reference: entry.reference }); if (inspected.checksum !== text(entry.checksum)) errors.push(`${entry.id} checksum does not match its local artifact`); if (inspected.bytes !== entry.bytes) errors.push(`${entry.id} byte count does not match its local artifact`); if (inspected.checksum === text(entry.checksum) && inspected.bytes === entry.bytes) verified.push(entry.id); } catch (error) { errors.push(`${entry?.id || "entry"} could not be verified: ${error.message}`); } }
  return { ok: errors.length === 0, errors: [...new Set(errors)], verified };
}
function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2); const manifestReference = argumentValue(args, "--manifest"); const closureReference = argumentValue(args, "--closure-review"); const recordsReference = argumentValue(args, "--records"); const output = argumentValue(args, "--output");
  if (!manifestReference || !closureReference || !output) { console.error("Usage: node infra/portal/release-closure-approval.mjs --manifest work/exports/release-export.json --closure-review work/exports/release-closure-review.json --records work/exports/closure-approval-records.json --output work/exports/release-closure-approval.json"); process.exitCode = 1; } else try { const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url))); const manifest = JSON.parse(fs.readFileSync(path.resolve(root, manifestReference), "utf8")); const closureReview = JSON.parse(fs.readFileSync(path.resolve(root, closureReference), "utf8")); const records = recordsReference ? JSON.parse(fs.readFileSync(path.resolve(root, recordsReference), "utf8")) : {}; const document = buildReleaseClosureApproval({ root, manifest, closureReview, records }); const destination = path.resolve(root, output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Release closure approval: ${destination}`); if (document.status === "blocked") process.exitCode = 2; } catch (error) { console.error(`Unable to build release closure approval: ${error.message}`); process.exitCode = 1; }
}
