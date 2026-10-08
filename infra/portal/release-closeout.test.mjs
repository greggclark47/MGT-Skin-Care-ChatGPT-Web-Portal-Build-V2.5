import test from "node:test";
import assert from "node:assert/strict";
import { releaseExportChecksum } from "./release-export.mjs";
import { buildReleaseReceiptReview } from "./release-receipt.mjs";
import { buildReleaseCloseout, validateReleaseCloseout } from "./release-closeout.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
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
    errors: []
  };
  value.bundle_checksum = releaseExportChecksum(value);
  return value;
}

function completeReview(value) {
  const github = { status: "confirmed", repository: "https://github.com/example/repo.git", branch: "codex/test", commit: COMMIT, observed_at: "2026-01-01T01:00:00.000Z" };
  const drive = { status: "confirmed", file_id: "1AbcDEF", web_url: "https://drive.google.com/file/d/1AbcDEF/view", bundle_checksum: value.bundle_checksum, archive_checksum: ARCHIVE, bytes: 42, observed_at: "2026-01-01T01:05:00.000Z" };
  return buildReleaseReceiptReview({ manifest: value, githubReceipt: github, googleDriveReceipt: drive, now: "2026-01-01T01:10:00.000Z" });
}

test("keeps closeout pending while receipts are missing", () => {
  const value = manifest();
  const review = buildReleaseReceiptReview({ manifest: value, now: "2026-01-02T00:00:00.000Z" });
  const closeout = buildReleaseCloseout({ manifest: value, review, now: "2026-01-02T00:00:00.000Z" });
  assert.equal(closeout.status, "pending_receipts");
});

test("accepts a fresh dual-destination closeout", () => {
  const value = manifest();
  const review = completeReview(value);
  const closeout = buildReleaseCloseout({ manifest: value, review, now: "2026-01-01T02:00:00.000Z", maxReceiptAgeMinutes: 120 });
  assert.equal(closeout.status, "release_closeout_ready");
  assert.equal(validateReleaseCloseout(closeout, { manifest: value, review, now: Date.parse("2026-01-02T00:00:00.000Z") }).ok, true);
});

test("blocks stale receipts", () => {
  const value = manifest();
  const review = completeReview(value);
  const closeout = buildReleaseCloseout({ manifest: value, review, now: "2026-01-02T00:00:00.000Z", maxReceiptAgeMinutes: 60 });
  assert.equal(closeout.status, "stale_receipts");
  assert.match(closeout.errors.join("; "), /freshness window/);
});

test("rejects a fabricated ready state", () => {
  const value = manifest();
  const review = buildReleaseReceiptReview({ manifest: value, now: "2026-01-02T00:00:00.000Z" });
  const closeout = buildReleaseCloseout({ manifest: value, review, now: "2026-01-02T00:00:00.000Z" });
  closeout.status = "release_closeout_ready";
  assert.equal(validateReleaseCloseout(closeout, { manifest: value, review, now: Date.parse("2026-01-02T00:00:00.000Z") }).ok, false);
});
