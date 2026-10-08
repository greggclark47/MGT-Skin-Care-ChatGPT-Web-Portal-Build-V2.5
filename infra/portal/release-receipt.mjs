import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateReleaseExport } from "./release-export.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;
const RECEIPT_VERSION = "1.0";

function text(value) {
  return String(value || "").trim();
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function releaseReceiptChecksum(review) {
  const { receipt_checksum: _ignored, ...unsigned } = review || {};
  return `sha256:${createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`;
}

function validPastIso(value, now) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) && parsed <= new Date(now).getTime();
}

function archiveEntry(manifest) {
  return (Array.isArray(manifest?.entries) ? manifest.entries : []).find((entry) => entry?.kind === "archive") || null;
}

function githubReceiptErrors(manifest, receipt, now) {
  const errors = [];
  if (!receipt) return errors;
  if (receipt.status !== "confirmed") errors.push("github receipt status must be confirmed");
  if (PLACEHOLDER.test(JSON.stringify(receipt))) errors.push("github receipt must not contain placeholders");
  const repositories = Array.isArray(manifest.destinations?.github?.repository) ? manifest.destinations.github.repository : [];
  const observations = Array.isArray(receipt.repositories) ? receipt.repositories : receipt.repository ? [receipt] : [];
  if (!observations.length) errors.push("github receipt must include observed repository metadata");
  for (const observation of observations) {
    if (!SHA.test(text(observation.commit)) || text(observation.commit) !== text(manifest.candidate_commit)) errors.push("github receipt commit must match the export candidate");
    if (!validPastIso(observation.observed_at, now)) errors.push("github receipt observed_at must be a past ISO timestamp");
    if (repositories.length && !repositories.includes(text(observation.repository))) errors.push("github receipt repository must match an observed export remote");
  }
  const observedRepositories = observations.map((observation) => text(observation.repository)).filter(Boolean);
  if (new Set(observedRepositories).size !== observedRepositories.length) errors.push("github receipt repositories must be unique");
  for (const repository of repositories) if (!observedRepositories.includes(repository)) errors.push(`github receipt is missing configured repository ${repository}`);
  return errors;
}

function driveReceiptErrors(manifest, receipt, now) {
  const errors = [];
  const archive = archiveEntry(manifest);
  if (!receipt) return errors;
  if (receipt.status !== "confirmed") errors.push("google_drive receipt status must be confirmed");
  if (!text(receipt.file_id) || PLACEHOLDER.test(text(receipt.file_id))) errors.push("google_drive receipt must include an observed file_id");
  if (!/^https:\/\//.test(text(receipt.web_url))) errors.push("google_drive receipt must include an HTTPS web_url");
  if (!validPastIso(receipt.observed_at, now)) errors.push("google_drive receipt observed_at must be a past ISO timestamp");
  if (!CHECKSUM.test(text(receipt.bundle_checksum)) || text(receipt.bundle_checksum) !== text(manifest.bundle_checksum)) errors.push("google_drive receipt bundle_checksum must match the export manifest");
  if (archive && text(receipt.archive_checksum) !== text(archive.checksum)) errors.push("google_drive receipt archive_checksum must match the export archive");
  if (archive && receipt.bytes !== archive.bytes) errors.push("google_drive receipt bytes must match the export archive");
  return errors;
}

export function buildReleaseReceiptReview({ manifest, githubReceipt = null, googleDriveReceipt = null, now = new Date().toISOString() } = {}) {
  const errors = [];
  const manifestValidation = validateReleaseExport(manifest, { now: Date.parse(now) });
  errors.push(...manifestValidation.errors.map((error) => `manifest.${error}`));
  errors.push(...githubReceiptErrors(manifest, githubReceipt, now));
  errors.push(...driveReceiptErrors(manifest, googleDriveReceipt, now));
  const githubConfirmed = Boolean(githubReceipt) && githubReceipt.status === "confirmed" && githubReceiptErrors(manifest, githubReceipt, now).length === 0;
  const driveConfirmed = Boolean(googleDriveReceipt) && googleDriveReceipt.status === "confirmed" && driveReceiptErrors(manifest, googleDriveReceipt, now).length === 0;
  const status = errors.length ? "blocked" : githubConfirmed && driveConfirmed ? "export_complete" : "awaiting_receipts";
  const review = {
    version: RECEIPT_VERSION,
    candidate_commit: text(manifest?.candidate_commit),
    bundle_checksum: text(manifest?.bundle_checksum),
    generated_at: new Date(now).toISOString(),
    status,
    receipts: {
      github: githubReceipt || { status: "pending" },
      google_drive: googleDriveReceipt || { status: "pending" }
    },
    errors
  };
  return { ...review, receipt_checksum: releaseReceiptChecksum(review) };
}

export function validateReleaseReceiptReview(review, { manifest, now = Date.now() } = {}) {
  const errors = [];
  if (!review || typeof review !== "object" || Array.isArray(review)) return { ok: false, errors: ["must be an object"] };
  if (review.version !== RECEIPT_VERSION) errors.push(`version must be ${RECEIPT_VERSION}`);
  if (!SHA.test(text(review.candidate_commit)) || text(review.candidate_commit) !== text(manifest?.candidate_commit)) errors.push("candidate_commit must match the export manifest");
  if (!CHECKSUM.test(text(review.bundle_checksum)) || text(review.bundle_checksum) !== text(manifest?.bundle_checksum)) errors.push("bundle_checksum must match the export manifest");
  if (!validPastIso(review.generated_at, now)) errors.push("generated_at must be a past ISO timestamp");
  if (!CHECKSUM.test(text(review.receipt_checksum)) || text(review.receipt_checksum) !== releaseReceiptChecksum(review)) errors.push("receipt_checksum must match the canonical review");
  if (!["blocked", "awaiting_receipts", "export_complete"].includes(review.status)) errors.push("status must be a known receipt state");
  const github = review.receipts?.github?.status === "confirmed" ? review.receipts.github : null;
  const drive = review.receipts?.google_drive?.status === "confirmed" ? review.receipts.google_drive : null;
  errors.push(...githubReceiptErrors(manifest, github, now));
  errors.push(...driveReceiptErrors(manifest, drive, now));
  if (review.status === "export_complete" && (!github || !drive)) errors.push("export_complete requires both destination receipts");
  if (review.status === "awaiting_receipts" && (github && drive)) errors.push("awaiting_receipts cannot contain two confirmed receipts");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const manifestReference = argumentValue(args, "--manifest");
  const output = argumentValue(args, "--output");
  const githubReference = argumentValue(args, "--github-receipt");
  const driveReference = argumentValue(args, "--drive-receipt");
  if (!manifestReference || !output) {
    console.error("Usage: node infra/portal/release-receipt.mjs --manifest work/exports/release-export.json --output work/exports/release-receipt.json [--github-receipt path] [--drive-receipt path]");
    process.exitCode = 1;
  } else {
    try {
      const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const manifest = JSON.parse(fs.readFileSync(path.resolve(root, manifestReference), "utf8"));
      const githubReceipt = githubReference ? JSON.parse(fs.readFileSync(path.resolve(root, githubReference), "utf8")) : null;
      const googleDriveReceipt = driveReference ? JSON.parse(fs.readFileSync(path.resolve(root, driveReference), "utf8")) : null;
      const review = buildReleaseReceiptReview({ manifest, githubReceipt, googleDriveReceipt });
      const destination = path.resolve(root, output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(review, null, 2)}\n`);
      console.log(`Release receipt review: ${destination}`);
      if (review.status === "blocked") process.exitCode = 2;
    } catch (error) {
      console.error(`Unable to build release receipt review: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
