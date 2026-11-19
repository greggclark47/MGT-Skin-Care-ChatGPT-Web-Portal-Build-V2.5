import assert from "node:assert/strict";
import test from "node:test";
import { releaseExportChecksum } from "./release-export.mjs";
import { receiptReviewFixture } from "./test-fixtures/release-receipt.mjs";
import { releaseReceiptChecksum, validateReleaseReceiptReview } from "./release-receipt.mjs";
import { buildReleaseCloseout, validateReleaseCloseout } from "./release-closeout.mjs";

const now = "2026-01-01T01:00:00.000Z";
function fixture(single = false) {
  const repositories = ["https://github.com/mgt/primary.git", "https://github.com/mgt/mirror.git"].slice(0, single ? 1 : 2);
  const manifest = { version: "1.0", candidate_commit: "a".repeat(40), branch: "codex/test", generated_at: "2026-01-01T00:00:00.000Z", status: "ready_for_export",
    destinations: { github: { status: "pending_push", repository: repositories, branch: "codex/test", commit: "a".repeat(40) }, google_drive: { status: "pending_upload" } },
    entries: [{ id: "archive", reference: "work/exports/source.zip", kind: "archive", checksum: "sha256:" + "b".repeat(64), bytes: 42 }], errors: [] };
  manifest.bundle_checksum = releaseExportChecksum(manifest);
  const review = receiptReviewFixture(manifest);
  if (single) review.receipts.github = { status: "confirmed", ...review.receipts.github.repositories[0] };
  review.receipt_checksum = releaseReceiptChecksum(review);
  return { manifest, review };
}
function closeout(f, options = {}) { return buildReleaseCloseout({ ...f, now, maxReceiptAgeMinutes: 60, ...options }); }
function rehash(f) { f.review.receipt_checksum = releaseReceiptChecksum(f.review); }
const invalid = [
  ["missing", undefined], ["null", null], ["blank", ""], ["number", 42], ["array", ["2026-01-01T00:55:00.000Z"]], ["object", {}],
  ["date only", "2026-01-01"], ["leading whitespace", " 2026-01-01T00:55:00.000Z"], ["trailing newline", "2026-01-01T00:55:00.000Z\n"],
  ["offset", "2026-01-01T00:55:00+00:00"], ["missing zone", "2026-01-01T00:55:00"],
  ["February 30", "2025-02-30T00:00:00.000Z"], ["non-leap February 29", "2025-02-29T00:00:00.000Z"],
  ["hour 24", "2025-12-31T24:00:00.000Z"], ["minute 60", "2026-01-01T00:60:00.000Z"], ["second 60", "2026-01-01T00:00:60.000Z"],
  ["month 13", "2025-13-01T00:00:00.000Z"], ["day zero", "2026-01-00T00:00:00.000Z"],
  ["unsupported precision", "2026-01-01T00:55:00.000000Z"], ["unparseable", "not-a-timestamp"]
];
const surfaces = [
  ["legacy single repository", true, f => f.review.receipts.github, "observed_at"],
  ["first repository", false, f => f.review.receipts.github.repositories[0], "observed_at"],
  ["second repository", false, f => f.review.receipts.github.repositories[1], "observed_at"],
  ["Drive observation", false, f => f.review.receipts.google_drive, "observed_at"],
  ["receipt review", false, f => f.review, "generated_at"]
];
assert.equal(invalid.length * surfaces.length, 100);
for (const [surface, single, target, field] of surfaces) for (const [label, value] of invalid) {
  test(`freshness rejects ${label} at ${surface}`, () => {
    const f = fixture(single); const recorded = closeout(f);
    assert.equal(recorded.status, "release_closeout_ready");
    assert.equal(validateReleaseReceiptReview(f.review, { manifest: f.manifest, now }).ok, true);
    assert.equal(validateReleaseCloseout(recorded, { ...f, now }).ok, true);
    target(f)[field] = value; rehash(f);
    assert.equal(validateReleaseReceiptReview(f.review, { manifest: f.manifest, now }).ok, false);
    assert.equal(closeout(f).status, "blocked");
    recorded.receipt_checksum = f.review.receipt_checksum;
    assert.equal(validateReleaseCloseout(recorded, { ...f, now }).ok, false);
  });
}

