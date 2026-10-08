import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { releaseExportChecksum } from "./release-export.mjs";
import { buildReleaseFinalization, releaseFinalizationChecksum, validateReleaseFinalization, verifyReleaseFinalization } from "./release-finalization.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const BUNDLE = "sha256:" + "a".repeat(64);
const RECEIPT = "sha256:" + "c".repeat(64);
const RECORD_IDS = ["decision", "rollback", "monitoring", "support", "customer_communications", "audit_archive"];

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-finalization-"));
  fs.mkdirSync(path.join(root, "work", "finalization"), { recursive: true });
  for (const id of RECORD_IDS) fs.writeFileSync(path.join(root, "work", "finalization", `${id}.md`), `${id} record\n`);
  return root;
}

function manifest() {
  const value = {
    version: "1.0",
    candidate_commit: COMMIT,
    branch: "codex/test",
    generated_at: "2026-01-01T00:00:00.000Z",
    status: "ready_for_export",
    destinations: { github: { status: "pending_push", repository: [], branch: "codex/test", commit: COMMIT }, google_drive: { status: "pending_upload" } },
    entries: [],
    errors: []
  };
  value.bundle_checksum = releaseExportChecksum(value);
  return value;
}

function review() {
  return { status: "export_complete", receipt_checksum: RECEIPT };
}

function closeout(value, status = "release_closeout_ready") {
  return { version: "1.0", candidate_commit: COMMIT, bundle_checksum: value.bundle_checksum, generated_at: "2026-01-01T01:00:00.000Z", max_receipt_age_minutes: 1440, receipt_ages_minutes: { github: 5, google_drive: 5 }, status, receipt_checksum: RECEIPT, errors: [] };
}

function records(root) {
  return Object.fromEntries(RECORD_IDS.map((id) => [id, { reference: `work/finalization/${id}.md`, owner: "owner", reviewed_at: "2026-01-01T01:00:00.000Z", status: "pass" }]));
}

test("remains pending while closeout is not ready", () => {
  const value = manifest();
  const result = buildReleaseFinalization({ root: fixtureRoot(), manifest: value, review: { status: "awaiting_receipts", receipt_checksum: RECEIPT }, closeout: closeout(value, "pending_receipts"), now: "2026-01-01T02:00:00.000Z" });
  assert.equal(result.status, "pending_closeout");
});

test("accepts six complete finalization records", () => {
  const root = fixtureRoot();
  const value = manifest();
  const result = buildReleaseFinalization({ root, manifest: value, review: review(), closeout: closeout(value), records: records(root), now: "2026-01-01T02:00:00.000Z" });
  assert.equal(result.status, "ready_for_finalization");
  assert.equal(validateReleaseFinalization(result, { manifest: value, closeout: closeout(value), review: review(), now: Date.parse("2026-01-01T03:00:00.000Z") }).ok, true);
  assert.equal(result.finalization_checksum, releaseFinalizationChecksum(result));
  assert.equal(verifyReleaseFinalization({ root, document: result }).ok, true);
});

test("detects a modified finalization record", () => {
  const root = fixtureRoot();
  const value = manifest();
  const result = buildReleaseFinalization({ root, manifest: value, review: review(), closeout: closeout(value), records: records(root), now: "2026-01-01T02:00:00.000Z" });
  fs.appendFileSync(path.join(root, "work", "finalization", "rollback.md"), "changed\n");
  const verified = verifyReleaseFinalization({ root, document: result });
  assert.equal(verified.ok, false);
  assert.match(verified.errors.join("; "), /rollback checksum/);
});

test("rejects unsafe and credential-like finalization records", () => {
  const root = fixtureRoot();
  const value = manifest();
  const unsafe = records(root);
  unsafe.support.reference = "../secret.md";
  const result = buildReleaseFinalization({ root, manifest: value, review: review(), closeout: closeout(value), records: unsafe, now: "2026-01-01T02:00:00.000Z" });
  assert.equal(result.status, "blocked");
  assert.match(result.errors.join("; "), /safe repository-relative|support record is required/);
});
