import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { releaseExportChecksum } from "./release-export.mjs";
import { releaseFinalizationChecksum, validateReleaseFinalization } from "./release-finalization.mjs";
import { buildReleaseLaunchReview, releaseLaunchReviewChecksum, validateReleaseLaunchReview, verifyReleaseLaunchReview } from "./release-launch-review.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const RECEIPT = "sha256:" + "c".repeat(64);
const RECORD_IDS = ["launch_window", "freeze_clearance", "ship_owner", "operator", "rollback_trigger", "incident_route", "first_hour_watch", "customer_impact_watch", "command_log_archive", "closeout_timestamp"];

function rootFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-launch-review-"));
  fs.mkdirSync(path.join(root, "work", "launch"), { recursive: true });
  for (const id of RECORD_IDS) fs.writeFileSync(path.join(root, "work", "launch", `${id}.md`), `${id} record\n`);
  return root;
}
function manifest() {
  const value = { version: "1.0", candidate_commit: COMMIT, branch: "codex/test", generated_at: "2026-01-01T00:00:00.000Z", status: "ready_for_export", destinations: { github: { status: "pending_push", repository: [], branch: "codex/test", commit: COMMIT }, google_drive: { status: "pending_upload" } }, entries: [], errors: [] };
  value.bundle_checksum = releaseExportChecksum(value);
  return value;
}
function closeout(value) { return { version: "1.0", candidate_commit: COMMIT, bundle_checksum: value.bundle_checksum, generated_at: "2026-01-01T01:00:00.000Z", max_receipt_age_minutes: 1440, receipt_ages_minutes: { github: 5, google_drive: 5 }, status: "release_closeout_ready", receipt_checksum: RECEIPT, errors: [] }; }
function review() { return { status: "export_complete", receipt_checksum: RECEIPT }; }
function finalization(value) {
  const valueOut = { version: "1.0", candidate_commit: COMMIT, bundle_checksum: value.bundle_checksum, closeout_checksum: RECEIPT, generated_at: "2026-01-01T01:00:00.000Z", status: "ready_for_finalization", entries: ["decision", "rollback", "monitoring", "support", "customer_communications", "audit_archive"].map((id) => ({ id, reference: `work/launch/${id}.md`, checksum: "sha256:" + "d".repeat(64), bytes: 1 })), errors: [] };
  valueOut.finalization_checksum = releaseFinalizationChecksum(valueOut);
  return valueOut;
}
function records(root) { return Object.fromEntries(RECORD_IDS.map((id) => [id, { reference: `work/launch/${id}.md`, owner: "owner", reviewed_at: "2026-01-01T01:00:00.000Z", status: "pass" }])); }

test("stays pending until the finalization chain is ready", () => {
  const value = manifest();
  const f = { ...finalization(value), status: "pending_closeout" };
  f.finalization_checksum = releaseFinalizationChecksum(f);
  const result = buildReleaseLaunchReview({ root: rootFixture(), manifest: value, closeout: { ...closeout(value), status: "pending_receipts" }, review: { status: "awaiting_receipts", receipt_checksum: RECEIPT }, finalization: f, now: "2026-01-01T02:00:00.000Z" });
  assert.equal(result.status, "pending_finalization");
});

test("accepts ten launch-review records", () => {
  const root = rootFixture();
  const value = manifest();
  const result = buildReleaseLaunchReview({ root, manifest: value, closeout: closeout(value), review: review(), finalization: finalization(value), records: records(root), now: "2026-01-01T02:00:00.000Z" });
  assert.equal(result.status, "ready_for_launch_review");
  assert.equal(validateReleaseLaunchReview(result, { manifest: value, finalization: finalization(value), now: Date.parse("2026-01-01T03:00:00.000Z") }).ok, true);
  assert.equal(result.launch_review_checksum, releaseLaunchReviewChecksum(result));
  assert.equal(verifyReleaseLaunchReview({ root, document: result }).ok, true);
});

test("detects a changed launch record", () => {
  const root = rootFixture();
  const value = manifest();
  const result = buildReleaseLaunchReview({ root, manifest: value, closeout: closeout(value), review: review(), finalization: finalization(value), records: records(root), now: "2026-01-01T02:00:00.000Z" });
  fs.appendFileSync(path.join(root, "work", "launch", "rollback_trigger.md"), "changed\n");
  const verified = verifyReleaseLaunchReview({ root, document: result });
  assert.equal(verified.ok, false);
  assert.match(verified.errors.join("; "), /rollback_trigger checksum/);
});

test("rejects a fabricated ready state", () => {
  const value = manifest();
  const f = finalization(value);
  const result = buildReleaseLaunchReview({ root: rootFixture(), manifest: value, closeout: closeout(value), review: review(), finalization: f, records: {} , now: "2026-01-01T02:00:00.000Z" });
  result.status = "ready_for_launch_review";
  assert.equal(validateReleaseLaunchReview(result, { manifest: value, finalization: f, now: Date.parse("2026-01-01T03:00:00.000Z") }).ok, false);
});