test("either stale repository blocks closeout even with a fresh aggregate timestamp", () => {
  for (const index of [0, 1]) for (const aggregate of [undefined, now]) {
    const f = fixture();
    f.review.receipts.github.observed_at = aggregate;
    f.review.receipts.github.repositories[index].observed_at = "2025-12-31T23:59:59.999Z";
    rehash(f);
    const result = closeout(f);
    assert.equal(result.status, "stale_receipts");
    assert(result.receipt_ages_minutes.github > 60);
    assert.equal(validateReleaseCloseout(result, { ...f, now }).ok, true);
    assert.equal(validateReleaseCloseout({ ...result, status: "release_closeout_ready", errors: [], receipt_ages_minutes: { github: 0, google_drive: 5 } }, { ...f, now }).ok, false);
  }
});

test("exact freshness boundary passes and one millisecond beyond fails", () => {
  const f = fixture();
  f.review.receipts.github.repositories[1].observed_at = "2026-01-01T00:00:00.000Z"; rehash(f);
  const exact = closeout(f); assert.equal(exact.status, "release_closeout_ready");
  assert.deepEqual(exact.receipt_ages_minutes, { github: 60, google_drive: 5 });
  assert.equal(closeout(f, { now: "2026-01-01T01:00:00.001Z" }).status, "stale_receipts");
});

test("a stale Drive observation still blocks fresh GitHub receipts", () => {
  const f = fixture(); f.review.receipts.google_drive.observed_at = "2025-12-31T23:59:00.000Z"; rehash(f);
  assert.equal(closeout(f).status, "stale_receipts");
});

test("future and null repository observations fail closed without throwing", () => {
  for (const value of [null, { observed_at: "2026-01-01T01:00:00.001Z" }]) {
    const f = fixture(); f.review.receipts.github.repositories[1] = value; rehash(f);
    assert.equal(closeout(f).status, "blocked");
  }
});

test("historical validation replays the original decision; new closeout rechecks current freshness", () => {
  const f = fixture(); const recorded = closeout(f);
  const later = "2026-01-03T00:00:00.000Z";
  assert.equal(validateReleaseCloseout(recorded, { ...f, now: later }).ok, true);
  assert.equal(closeout(f, { now: later }).status, "stale_receipts");
});

test("altered ages, blocker lists and pending states cannot pass independent recomputation", () => {
  const f = fixture(); const original = closeout(f);
  for (const mutation of [
    { receipt_ages_minutes: {} }, { receipt_ages_minutes: null }, { receipt_ages_minutes: [] },
    { receipt_ages_minutes: { github: 5, google_drive: 5, extra: 0 } },
    { receipt_ages_minutes: { github: "5", google_drive: 5 } },
    { status: "pending_receipts" }, { errors: ["unobserved blocker"] }
  ]) assert.equal(validateReleaseCloseout({ ...original, ...mutation }, { ...f, now }).ok, false);
  const broken = structuredClone(f); broken.review.receipt_checksum = "sha256:" + "f".repeat(64);
  assert.equal(validateReleaseCloseout({ ...original, receipt_checksum: broken.review.receipt_checksum }, { ...broken, now }).ok, false);
});

test("invalid age policy blocks closeout and invalid clock cannot issue a document", () => {
  const f = fixture();
  for (const policy of [0, 1.5, 10081, NaN, Infinity]) assert.equal(closeout(f, { maxReceiptAgeMinutes: policy }).status, "blocked");
  assert.throws(() => closeout(f, { now: "invalid" }), /valid timestamp/);
});

test("receipt observations cannot postdate the review that attests them", () => {
  for (const select of [f => f.review.receipts.github.repositories[0], f => f.review.receipts.google_drive]) {
    const f = fixture(); select(f).observed_at = "2026-01-01T00:56:00.000Z"; rehash(f);
    assert.equal(validateReleaseReceiptReview(f.review, { manifest: f.manifest, now }).ok, false);
    assert.equal(closeout(f).status, "blocked");
  }
});
