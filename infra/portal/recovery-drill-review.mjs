import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectReleaseArtifact } from "./release-export.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const VERSION = "1.0";
const OWNER = "Gregg Clark of MGT";
const REFERENCE = /^(?:work|infra)\/[A-Za-z0-9._/-]+\.(?:json|log|md|txt)$/;
const SECRET = /(-----BEGIN [A-Z ]+ PRIVATE KEY-----|(?:sk_(?:live|test)_|whsec_|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@)|(?:[A-Z0-9_]*(?:KEY|TOKEN|SECRET))\s*=\s*[^\s]+)/i;
const EVIDENCE_IDS = Object.freeze(["restore_transcript", "rollback_plan", "failed_restore_procedure"]);

function text(value) { return typeof value === "string" ? value.trim() : ""; }
function canonicalize(value) { if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`; return JSON.stringify(value); }
export function recoveryDrillChecksum(document) { const { recovery_drill_checksum: _ignored, ...unsigned } = document || {}; return `sha256:${createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`; }
function validPastIso(value, now) { const parsed = Date.parse(text(value)); return Number.isFinite(parsed) && parsed <= new Date(now).getTime(); }
function safeReference(value) { const reference = text(value); return REFERENCE.test(reference) && !reference.includes("..") && !SECRET.test(reference); }
function boundedIdentifier(value) { const identifier = text(value); return identifier.length >= 2 && identifier.length <= 256 && !/[\u0000-\u001f\u007f]/.test(identifier) && !SECRET.test(identifier); }

function inspectEvidence({ root, id, evidence, now }) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) throw new Error(`${id} evidence is required`);
  if (!safeReference(evidence.reference)) throw new Error(`${id} reference must be a safe local evidence path`);
  const inspected = inspectReleaseArtifact({ root, reference: evidence.reference });
  if (text(evidence.checksum) !== inspected.checksum) throw new Error(`${id} checksum does not match its local artifact`);
  if (evidence.bytes !== inspected.bytes) throw new Error(`${id} byte count does not match its local artifact`);
  if (text(evidence.status) !== "pass") throw new Error(`${id} status must be pass`);
  if (text(evidence.owner) !== OWNER) throw new Error(`${id} owner must be ${OWNER}`);
  if (!validPastIso(evidence.reviewed_at, now)) throw new Error(`${id} reviewed_at must be a past ISO timestamp`);
  return { id, reference: text(evidence.reference), checksum: inspected.checksum, bytes: inspected.bytes, owner: OWNER, reviewed_at: text(evidence.reviewed_at), status: "pass" };
}

export function buildRecoveryDrillReview({ root = process.cwd(), manifest, drill = {}, now = new Date().toISOString(), rtoTargetSeconds = 120, rpoTargetSeconds = 300 } = {}) {
  const errors = [];
  const candidate = text(manifest?.candidate_commit);
  if (!SHA.test(candidate)) errors.push("manifest candidate_commit must be a commit SHA");
  if (!SHA.test(text(drill.candidate_commit)) || text(drill.candidate_commit) !== candidate) errors.push("drill candidate_commit must match the release candidate");
  if (text(drill.status) !== "passed") errors.push("drill status must be passed");
  if (text(drill.owner) !== OWNER) errors.push(`drill owner must be ${OWNER}`);
  if (drill.isolated_restore !== true) errors.push("drill isolated_restore must be true");
  if (!boundedIdentifier(drill.source_identifier)) errors.push("drill source_identifier must identify the approved backup source");
  if (!boundedIdentifier(drill.restore_target_identifier)) errors.push("drill restore_target_identifier must identify a separate restore target");
  if (text(drill.source_identifier) === text(drill.restore_target_identifier)) errors.push("drill source and restore targets must be distinct");
  if (!CHECKSUM.test(text(drill.backup_checksum))) errors.push("drill backup_checksum must be a SHA-256 checksum");
  if (!boundedIdentifier(drill.restored_migration_version)) errors.push("drill restored_migration_version is required");
  for (const field of ["backup_completed_at", "restore_started_at", "restore_completed_at", "verified_at"]) if (!validPastIso(drill[field], now)) errors.push(`drill ${field} must be a past UTC timestamp`);
  const backupCompleted = Date.parse(text(drill.backup_completed_at));
  const restoreStarted = Date.parse(text(drill.restore_started_at));
  const restoreCompleted = Date.parse(text(drill.restore_completed_at));
  const verified = Date.parse(text(drill.verified_at));
  if ([backupCompleted, restoreStarted, restoreCompleted, verified].every(Number.isFinite) && (restoreStarted < backupCompleted || restoreCompleted < restoreStarted || verified < restoreCompleted)) errors.push("drill timestamps must be ordered backup, restore start, restore completion, then verification");
  if (!Number.isSafeInteger(drill.rto_seconds) || drill.rto_seconds < 1 || drill.rto_seconds > 604800) errors.push("drill rto_seconds must be bounded");
  if (!Number.isSafeInteger(drill.rpo_seconds) || drill.rpo_seconds < 0 || drill.rpo_seconds > 604800) errors.push("drill rpo_seconds must be bounded");
  if (Number.isSafeInteger(drill.rto_seconds) && Number.isSafeInteger(rtoTargetSeconds) && drill.rto_seconds > rtoTargetSeconds) errors.push("drill rto_seconds exceeds the accepted target");
  if (Number.isSafeInteger(drill.rpo_seconds) && Number.isSafeInteger(rpoTargetSeconds) && drill.rpo_seconds > rpoTargetSeconds) errors.push("drill rpo_seconds exceeds the accepted target");
  const evidence = [];
  for (const id of EVIDENCE_IDS) {
    try { evidence.push(inspectEvidence({ root, id, evidence: Array.isArray(drill.evidence) ? drill.evidence.find((item) => item?.id === id) : undefined, now })); }
    catch (error) { errors.push(error.message); }
  }
  const decision = drill.decision;
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) errors.push("drill decision is required");
  else {
    if (text(decision.decider) !== OWNER) errors.push(`drill decision decider must be ${OWNER}`);
    if (text(decision.decision) !== "accepted") errors.push("drill decision must be accepted");
    if (!validPastIso(decision.decided_at, now)) errors.push("drill decision decided_at must be a past UTC timestamp");
  }
  if (SECRET.test(canonicalize(drill))) errors.push("drill evidence must not contain credential-like values");
  const status = errors.length ? "blocked" : "ready_for_recovery_review";
  const document = { version: VERSION, candidate_commit: candidate, generated_at: new Date(now).toISOString(), status, target_seconds: { rto: rtoTargetSeconds, rpo: rpoTargetSeconds }, measured_seconds: { rto: Number.isSafeInteger(drill.rto_seconds) ? drill.rto_seconds : null, rpo: Number.isSafeInteger(drill.rpo_seconds) ? drill.rpo_seconds : null }, restored_migration_version: text(drill.restored_migration_version), evidence, decision: decision && typeof decision === "object" ? { decider: text(decision.decider), decision: text(decision.decision), decided_at: text(decision.decided_at) } : null, errors };
  return { ...document, recovery_drill_checksum: recoveryDrillChecksum(document) };
}

export function validateRecoveryDrillReview(document, { manifest, now = Date.now(), rtoTargetSeconds = 120, rpoTargetSeconds = 300 } = {}) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["must be an object"] };
  if (document.version !== VERSION) errors.push(`version must be ${VERSION}`);
  if (!SHA.test(text(document.candidate_commit)) || text(document.candidate_commit) !== text(manifest?.candidate_commit)) errors.push("candidate_commit must match the release manifest");
  if (!validPastIso(document.generated_at, now)) errors.push("generated_at must be a past ISO timestamp");
  if (!CHECKSUM.test(text(document.recovery_drill_checksum)) || text(document.recovery_drill_checksum) !== recoveryDrillChecksum(document)) errors.push("recovery_drill_checksum must match the canonical review");
  if (!Number.isSafeInteger(document.target_seconds?.rto) || document.target_seconds.rto !== rtoTargetSeconds || !Number.isSafeInteger(document.target_seconds?.rpo) || document.target_seconds.rpo !== rpoTargetSeconds) errors.push("target_seconds must match the accepted recovery targets");
  if (!Number.isSafeInteger(document.measured_seconds?.rto) || !Number.isSafeInteger(document.measured_seconds?.rpo)) errors.push("measured_seconds must contain bounded measurements");
  if (!Array.isArray(document.evidence) || EVIDENCE_IDS.some((id) => document.evidence.filter((entry) => entry?.id === id).length !== 1)) errors.push("recovery evidence must contain each required record exactly once");
  if (!["blocked", "ready_for_recovery_review"].includes(document.status)) errors.push("status must be known");
  if (document.status === "ready_for_recovery_review" && document.errors?.length) errors.push("ready_for_recovery_review cannot contain errors");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function verifyRecoveryDrillReview({ root = process.cwd(), document } = {}) {
  const errors = [];
  const verified = [];
  for (const entry of Array.isArray(document?.evidence) ? document.evidence : []) {
    try {
      const inspected = inspectReleaseArtifact({ root, reference: entry.reference });
      if (inspected.checksum !== text(entry.checksum)) errors.push(`${entry.id} checksum does not match local artifact`);
      if (inspected.bytes !== entry.bytes) errors.push(`${entry.id} byte count does not match local artifact`);
      if (inspected.checksum === text(entry.checksum) && inspected.bytes === entry.bytes) verified.push(entry.id);
    } catch (error) { errors.push(`${entry?.id || "evidence"} could not be verified: ${error.message}`); }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], verified };
}

function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2); const manifestReference = argumentValue(args, "--manifest"); const drillReference = argumentValue(args, "--drill"); const output = argumentValue(args, "--output");
  if (!manifestReference || !drillReference || !output) { console.error("Usage: node infra/portal/recovery-drill-review.mjs --manifest work/exports/release-export.json --drill work/recovery/drill.json --output work/recovery/drill-review.json"); process.exitCode = 1; }
  else try { const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url))); const manifest = JSON.parse(fs.readFileSync(path.resolve(root, manifestReference), "utf8")); const drill = JSON.parse(fs.readFileSync(path.resolve(root, drillReference), "utf8")); const document = buildRecoveryDrillReview({ root, manifest, drill }); const destination = path.resolve(root, output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Recovery drill review: ${destination}`); if (document.status === "blocked") process.exitCode = 2; }
  catch (error) { console.error(`Unable to build recovery drill review: ${error.message}`); process.exitCode = 1; }
}
