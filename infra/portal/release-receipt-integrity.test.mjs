import assert from "node:assert/strict";
import test from "node:test";
import { buildReleaseCloseout } from "./release-closeout.mjs";
import { releaseExportChecksum } from "./release-export.mjs";
import { buildReleaseReceiptReview, releaseReceiptChecksum, validateReleaseReceiptReview } from "./release-receipt.mjs";
import { receiptReviewFixture } from "./test-fixtures/release-receipt.mjs";

const NOW = "2026-01-01T01:00:00.000Z";

function manifest() {
  const value = {
    version: "1.0",
    candidate_commit: "a".repeat(40),
    branch: "codex/test",
    generated_at: "2026-01-01T00:00:00.000Z",
    status: "ready_for_export",
    destinations: {
      github: { status: "pending_push", repository: ["https://github.com/mgt/primary.git", "https://github.com/mgt/mirror.git"], branch: "codex/test", commit: "a".repeat(40) },
      google_drive: { status: "pending_upload" }
    },
    entries: [{ id: "archive", reference: "work/exports/source.zip", kind: "archive", checksum: "sha256:" + "b".repeat(64), bytes: 42 }],
    errors: []
  };
  value.bundle_checksum = releaseExportChecksum(value);
  return value;
}

function validFixture() {
  const exportManifest = manifest();
  return { manifest: exportManifest, review: receiptReviewFixture(exportManifest) };
}

function rehash(review) {
  review.receipt_checksum = releaseReceiptChecksum(review);
  return review;
}

const blockerSeeds = [
  "unobserved", "omitted", "relabelled", "cleared", "duplicated",
  "stale", "future", "pending", "confirmed", "mismatched",
  "github", "drive", "archive", "bundle", "candidate",
  "timestamp", "repository", "checksum", "status", "receipt"
];
const blockerPayloads = blockerSeeds.flatMap((seed, index) => [
  [seed],
  [seed, `${seed}-${index}`],
  [{ code: seed }],
  [null, seed],
  [[seed]]
]);
assert.equal(blockerPayloads.length, 100);

for (const [index, payload] of blockerPayloads.entries()) {
  test(`receipt integrity rejects forged blocker payload ${index + 1}`, () => {
    const fixture = validFixture();
    assert.equal(validateReleaseReceiptReview(fixture.review, { manifest: fixture.manifest, now: NOW }).ok, true);
    fixture.review.errors = payload;
    rehash(fixture.review);
    const validation = validateReleaseReceiptReview(fixture.review, { manifest: fixture.manifest, now: NOW });
    assert.equal(validation.ok, false);
    assert.match(validation.errors.join("; "), /independently recomputed receipt blockers/);
    assert.equal(buildReleaseCloseout({ ...fixture, now: NOW, maxReceiptAgeMinutes: 60 }).status, "blocked");
  });
}

test("receipt integrity rejects a checksum-valid relabelled completion", () => {
  const fixture = validFixture();
  fixture.review.status = "blocked";
  rehash(fixture.review);
  assert.equal(validateReleaseReceiptReview(fixture.review, { manifest: fixture.manifest, now: NOW }).ok, false);
});

test("receipt integrity accepts a faithfully generated pending record", () => {
  const exportManifest = manifest();
  const review = buildReleaseReceiptReview({ manifest: exportManifest, now: "2026-01-01T00:55:00.000Z" });
  assert.equal(review.status, "awaiting_receipts");
  assert.equal(validateReleaseReceiptReview(review, { manifest: exportManifest, now: NOW }).ok, true);
});

test("receipt integrity rejects relabelled pending records after rehashing", () => {
  const exportManifest = manifest();
  const review = buildReleaseReceiptReview({ manifest: exportManifest, now: "2026-01-01T00:55:00.000Z" });
  review.status = "blocked";
  rehash(review);
  assert.equal(validateReleaseReceiptReview(review, { manifest: exportManifest, now: NOW }).ok, false);
});

test("receipt integrity distinguishes genuine blockers from altered blocker records", () => {
  const fixture = validFixture();
  fixture.review.receipts.github.repositories[0].commit = "c".repeat(40);
  const blocked = buildReleaseReceiptReview({
    manifest: fixture.manifest,
    githubReceipt: fixture.review.receipts.github,
    googleDriveReceipt: fixture.review.receipts.google_drive,
    now: "2026-01-01T00:55:00.000Z"
  });
  assert.equal(blocked.status, "blocked");
  const genuine = validateReleaseReceiptReview(blocked, { manifest: fixture.manifest, now: NOW });
  assert.equal(genuine.ok, false);
  assert.doesNotMatch(genuine.errors.join("; "), /independently recomputed receipt blockers/);
  blocked.errors = [...blocked.errors].reverse().concat("fabricated blocker");
  rehash(blocked);
  const altered = validateReleaseReceiptReview(blocked, { manifest: fixture.manifest, now: NOW });
  assert.equal(altered.ok, false);
  assert.match(altered.errors.join("; "), /independently recomputed receipt blockers/);
});

test("receipt integrity validates history at the recorded review time", () => {
  const fixture = validFixture();
  assert.equal(validateReleaseReceiptReview(fixture.review, { manifest: fixture.manifest, now: "2026-02-01T00:00:00.000Z" }).ok, true);
});
