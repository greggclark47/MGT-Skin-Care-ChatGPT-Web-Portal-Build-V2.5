import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectReleaseArtifact } from "./release-export.mjs";
import { validateProductionPrerequisites } from "./production-prerequisites.mjs";
import { utcTimestamp } from "./approval-window.mjs";
import { accountableOwnerError, isAccountableOwner } from "./ownership.mjs";
import { validateSecretInjectionAdmission } from "./secret-injection-admission.mjs";
import { validateRecoveryDrillReview, verifyRecoveryDrillReview } from "./recovery-drill-review.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const VERSION = "1.2";
const POLICY_APPROVAL_VERSION = "1.0";
export const PREREQUISITE_RECORD_IDS = Object.freeze(["env_shape", "hosting_target", "database_target", "secret_manager", "image_digests", "backup_restore", "support_owner", "accessibility_report", "policy_publication_approval", "rollback_authority", "launch_approval", "github_receipt", "drive_receipt"]);
function text(value) { return String(value || "").trim(); }
function canonicalize(value) { if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`; return JSON.stringify(value); }
export function productionPrerequisiteReviewChecksum(document) { const { prerequisite_review_checksum: _ignored, ...unsigned } = document || {}; return `sha256:${createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`; }
function validPastIso(value, now) { const parsed = utcTimestamp(value); return Number.isFinite(parsed) && parsed <= new Date(now).getTime(); }
function validPolicyUrl(value) {
  try {
    const url = new URL(text(value));
    return typeof value === "string" && value === text(value) && value.length <= 2048 && url.protocol === "https:" && !!url.hostname && !url.username && !url.password && !url.port && !url.search && !url.hash && !/(your-|change[-_]?me|example\.|localhost|127\.0\.0\.1)/i.test(value);
  } catch { return false; }
}
function validApprovalReference(value) { return typeof value === "string" && value === text(value) && value.length >= 4 && value.length <= 2048 && !/[\u0000-\u001f\u007f]/.test(value) && !/(?:\b(?:sk|whsec|xox[bap])-|-----BEGIN|postgres(?:ql)?:\/\/[^\s/@]+:[^\s/@]+@|\b(?:api[_-]?key|password|token)\s*[=:])/i.test(value); }
export function validatePolicyApprovalRecord({ root, record, candidateCommit, now }) {
  if (path.extname(text(record?.reference)).toLowerCase() !== ".json") throw new Error("policy_publication_approval record must reference a structured JSON approval artifact");
  let document;
  try { document = JSON.parse(fs.readFileSync(path.resolve(root, record.reference), "utf8")); }
  catch { throw new Error("policy_publication_approval record must contain valid JSON"); }
  if (!document || typeof document !== "object" || Array.isArray(document) || document.version !== POLICY_APPROVAL_VERSION) throw new Error(`policy_publication_approval record must use version ${POLICY_APPROVAL_VERSION}`);
  if (text(document.candidate_commit) !== text(candidateCommit)) throw new Error("policy_publication_approval record must bind the candidate commit");
  if (document.status !== "approved") throw new Error("policy_publication_approval record must have approved status");
  if (!validPastIso(document.approved_at, now)) throw new Error("policy_publication_approval record must retain a past approval timestamp");
  if (!validApprovalReference(document.approval_reference)) throw new Error("policy_publication_approval record must retain a safe approval reference");
  const urls = document.policy_urls;
  const expected = ["privacy_notice", "terms_of_use", "ai_disclosure"];
  if (!urls || typeof urls !== "object" || Array.isArray(urls) || JSON.stringify(Object.keys(urls).sort()) !== JSON.stringify(expected.slice().sort()) || expected.some((key) => !validPolicyUrl(urls[key])) || new Set(expected.map((key) => urls[key])).size !== expected.length) throw new Error("policy_publication_approval record must retain three distinct safe public policy URLs");
}
function validateBackupRestoreRecord({ root, record, candidateCommit, now }) {
  if (path.extname(text(record?.reference)).toLowerCase() !== ".json") throw new Error("backup_restore record must reference a structured recovery-drill review JSON artifact");
  let document;
  try { document = JSON.parse(fs.readFileSync(path.resolve(root, record.reference), "utf8")); }
  catch { throw new Error("backup_restore record must contain valid JSON"); }
  const validation = validateRecoveryDrillReview(document, { manifest: { candidate_commit: candidateCommit }, now });
  if (!validation.ok || document.status !== "ready_for_recovery_review") throw new Error("backup_restore record must contain a ready candidate-bound recovery-drill review");
  const verification = verifyRecoveryDrillReview({ root, document });
  if (!verification.ok) throw new Error("backup_restore record must retain verified recovery-drill evidence");
}
function validContractChecksums(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 2 && CHECKSUM.test(text(value.staging)) && CHECKSUM.test(text(value.production)); }
function inspectNestedArtifact({ root, record, label }) {
  if (!record || typeof record !== "object" || Array.isArray(record) || typeof record.reference !== "string" || !record.reference || !CHECKSUM.test(text(record.checksum)) || !Number.isSafeInteger(record.bytes) || record.bytes < 1) throw new Error(`${label} must retain a reference, checksum, and positive byte count`);
  const inspected = inspectReleaseArtifact({ root, reference: record.reference });
  if (inspected.checksum !== text(record.checksum)) throw new Error(`${label} checksum does not match its local artifact`);
  if (inspected.bytes !== record.bytes) throw new Error(`${label} byte count does not match its local artifact`);
  return { reference: inspected.reference, checksum: inspected.checksum, bytes: inspected.bytes };
}
function validateSecretManagerRecord({ root, record, candidateCommit }) {
  const reference = record?.reference;
  if (path.extname(text(reference)).toLowerCase() !== ".json") throw new Error("secret_manager record must reference a secret-injection admission JSON report");
  if (!validContractChecksums(record.contract_checksums)) throw new Error("secret_manager record must bind the approved staging and production contract checksums");
  let document;
  try { document = JSON.parse(fs.readFileSync(path.resolve(root, reference), "utf8")); }
  catch { throw new Error("secret_manager record must contain valid JSON"); }
  const validation = validateSecretInjectionAdmission(document, { environment: "production", candidateCommit, expectedContractChecksums: record.contract_checksums });
  if (!validation.ok) throw new Error("secret_manager record must contain a passing candidate-bound production secret-injection admission");
  const result = { contract_checksums: { staging: text(record.contract_checksums.staging), production: text(record.contract_checksums.production) }, private_file_security: document.private_file_security };
  if (document.private_file_security === "provider_acl_required") result.provider_acl_evidence = inspectNestedArtifact({ root, record: record.provider_acl_evidence, label: "secret_manager provider ACL evidence" });
  else if (record.provider_acl_evidence !== undefined) result.provider_acl_evidence = inspectNestedArtifact({ root, record: record.provider_acl_evidence, label: "secret_manager provider ACL evidence" });
  return result;
}
function inspectRecord({ root, id, record, now, candidateCommit }) { if (!record || typeof record !== "object") throw new Error(`${id} record is required`); const inspected = inspectReleaseArtifact({ root, reference: record.reference }); if (record.checksum && text(record.checksum) !== inspected.checksum) throw new Error(`${id} checksum does not match its local artifact`); if (record.bytes != null && record.bytes !== inspected.bytes) throw new Error(`${id} byte count does not match its local artifact`); const secretManager = id === "secret_manager" ? validateSecretManagerRecord({ root, record, candidateCommit }) : {}; if (id === "backup_restore") validateBackupRestoreRecord({ root, record, candidateCommit, now }); if (id === "policy_publication_approval") validatePolicyApprovalRecord({ root, record, candidateCommit, now }); if (text(record.status) !== "pass") throw new Error(`${id} record status must be pass`); if (!isAccountableOwner(record.owner)) throw new Error(accountableOwnerError(`${id}.owner`)); if (!validPastIso(record.reviewed_at, now)) throw new Error(`${id} reviewed_at must be a past UTC ISO timestamp`); return { id, ...inspected, owner: record.owner, reviewed_at: record.reviewed_at, status: "pass", ...secretManager }; }
export function buildProductionPrerequisiteReview({ root = process.cwd(), prerequisites, records = {}, now = new Date().toISOString() } = {}) {
  const baseErrors = validateProductionPrerequisites(prerequisites).errors;
  const recordErrors = [], entries = [];
  for (const id of PREREQUISITE_RECORD_IDS) {
    try { entries.push(inspectRecord({ root, id, record: records[id], now, candidateCommit: prerequisites?.candidate_commit })); }
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
    if (!isAccountableOwner(entry.owner)) errors.push(accountableOwnerError(`${entry.id}.owner`));
    if (!validPastIso(entry.reviewed_at, now)) errors.push(`${entry.id} reviewed_at must be a past UTC ISO timestamp`);
    if (typeof entry.reference !== "string" || !entry.reference) errors.push(`${entry.id} reference is required`);
    if (!CHECKSUM.test(text(entry.checksum))) errors.push(`${entry.id} checksum is required`);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 1) errors.push(`${entry.id} byte count must be positive`);
    if (entry.id === "secret_manager") {
      if (!validContractChecksums(entry.contract_checksums)) errors.push("secret_manager must retain both approved contract checksums");
      if (!["verified", "provider_acl_required"].includes(entry.private_file_security)) errors.push("secret_manager must retain its private-file security state");
      const aclEvidence = entry.provider_acl_evidence;
      if (entry.private_file_security === "provider_acl_required" && !aclEvidence) errors.push("secret_manager requires provider ACL evidence when local file permissions cannot be verified");
      if (aclEvidence && (!aclEvidence || typeof aclEvidence !== "object" || Array.isArray(aclEvidence) || typeof aclEvidence.reference !== "string" || !aclEvidence.reference || !CHECKSUM.test(text(aclEvidence.checksum)) || !Number.isSafeInteger(aclEvidence.bytes) || aclEvidence.bytes < 1)) errors.push("secret_manager provider ACL evidence must retain a reference, checksum, and positive byte count");
    }
  }
  return errors;
}

export function validateProductionPrerequisiteReviewShape(document, { now = Date.now() } = {}) {
  const errors = validateReviewStructure(document, now);
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
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
      if (entry.id === "secret_manager") validateSecretManagerRecord({ root, record: entry, candidateCommit: document.candidate_commit });
      if (entry.id === "backup_restore") validateBackupRestoreRecord({ root, record: entry, candidateCommit: document.candidate_commit, now });
      if (entry.id === "policy_publication_approval") validatePolicyApprovalRecord({ root, record: entry, candidateCommit: document.candidate_commit, now });
      if (inspected.checksum === entry.checksum && inspected.bytes === entry.bytes) verified.push(entry.id);
    } catch (error) { errors.push(`${entry.id} could not be verified: ${error.message}`); }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], verified };
}
function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const args = process.argv.slice(2); const prerequisitesReference = argumentValue(args, "--prerequisites"); const recordsReference = argumentValue(args, "--records"); const output = argumentValue(args, "--output"); if (!prerequisitesReference || !output) { console.error("Usage: node infra/portal/production-prerequisite-review.mjs --prerequisites work/production/prerequisites.json --records work/production/prerequisite-records.json --output work/production/prerequisite-review.json"); process.exitCode = 1; } else try { const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url))); const prerequisites = JSON.parse(fs.readFileSync(path.resolve(root, prerequisitesReference), "utf8")); const records = recordsReference ? JSON.parse(fs.readFileSync(path.resolve(root, recordsReference), "utf8")) : {}; const document = buildProductionPrerequisiteReview({ root, prerequisites, records }); const destination = path.resolve(root, output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Production prerequisite review: ${destination}`); } catch (error) { console.error(`Unable to build production prerequisite review: ${error.message}`); process.exitCode = 1; } }
