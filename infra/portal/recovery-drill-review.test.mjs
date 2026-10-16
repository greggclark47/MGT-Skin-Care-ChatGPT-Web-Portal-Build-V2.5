import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { releaseExportChecksum } from "./release-export.mjs";
import { buildRecoveryDrillReview, recoveryDrillChecksum, validateRecoveryDrillReview, verifyRecoveryDrillReview } from "./recovery-drill-review.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const BACKUP = "sha256:" + "a".repeat(64);
const OWNER = "Gregg Clark of MGT";

function rootFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-recovery-drill-"));
  fs.mkdirSync(path.join(root, "work", "recovery"), { recursive: true });
  for (const id of ["restore_transcript", "rollback_plan", "failed_restore_procedure"]) fs.writeFileSync(path.join(root, "work", "recovery", `${id}.md`), `${id} evidence\n`);
  return root;
}

function manifest() {
  const value = { version: "1.0", candidate_commit: COMMIT, branch: "codex/test", generated_at: "2026-01-01T00:00:00.000Z", status: "ready_for_export", destinations: { github: { status: "pending_push", repository: [], branch: "codex/test", commit: COMMIT }, google_drive: { status: "pending_upload" } }, entries: [], errors: [] };
  value.bundle_checksum = releaseExportChecksum(value);
  return value;
}

function evidence(root, id) {
  const reference = `work/recovery/${id}.md`;
  const content = fs.readFileSync(path.join(root, reference));
  return { id, reference, checksum: `sha256:${createHash("sha256").update(content).digest("hex")}`, bytes: content.length, owner: OWNER, reviewed_at: "2026-01-01T01:00:00.000Z", status: "pass" };
}

function drill(root, overrides = {}) {
  return {
    version: "1.0",
    status: "passed",
    candidate_commit: COMMIT,
    owner: OWNER,
    backup_checksum: BACKUP,
    source_identifier: "backup-vault-a",
    restore_target_identifier: "isolated-restore-2026-10-16",
    isolated_restore: true,
    backup_completed_at: "2026-01-01T00:00:00.000Z",
    restore_started_at: "2026-01-01T01:00:00.000Z",
    restore_completed_at: "2026-01-01T01:01:30.000Z",
    verified_at: "2026-01-01T01:02:00.000Z",
    rto_seconds: 90,
    rpo_seconds: 60,
    restored_migration_version: "0010_ingredient_rule_seed_alignment",
    evidence: ["restore_transcript", "rollback_plan", "failed_restore_procedure"].map((id) => evidence(root, id)),
    decision: { decider: OWNER, decision: "accepted", decided_at: "2026-01-01T01:05:00.000Z" },
    ...overrides
  };
}

test("keeps recovery review blocked until the external drill is complete", () => {
  const result = buildRecoveryDrillReview({ root: rootFixture(), manifest: manifest(), now: "2026-01-02T00:00:00.000Z" });
  assert.equal(result.status, "blocked");
  assert.match(result.errors.join("; "), /drill status must be passed|candidate_commit|isolated_restore/);
});

test("accepts a measured isolated recovery drill with verified evidence", () => {
  const root = rootFixture();
  const value = manifest();
  const result = buildRecoveryDrillReview({ root, manifest: value, drill: drill(root), now: "2026-01-02T00:00:00.000Z" });
  assert.equal(result.status, "ready_for_recovery_review");
  assert.deepEqual(result.target_seconds, { rto: 120, rpo: 300 });
  assert.deepEqual(result.measured_seconds, { rto: 90, rpo: 60 });
  assert.equal(validateRecoveryDrillReview(result, { manifest: value, now: Date.parse("2026-01-02T01:00:00.000Z") }).ok, true);
  assert.equal(verifyRecoveryDrillReview({ root, document: result }).ok, true);
  assert.equal(result.recovery_drill_checksum, recoveryDrillChecksum(result));
});

test("blocks target overruns, non-isolated restores, and secret-bearing evidence", () => {
  const root = rootFixture();
  const value = manifest();
  for (const [overrides, expected] of [
    [{ rto_seconds: 121 }, /rto_seconds exceeds/],
    [{ isolated_restore: false }, /isolated_restore/],
    [{ source_identifier: "postgresql://user:password@db.example" }, /credential-like/]
  ]) {
    const result = buildRecoveryDrillReview({ root, manifest: value, drill: drill(root, overrides), now: "2026-01-02T00:00:00.000Z" });
    assert.equal(result.status, "blocked");
    assert.match(result.errors.join("; "), expected);
  }
});

test("detects changed evidence and rejects a fabricated ready state", () => {
  const root = rootFixture();
  const value = manifest();
  const result = buildRecoveryDrillReview({ root, manifest: value, drill: drill(root), now: "2026-01-02T00:00:00.000Z" });
  fs.appendFileSync(path.join(root, "work", "recovery", "rollback_plan.md"), "changed\n");
  assert.equal(verifyRecoveryDrillReview({ root, document: result }).ok, false);
  const blocked = buildRecoveryDrillReview({ root: rootFixture(), manifest: value, drill: drill(rootFixture(), { rpo_seconds: 301 }), now: "2026-01-02T00:00:00.000Z" });
  blocked.status = "ready_for_recovery_review";
  assert.equal(validateRecoveryDrillReview(blocked, { manifest: value, now: Date.parse("2026-01-02T01:00:00.000Z") }).ok, false);
});
