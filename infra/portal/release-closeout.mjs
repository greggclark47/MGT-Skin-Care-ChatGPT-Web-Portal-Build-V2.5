import fs from "node:fs";
import { utcTimestamp } from "./approval-window.mjs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateReleaseExport } from "./release-export.mjs";
import { validateReleaseReceiptReview } from "./release-receipt.mjs";
import { readStrictJsonFile } from "./strict-json.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const CLOSEOUT_VERSION = "1.0";
const DEFAULT_MAX_RECEIPT_AGE_MINUTES = 1440;

function text(value) {
  return String(value || "").trim();
}

function validPastIso(value, now) {
  const parsed = utcTimestamp(value);
  return Number.isFinite(parsed) && parsed <= new Date(now).getTime();
}

function ageMinutes(value, now) {
  return (new Date(now).getTime() - utcTimestamp(value)) / 60000;
}

function receipt(review, key) {
  const value = review?.receipts?.[key];
  return value?.status === "confirmed" ? value : null;
}

export function buildReleaseCloseout({ manifest, review, now = new Date().toISOString(), maxReceiptAgeMinutes = DEFAULT_MAX_RECEIPT_AGE_MINUTES } = {}) {
  if (!Number.isFinite(new Date(now).getTime())) throw new Error("now must be a valid timestamp");
  const errors = [];
  const manifestValidation = validateReleaseExport(manifest, { now: Date.parse(now) });
  errors.push(...manifestValidation.errors.map((error) => `manifest.${error}`));
  const reviewValidation = validateReleaseReceiptReview(review, { manifest, now: Date.parse(now) });
  errors.push(...reviewValidation.errors.map((error) => `review.${error}`));
  const maxAge = Number(maxReceiptAgeMinutes);
  if (!Number.isSafeInteger(maxAge) || maxAge < 1 || maxAge > 10080) errors.push("maxReceiptAgeMinutes must be an integer between 1 and 10080");

  const github = receipt(review, "github");
  const drive = receipt(review, "google_drive");
  const receiptAges = {};
  // Multi-remote receipts carry observation timestamps on each repository.
  // A fresh aggregate timestamp must never hide an older repository receipt.
  if (github) {
    const observations = Array.isArray(github.repositories) ? github.repositories : [github];
    if (!observations.length || observations.some(value => !validPastIso(value?.observed_at, now))) errors.push("every github repository requires a valid observation timestamp");
    else receiptAges.github = Math.max(...observations.map(value => ageMinutes(value.observed_at, now)));
  }
  if (drive && validPastIso(drive.observed_at, now)) receiptAges.google_drive = ageMinutes(drive.observed_at, now);
  if (review?.status === "blocked" || errors.length) {
    return { version: CLOSEOUT_VERSION, candidate_commit: text(manifest?.candidate_commit), bundle_checksum: text(manifest?.bundle_checksum), generated_at: new Date(now).toISOString(), max_receipt_age_minutes: maxAge, receipt_ages_minutes: receiptAges, status: "blocked", receipt_checksum: text(review?.receipt_checksum), errors };
  }
  if (!github || !drive) {
    return { version: CLOSEOUT_VERSION, candidate_commit: text(manifest?.candidate_commit), bundle_checksum: text(manifest?.bundle_checksum), generated_at: new Date(now).toISOString(), max_receipt_age_minutes: maxAge, receipt_ages_minutes: receiptAges, status: "pending_receipts", receipt_checksum: text(review?.receipt_checksum), errors: ["both destination receipts are required before closeout"] };
  }
  const stale = Object.entries(receiptAges).filter(([, age]) => age > maxAge).map(([key]) => `${key} receipt exceeds the ${maxAge}-minute freshness window`);
  if (stale.length) {
    return { version: CLOSEOUT_VERSION, candidate_commit: text(manifest?.candidate_commit), bundle_checksum: text(manifest?.bundle_checksum), generated_at: new Date(now).toISOString(), max_receipt_age_minutes: maxAge, receipt_ages_minutes: receiptAges, status: "stale_receipts", receipt_checksum: text(review?.receipt_checksum), errors: stale };
  }
  return { version: CLOSEOUT_VERSION, candidate_commit: text(manifest?.candidate_commit), bundle_checksum: text(manifest?.bundle_checksum), generated_at: new Date(now).toISOString(), max_receipt_age_minutes: maxAge, receipt_ages_minutes: receiptAges, status: "release_closeout_ready", receipt_checksum: text(review?.receipt_checksum), errors: [] };
}

