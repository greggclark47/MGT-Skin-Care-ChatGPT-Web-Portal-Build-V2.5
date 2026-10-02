import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectReleaseArtifact, validateReleaseExport } from "./release-export.mjs";
import { validateReleaseCloseout } from "./release-closeout.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const FINALIZATION_VERSION = "1.0";
const RECORD_IDS = Object.freeze(["decision", "rollback", "monitoring", "support", "customer_communications", "audit_archive"]);

function text(value) {
  return String(value || "").trim();
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function releaseFinalizationChecksum(document) {
  const { finalization_checksum: _ignored, ...unsigned } = document || {};
  return `sha256:${createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`;
}

function validPastIso(value, now) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) && parsed <= new Date(now).getTime();
}

function inspectRecord({ root, id, record }) {
  if (!record || typeof record !== "object") throw new Error(`${id} record is required`);
  const inspected = inspectReleaseArtifact({ root, reference: record.reference });
  if (record.checksum && text(record.checksum) !== inspected.checksum) throw new Error(`${id} checksum does not match its local artifact`);
  if (record.bytes != null && record.bytes !== inspected.bytes) throw new Error(`${id} byte count does not match its local artifact`);
  return { id, ...inspected, owner: text(record.owner), reviewed_at: text(record.reviewed_at), status: text(record.status) || "pass" };
}

export function buildReleaseFinalization({ root = process.cwd(), manifest, closeout, review = null, records = {}, now = new Date().toISOString() } = {}) {
  const baseErrors = [];
  const manifestValidation = validateReleaseExport(manifest, { now: Date.parse(now) });
  baseErrors.push(...manifestValidation.errors.map((error) => `manifest.${error}`));
  const closeoutValidation = validateReleaseCloseout(closeout, { manifest, review, now: Date.parse(now) });
  baseErrors.push(...closeoutValidation.errors.map((error) => `closeout.${error}`));
  const recordErrors = [];
  const entries = [];
  for (const id of RECORD_IDS) {
    try {
      const entry = inspectRecord({ root, id, record: records[id] });
      if (entry.status !== "pass") throw new Error(`${id} record status must be pass`);
      if (entry.owner.length < 2) throw new Error(`${id} record must name an owner`);
      if (!validPastIso(entry.reviewed_at, now)) throw new Error(`${id} reviewed_at must be a past ISO timestamp`);
      entries.push(entry);
    } catch (error) {
      recordErrors.push(error.message);
    }
  }
  const errors = [...baseErrors, ...recordErrors];
  const status = baseErrors.length ? "blocked" : closeout?.status !== "release_closeout_ready" ? "pending_closeout" : recordErrors.length ? "blocked" : "ready_for_finalization";
  const document = {
    version: FINALIZATION_VERSION,
    candidate_commit: text(manifest?.candidate_commit),
    bundle_checksum: text(manifest?.bundle_checksum),
    closeout_checksum: text(closeout?.receipt_checksum),
    generated_at: new Date(now).toISOString(),
    status,
    entries,
    errors
  };
  return { ...document, finalization_checksum: releaseFinalizationChecksum(document) };
}

export function validateReleaseFinalization(document, { manifest, closeout, review, now = Date.now() } = {}) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["must be an object"] };
  if (document.version !== FINALIZATION_VERSION) errors.push(`version must be ${FINALIZATION_VERSION}`);
  if (!SHA.test(text(document.candidate_commit)) || text(document.candidate_commit) !== text(manifest?.candidate_commit)) errors.push("candidate_commit must match the export manifest");
  if (!CHECKSUM.test(text(document.bundle_checksum)) || text(document.bundle_checksum) !== text(manifest?.bundle_checksum)) errors.push("bundle_checksum must match the export manifest");
  if (!CHECKSUM.test(text(document.closeout_checksum)) || text(document.closeout_checksum) !== text(closeout?.receipt_checksum)) errors.push("closeout_checksum must match the release closeout");
  if (!validPastIso(document.generated_at, now)) errors.push("generated_at must be a past ISO timestamp");
  if (!CHECKSUM.test(text(document.finalization_checksum)) || text(document.finalization_checksum) !== releaseFinalizationChecksum(document)) errors.push("finalization_checksum must match the canonical finalization document");
  if (!["blocked", "pending_closeout", "ready_for_finalization"].includes(document.status)) errors.push("status must be a known finalization state");
  const entries = Array.isArray(document.entries) ? document.entries : [];
  for (const id of RECORD_IDS) {
    const matches = entries.filter((entry) => entry?.id === id);
    if (matches.length !== 1) errors.push(`${id} must appear exactly once`);
  }
  if (document.status === "ready_for_finalization" && closeout?.status !== "release_closeout_ready") errors.push("ready_for_finalization requires release_closeout_ready");
  if (review && closeout?.status === "release_closeout_ready" && review.status !== "export_complete") errors.push("ready_for_finalization requires export_complete review");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function verifyReleaseFinalization({ root = process.cwd(), document } = {}) {
  const errors = [];
  const verified = [];
  for (const entry of Array.isArray(document?.entries) ? document.entries : []) {
    try {
      const inspected = inspectReleaseArtifact({ root, reference: entry.reference });
      if (inspected.checksum !== text(entry.checksum)) errors.push(`${entry.id} checksum does not match its local artifact`);
      if (inspected.bytes !== entry.bytes) errors.push(`${entry.id} byte count does not match its local artifact`);
      if (inspected.checksum === text(entry.checksum) && inspected.bytes === entry.bytes) verified.push(entry.id);
    } catch (error) {
      errors.push(`${entry?.id || "entry"} could not be verified: ${error.message}`);
    }
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], verified };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const manifestReference = argumentValue(args, "--manifest");
  const closeoutReference = argumentValue(args, "--closeout");
  const reviewReference = argumentValue(args, "--review");
  const recordsReference = argumentValue(args, "--records");
  const output = argumentValue(args, "--output");
  if (!manifestReference || !closeoutReference || !output) {
    console.error("Usage: node infra/portal/release-finalization.mjs --manifest work/exports/release-export.json --closeout work/exports/release-closeout.json --review work/exports/release-receipt.json --records work/exports/finalization-records.json --output work/exports/release-finalization.json");
    process.exitCode = 1;
  } else {
    try {
      const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const manifest = JSON.parse(fs.readFileSync(path.resolve(root, manifestReference), "utf8"));
      const closeout = JSON.parse(fs.readFileSync(path.resolve(root, closeoutReference), "utf8"));
      const review = reviewReference ? JSON.parse(fs.readFileSync(path.resolve(root, reviewReference), "utf8")) : null;
      const records = recordsReference ? JSON.parse(fs.readFileSync(path.resolve(root, recordsReference), "utf8")) : {};
      const document = buildReleaseFinalization({ root, manifest, closeout, review, records });
      const destination = path.resolve(root, output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`);
      console.log(`Release finalization review: ${destination}`);
      if (document.status === "blocked") process.exitCode = 2;
    } catch (error) {
      console.error(`Unable to build release finalization review: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
