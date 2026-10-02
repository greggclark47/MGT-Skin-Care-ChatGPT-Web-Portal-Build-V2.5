import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReleaseReceiptReview,
  releaseReceiptChecksum,
  validateReleaseReceiptReview
} from "./release-receipt.mjs";
import { releaseExportChecksum } from "./release-export.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const BUNDLE = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ARCHIVE = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function manifest() {
  const value = {
    version: "1.0",
    candidate_commit: COMMIT,
    branch: "codex/test",
    generated_at: "2026-01-01T00:00:00.000Z",
    status: "ready_for_export",
    destinations: { github: { status: "pending_push", repository: ["https://github.com/example/repo.git"], branch: "codex/test", commit: COMMIT }, google_drive: { status: "pending_upload" } },
    entries: [{ id: "archive", reference: "work/exports/package.zip", kind: "archive", checksum: ARCHIVE, bytes: 42 }],
    errors: [],
  };
  value.bundle_checksum = releaseExportChecksum(value);
  return value;
}

function receipts() {
  return {
    github: { status: "confirmed", repository: "https://github.com/example/repo.git", branch: "codex/test", commit: COMMIT, observed_at: "2026-01-01T01:00:00.000Z" },
    drive: { status: "confirmed", file_id: "1AbcDEF", web_url: "https://drive.google.com/file/d/1AbcDEF/view", bundle_checksum: "", archive_checksum: ARCHIVE, bytes: 42, observed_at: "2026-01-01T01:05:00.000Z" }
  };
}

test("stays awaiting receipts until both destinations confirm", () => {
  const review = buildReleaseReceiptReview({ manifest: manifest(), now: "2026-01-02T00:00:00.000Z" });
  assert.equal(review.status, "awaiting_receipts");
  assert.equal(validateReleaseReceiptReview(review, { manifest: manifest(), now: Date.parse("2026-01-02T00:00:00.000Z") }).ok, true);
});

test("records export complete only with matching GitHub and Drive receipts", () => {
  const data = receipts();
  data.drive.bundle_checksum = manifest().bundle_checksum;
  const review = buildReleaseReceiptReview({ manifest: manifest(), githubReceipt: data.github, googleDriveReceipt: data.drive, now: "2026-01-02T00:00:00.000Z" });
  assert.equal(review.status, "export_complete");
  assert.equal(validateReleaseReceiptReview(review, { manifest: manifest(), now: Date.parse("2026-01-02T00:00:00.000Z") }).ok, true);
  assert.equal(review.receipt_checksum, releaseReceiptChecksum(review));
});

test("blocks mismatched candidate, bundle, or Drive file metadata", () => {
  const data = receipts();
  data.github.commit = "fedcba9876543210fedcba9876543210fedcba98";
  data.drive.bundle_checksum = "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
  const review = buildReleaseReceiptReview({ manifest: manifest(), githubReceipt: data.github, googleDriveReceipt: data.drive, now: "2026-01-02T00:00:00.000Z" });
  assert.equal(review.status, "blocked");
  assert.match(review.errors.join("; "), /commit must match|bundle_checksum must match/);
});

test("rejects fabricated completion without observed Drive URL and id", () => {
  const data = receipts();
  data.drive.file_id = "";
  data.drive.web_url = "placeholder";
  const review = buildReleaseReceiptReview({ manifest: manifest(), githubReceipt: data.github, googleDriveReceipt: data.drive, now: "2026-01-02T00:00:00.000Z" });
  assert.equal(review.status, "blocked");
  assert.match(review.errors.join("; "), /file_id|HTTPS web_url/);
});
