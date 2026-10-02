import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectReleaseArtifact, validateReleaseExport } from "./release-export.mjs";
import { validateReleaseCloseout } from "./release-closeout.mjs";
import { validateReleaseFinalization } from "./release-finalization.mjs";
import { validateReleaseLaunchReview } from "./release-launch-review.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const REVIEW_VERSION = "1.0";
export const EXECUTION_RECORD_IDS = Object.freeze([
  "command_authority",
  "approval_ledger",
  "dry_run",
  "execution_log",
  "release_window",
  "freeze_clearance",
  "customer_communication",
  "rollback_command",
  "first_hour_watch",
  "incident_route",
  "customer_impact_watch",
  "support_handoff"
]);

function text(value) { return String(value || "").trim(); }
function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function releaseExecutionReviewChecksum(document) {
  const { execution_review_checksum: _ignored, ...unsigned } = document || {};
  return `sha256:${createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`;
}
function validPastIso(value, now) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) && parsed <= new Date(now).getTime();
}
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

export function buildReleaseExecutionReview({ root = process.cwd(), manifest, closeout, review, finalization, launchReview, records = {}, now = new Date().toISOString() } = {}) {
  const baseErrors = [];
  const manifestValidation = validateReleaseExport(manifest, { now: Date.parse(now) });
  baseErrors.push(...manifestValidation.errors.map((error) => `manifest.${error}`));
  baseErrors.push(...validateReleaseCloseout(closeout, { manifest, review, now: Date.parse(now) }).errors.map((error) => `closeout.${error}`));
  if (finalization?.status === "ready_for_finalization") baseErrors.push(...validateReleaseFinalization(finalization, { manifest, closeout, review, now: Date.parse(now) }).errors.map((error) => `finalization.${error}`));
  if (launchReview?.status === "ready_for_launch_review") baseErrors.push(...validateReleaseLaunchReview(launchReview, { manifest, finalization, now: Date.parse(now) }).errors.map((error) => `launch_review.${error}`));
  const recordErrors = [];
  const entries = [];
  for (const id of EXECUTION_RECORD_IDS) {
    try { entries.push(inspectRecord({ root, id, record: records[id], now })); }
    catch (error) { recordErrors.push(error.message); }
  }
  const errors = [...baseErrors, ...recordErrors];
  const status = baseErrors.length ? "blocked" : launchReview?.status !== "ready_for_launch_review" ? "pending_launch_review" : recordErrors.length ? "blocked" : "ready_for_execution_review";
  const document = { version: REVIEW_VERSION, candidate_commit: text(manifest?.candidate_commit), bundle_checksum: text(manifest?.bundle_checksum), launch_review_checksum: text(launchReview?.launch_review_checksum), generated_at: new Date(now).toISOString(), status, entries, errors };
  return { ...document, execution_review_checksum: releaseExecutionReviewChecksum(document) };
}

export function validateReleaseExecutionReview(document, { manifest, launchReview, now = Date.now() } = {}) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["must be an object"] };
  if (document.version !== REVIEW_VERSION) errors.push(`version must be ${REVIEW_VERSION}`);
  if (!SHA.test(text(document.candidate_commit)) || text(document.candidate_commit) !== text(manifest?.candidate_commit)) errors.push("candidate_commit must match the export manifest");
  if (!CHECKSUM.test(text(document.bundle_checksum)) || text(document.bundle_checksum) !== text(manifest?.bundle_checksum)) errors.push("bundle_checksum must match the export manifest");
  if (!CHECKSUM.test(text(document.launch_review_checksum)) || text(document.launch_review_checksum) !== text(launchReview?.launch_review_checksum)) errors.push("launch_review_checksum must match the launch review");
  if (!validPastIso(document.generated_at, now)) errors.push("generated_at must be a past ISO timestamp");
  if (!CHECKSUM.test(text(document.execution_review_checksum)) || text(document.execution_review_checksum) !== releaseExecutionReviewChecksum(document)) errors.push("execution_review_checksum must match the canonical execution review");
  if (!["blocked", "pending_launch_review", "ready_for_execution_review"].includes(document.status)) errors.push("status must be a known execution-review state");
  for (const id of EXECUTION_RECORD_IDS) if (Array.isArray(document.entries) ? document.entries.filter((entry) => entry?.id === id).length !== 1 : true) errors.push(`${id} must appear exactly once`);
  if (document.status === "ready_for_execution_review" && launchReview?.status !== "ready_for_launch_review") errors.push("ready_for_execution_review requires ready_for_launch_review");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function verifyReleaseExecutionReview({ root = process.cwd(), document } = {}) {
  const errors = [];
  const verified = [];
  for (const entry of Array.isArray(document?.entries) ? document.entries : []) {
    try {
      const inspected = inspectReleaseArtifact({ root, reference: entry.reference });
      if (inspected.checksum !== text(entry.checksum)) errors.push(`${entry.id} checksum does not match its local artifact`);
      if (inspected.bytes !== entry.bytes) errors.push(`${entry.id} byte count does not match its local artifact`);
      if (inspected.checksum === text(entry.checksum) && inspected.bytes === entry.bytes) verified.push(entry.id);
    } catch (error) { errors.push(`${entry?.id || "entry"} could not be verified: ${error.message}`); }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], verified };
}

function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const manifestReference = argumentValue(args, "--manifest");
  const closeoutReference = argumentValue(args, "--closeout");
  const reviewReference = argumentValue(args, "--review");
  const finalizationReference = argumentValue(args, "--finalization");
  const launchReference = argumentValue(args, "--launch-review");
  const recordsReference = argumentValue(args, "--records");
  const output = argumentValue(args, "--output");
  if (!manifestReference || !closeoutReference || !finalizationReference || !launchReference || !output) {
    console.error("Usage: node infra/portal/release-execution-review.mjs --manifest work/exports/release-export.json --closeout work/exports/release-closeout.json --review work/exports/release-receipt.json --finalization work/exports/release-finalization.json --launch-review work/exports/release-launch-review.json --records work/exports/execution-records.json --output work/exports/release-execution-review.json");
    process.exitCode = 1;
  } else {
    try {
      const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const manifest = JSON.parse(fs.readFileSync(path.resolve(root, manifestReference), "utf8"));
      const closeout = JSON.parse(fs.readFileSync(path.resolve(root, closeoutReference), "utf8"));
      const review = reviewReference ? JSON.parse(fs.readFileSync(path.resolve(root, reviewReference), "utf8")) : null;
      const finalization = JSON.parse(fs.readFileSync(path.resolve(root, finalizationReference), "utf8"));
      const launchReview = JSON.parse(fs.readFileSync(path.resolve(root, launchReference), "utf8"));
      const records = recordsReference ? JSON.parse(fs.readFileSync(path.resolve(root, recordsReference), "utf8")) : {};
      const document = buildReleaseExecutionReview({ root, manifest, closeout, review, finalization, launchReview, records });
      const destination = path.resolve(root, output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`);
      console.log(`Release execution review: ${destination}`);
      if (document.status === "blocked") process.exitCode = 2;
    } catch (error) {
      console.error(`Unable to build release execution review: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
