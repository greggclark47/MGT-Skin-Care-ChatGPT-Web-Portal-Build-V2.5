import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectReleaseArtifact } from "./release-export.mjs";
import { validateProductionPrerequisites } from "./production-prerequisites.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const VERSION = "1.0";
export const PREREQUISITE_RECORD_IDS = Object.freeze(["env_shape", "hosting_target", "database_target", "secret_manager", "image_digests", "backup_restore", "support_owner", "accessibility_report", "rollback_authority", "launch_approval"]);
function text(value) { return String(value || "").trim(); }
function canonicalize(value) { if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`; return JSON.stringify(value); }
export function productionPrerequisiteReviewChecksum(document) { const { prerequisite_review_checksum: _ignored, ...unsigned } = document || {}; return `sha256:${createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`; }
function validPastIso(value, now) { const parsed = Date.parse(text(value)); return Number.isFinite(parsed) && parsed <= new Date(now).getTime(); }
function inspectRecord({ root, id, record, now }) { if (!record || typeof record !== "object") throw new Error(`${id} record is required`); const inspected = inspectReleaseArtifact({ root, reference: record.reference }); if (record.checksum && text(record.checksum) !== inspected.checksum) throw new Error(`${id} checksum does not match its local artifact`); if (record.bytes != null && record.bytes !== inspected.bytes) throw new Error(`${id} byte count does not match its local artifact`); if (text(record.status) !== "pass") throw new Error(`${id} record status must be pass`); if (text(record.owner).length < 2) throw new Error(`${id} record must name an owner`); if (!validPastIso(record.reviewed_at, now)) throw new Error(`${id} reviewed_at must be a past ISO timestamp`); return { id, ...inspected, owner: text(record.owner), reviewed_at: text(record.reviewed_at), status: "pass" }; }
export function buildProductionPrerequisiteReview({ root = process.cwd(), prerequisites, records = {}, now = new Date().toISOString() } = {}) {
  const baseErrors = validateProductionPrerequisites(prerequisites).errors;
  const recordErrors = [], entries = [];
  for (const id of PREREQUISITE_RECORD_IDS) {
    try { entries.push(inspectRecord({ root, id, record: records[id], now })); }
    catch (error) { recordErrors.push(error.message); }
  }
  const errors = [...baseErrors, ...recordErrors];
  const status = baseErrors.length ? "blocked" : recordErrors.length ? "pending_external_prerequisites" : "ready_for_prerequisite_review";
  const document = { version: VERSION, candidate_commit: text(prerequisites?.candidate_commit), prerequisites_checksum: text(prerequisites?.prerequisites_checksum), generated_at: new Date(now).toISOString(), status, entries, errors };
  return { ...document, prerequisite_review_checksum: productionPrerequisiteReviewChecksum(document) };
}

function validateReviewStructure(document, now) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return ["must be an object"];
  if (document.version !== VERSION) errors.push(`version must be ${VERSION}`);
  if (!SHA.test(text(document.candidate_commit))) errors.push("candidate_commit must be a commit SHA");
  if (!CHECKSUM.test(text(document.prerequisites_checksum))) errors.push("prerequisites_checksum must be a sha256 checksum");
  if (!validPastIso(document.generated_at, now)) errors.push("generated_at must be a past ISO timestamp");
  if (text(document.prerequisite_review_checksum) !== productionPrerequisiteReviewChecksum(document)) errors.push("prerequisite_review_checksum must match canonical review");
  if (!["blocked", "pending_external_prerequisites", "ready_for_prerequisite_review"].includes(document.status)) errors.push("status must be known");
  if (!Array.isArray(document.entries)) errors.push("entries must be an array");
  if (!Array.isArray(document.errors)) errors.push("errors must be an array");
  const entries = Array.isArray(document.entries) ? document.entries : [];
  const ready = document.status === "ready_for_prerequisite_review";
  if (ready && (!Array.isArray(document.errors) || document.errors.length)) errors.push("ready review cannot contain errors");
  if (ready && entries.length !== PREREQUISITE_RECORD_IDS.length) errors.push("ready review requires every prerequisite record");
  for (const id of PREREQUISITE_RECORD_IDS) {
    const count = entries.filter((entry) => entry?.id === id).length;
    if (count > 1 || (ready && count !== 1)) errors.push(`${id} must appear exactly once in a ready review`);
  }
  for (const entry of entries) {
    if (!entry || !PREREQUISITE_RECORD_IDS.includes(entry.id)) { errors.push("entries contain an unknown prerequisite"); continue; }
    if (entry.status !== "pass") errors.push(`${entry.id} record status must be pass`);
    if (typeof entry.owner !== "string" || entry.owner.trim().length < 2) errors.push(`${entry.id} record must name an owner`);
    if (!validPastIso(entry.reviewed_at, now)) errors.push(`${entry.id} reviewed_at must be a past timestamp`);
    if (typeof entry.reference !== "string" || !entry.reference) errors.push(`${entry.id} reference is required`);
    if (!CHECKSUM.test(text(entry.checksum))) errors.push(`${entry.id} checksum is required`);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 1) errors.push(`${entry.id} byte count must be positive`);
  }
  return errors;
}

export function validateProductionPrerequisiteReview(document, { prerequisites, now = Date.now() } = {}) {
  const errors = [...validateReviewStructure(document, now), ...validateProductionPrerequisites(prerequisites).errors];
  if (text(document?.candidate_commit) !== text(prerequisites?.candidate_commit)) errors.push("candidate_commit must match prerequisites");
  if (text(document?.prerequisites_checksum) !== text(prerequisites?.prerequisites_checksum)) errors.push("prerequisites_checksum must match prerequisites");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function verifyProductionPrerequisiteReview({ root = process.cwd(), document, now = Date.now() } = {}) {
  const errors = validateReviewStructure(document, now), verified = [];
  if (document?.status !== "ready_for_prerequisite_review") errors.push("only a ready review can verify all prerequisite artifacts");
  // Structural and checksum failures stop before any artifact is opened.
  if (errors.length) return { ok: false, errors: [...new Set(errors)], verified };
  for (const entry of document.entries) {
    try {
      const inspected = inspectReleaseArtifact({ root, reference: entry.reference });
      if (inspected.checksum !== entry.checksum) errors.push(`${entry.id} checksum does not match local artifact`);
      if (inspected.bytes !== entry.bytes) errors.push(`${entry.id} byte count does not match local artifact`);
      if (inspected.checksum === entry.checksum && inspected.bytes === entry.bytes) verified.push(entry.id);
    } catch (error) { errors.push(`${entry.id} could not be verified: ${error.message}`); }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], verified };
}
function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const args = process.argv.slice(2); const prerequisitesReference = argumentValue(args, "--prerequisites"); const recordsReference = argumentValue(args, "--records"); const output = argumentValue(args, "--output"); if (!prerequisitesReference || !output) { console.error("Usage: node infra/portal/production-prerequisite-review.mjs --prerequisites work/production/prerequisites.json --records work/production/prerequisite-records.json --output work/production/prerequisite-review.json"); process.exitCode = 1; } else try { const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url))); const prerequisites = JSON.parse(fs.readFileSync(path.resolve(root, prerequisitesReference), "utf8")); const records = recordsReference ? JSON.parse(fs.readFileSync(path.resolve(root, recordsReference), "utf8")) : {}; const document = buildProductionPrerequisiteReview({ root, prerequisites, records }); const destination = path.resolve(root, output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Production prerequisite review: ${destination}`); } catch (error) { console.error(`Unable to build production prerequisite review: ${error.message}`); process.exitCode = 1; } }