export function validateReleaseCloseout(closeout, { manifest, review, now = Date.now() } = {}) {
  const errors = [];
  if (!closeout || typeof closeout !== "object" || Array.isArray(closeout)) return { ok: false, errors: ["must be an object"] };
  if (closeout.version !== CLOSEOUT_VERSION) errors.push(`version must be ${CLOSEOUT_VERSION}`);
  if (!SHA.test(text(closeout.candidate_commit)) || text(closeout.candidate_commit) !== text(manifest?.candidate_commit)) errors.push("candidate_commit must match the export manifest");
  if (!CHECKSUM.test(text(closeout.bundle_checksum)) || text(closeout.bundle_checksum) !== text(manifest?.bundle_checksum)) errors.push("bundle_checksum must match the export manifest");
  if (!validPastIso(closeout.generated_at, now)) errors.push("generated_at must be a past ISO timestamp");
  if (!Number.isSafeInteger(closeout.max_receipt_age_minutes) || closeout.max_receipt_age_minutes < 1 || closeout.max_receipt_age_minutes > 10080) errors.push("max_receipt_age_minutes must be bounded");
  if (!CHECKSUM.test(text(closeout.receipt_checksum)) || text(closeout.receipt_checksum) !== text(review?.receipt_checksum)) errors.push("receipt_checksum must match the receipt review");
  if (!["blocked", "pending_receipts", "stale_receipts", "release_closeout_ready"].includes(closeout.status)) errors.push("status must be a known closeout state");
  if (!Array.isArray(closeout.errors)) errors.push("errors must be an array");
  if (closeout.status === "release_closeout_ready" && review?.status !== "export_complete") errors.push("release_closeout_ready requires export_complete receipt review");
  // Audit the recorded decision at its original time, not at a later audit time.
  // This validates history; a new operational decision must build a fresh closeout.
  if (validPastIso(closeout.generated_at, now) && Number.isSafeInteger(closeout.max_receipt_age_minutes) && closeout.max_receipt_age_minutes >= 1 && closeout.max_receipt_age_minutes <= 10080) {
    const expected = buildReleaseCloseout({ manifest, review, now: closeout.generated_at, maxReceiptAgeMinutes: closeout.max_receipt_age_minutes });
    if (closeout.status !== expected.status) errors.push("status must match independently recomputed closeout state");
    const ages = closeout.receipt_ages_minutes;
    if (!ages || typeof ages !== "object" || Array.isArray(ages) || Object.keys(ages).length !== Object.keys(expected.receipt_ages_minutes).length || Object.entries(expected.receipt_ages_minutes).some(([key, age]) => ages[key] !== age)) errors.push("receipt_ages_minutes must match independently recomputed receipt ages");
    if (JSON.stringify(closeout.errors) !== JSON.stringify(expected.errors)) errors.push("errors must match independently recomputed closeout blockers");
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const manifestReference = argumentValue(args, "--manifest");
  const reviewReference = argumentValue(args, "--review");
  const output = argumentValue(args, "--output");
  const maxAge = Number(argumentValue(args, "--max-receipt-age-minutes") || DEFAULT_MAX_RECEIPT_AGE_MINUTES);
  if (!manifestReference || !reviewReference || !output) {
    console.error("Usage: node infra/portal/release-closeout.mjs --manifest work/exports/release-export.json --review work/exports/release-receipt.json --output work/exports/release-closeout.json [--max-receipt-age-minutes 1440]");
    process.exitCode = 1;
  } else {
    try {
      const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const manifest = readStrictJsonFile(path.resolve(root, manifestReference));
      const review = readStrictJsonFile(path.resolve(root, reviewReference));
      const closeout = buildReleaseCloseout({ manifest, review, maxReceiptAgeMinutes: maxAge });
      const destination = path.resolve(root, output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(closeout, null, 2)}\n`);
      console.log(`Release closeout review: ${destination}`);
      if (closeout.status === "blocked") process.exitCode = 2;
    } catch (error) {
      console.error(`Unable to build release closeout review: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
