import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  buildReleaseExport,
  createReleaseArchive,
  releaseExportChecksum,
  validateReleaseExport,
  verifyReleaseExport
} from "./release-export.mjs";
import { productionPrerequisitesChecksum } from "./production-prerequisites.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-release-export-"));
  fs.mkdirSync(path.join(root, "infra", "portal"), { recursive: true });
  fs.writeFileSync(path.join(root, "README.md"), "# MGT Skin Care v2\n\nExport-safe documentation.\n");
  fs.writeFileSync(path.join(root, "infra", "portal", "README.md"), "# Portal\n\nLocal release controls.\n");
  return root;
}

test("builds and verifies a checksum-bound export manifest", () => {
  const root = fixture();
  const manifest = buildReleaseExport({ root, candidateCommit: COMMIT, branch: "codex/test", references: ["README.md", "infra/portal/README.md"], now: "2026-01-01T00:00:00.000Z" });
  assert.equal(manifest.status, "ready_for_export");
  assert.equal(validateReleaseExport(manifest, { now: Date.parse("2026-01-02T00:00:00.000Z") }).ok, true);
  assert.deepEqual(verifyReleaseExport({ root, manifest }).ok, true);
  assert.equal(manifest.bundle_checksum, releaseExportChecksum(manifest));
});

test("detects a changed export artifact", () => {
  const root = fixture();
  const manifest = buildReleaseExport({ root, candidateCommit: COMMIT, references: ["README.md"], now: "2026-01-01T00:00:00.000Z" });
  fs.appendFileSync(path.join(root, "README.md"), "changed\n");
  const result = verifyReleaseExport({ root, manifest });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("; "), /checksum does not match/);
});

test("blocks traversal and credential-like exports", () => {
  const root = fixture();
  const traversal = buildReleaseExport({ root, candidateCommit: COMMIT, references: ["../secret.txt"], now: "2026-01-01T00:00:00.000Z" });
  assert.equal(traversal.status, "blocked");
  assert.match(traversal.errors.join("; "), /safe repository-relative/);
  fs.writeFileSync(path.join(root, "infra", "portal", "unsafe.md"), "OPENAI_API_KEY=sk-test-value\n");
  const manifest = buildReleaseExport({ root, candidateCommit: COMMIT, references: ["infra/portal/unsafe.md"], now: "2026-01-01T00:00:00.000Z" });
  assert.equal(manifest.status, "blocked");
  assert.match(manifest.errors.join("; "), /credential-like/);
});

test("allows documented non-secret provider flags", () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, "infra", "portal", "flags.md"), "STRIPE_LIVE_MODE=false\nSUPABASE_URL=https://project.invalid\n");
  const manifest = buildReleaseExport({ root, candidateCommit: COMMIT, references: ["infra/portal/flags.md"], now: "2026-01-01T00:00:00.000Z" });
  assert.equal(manifest.status, "ready_for_export");
});

test("binds candidate-specific production prerequisite evidence", () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, "work", "production"), { recursive: true });
  const packet = {
    version: "1.0",
    candidate_commit: COMMIT,
    generated_at: "2026-01-01T00:00:00.000Z",
    local: { evidence: { status: "verified" } },
    status: "blocked_on_configuration"
  };
  packet.prerequisites_checksum = productionPrerequisitesChecksum(packet);
  fs.writeFileSync(path.join(root, "work", "production", "prerequisites.json"), `${JSON.stringify(packet)}\n`);
  const manifest = buildReleaseExport({ root, candidateCommit: COMMIT, references: ["README.md"], prerequisitesReference: "work/production/prerequisites.json", now: "2026-01-02T00:00:00.000Z" });
  assert.equal(manifest.status, "ready_for_export");
  assert.equal(manifest.prerequisites.status, "blocked_on_configuration");
  assert.equal(verifyReleaseExport({ root, manifest }).ok, true);
  packet.candidate_commit = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";
  fs.writeFileSync(path.join(root, "work", "production", "prerequisites.json"), `${JSON.stringify(packet)}\n`);
  const changed = buildReleaseExport({ root, candidateCommit: COMMIT, references: ["README.md"], prerequisitesReference: "work/production/prerequisites.json", now: "2026-01-02T00:00:00.000Z" });
  assert.equal(changed.status, "blocked");
  assert.match(changed.errors.join("; "), /exact candidate commit/);
});

test("binds verified GitHub and Drive backup status without allowing production readiness", () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, "work", "exports"), { recursive: true });
  const packet = {
    candidate_commit: COMMIT,
    github: { status: "verified", repositories: [{ url: "https://github.com/mgt/portal", sha: COMMIT }] },
    google_drive: { status: "verified", folder_id: "1iO0ouDvWiPEWZkYGEyXSXwGweCvOp45N", folder_url: "https://drive.google.com/drive/folders/1iO0ouDvWiPEWZkYGEyXSXwGweCvOp45N" },
    archive: { sha256: `sha256:${"a".repeat(64)}`, bundle_sha256: `sha256:${"b".repeat(64)}` },
    production_status: "NOT_READY"
  };
  fs.writeFileSync(path.join(root, "work", "exports", "backup.json"), `${JSON.stringify(packet)}\n`);
  const manifest = buildReleaseExport({ root, candidateCommit: COMMIT, references: ["README.md"], backupStatusReference: "work/exports/backup.json", now: "2026-01-02T00:00:00.000Z" });
  assert.equal(manifest.status, "ready_for_export");
  assert.equal(manifest.backup_status.github_repositories, 1);
  assert.equal(verifyReleaseExport({ root, manifest }).ok, false);
  assert.match(verifyReleaseExport({ root, manifest }).errors.join("; "), /bundle[_ ]checksum/);
  packet.archive.bundle_sha256 = manifest.bundle_checksum;
  fs.writeFileSync(path.join(root, "work", "exports", "backup.json"), `${JSON.stringify(packet)}\n`);
  const rebound = buildReleaseExport({ root, candidateCommit: COMMIT, references: ["README.md"], backupStatusReference: "work/exports/backup.json", now: "2026-01-02T00:00:00.000Z" });
  assert.equal(rebound.status, "ready_for_export");
  assert.equal(verifyReleaseExport({ root, manifest: rebound }).ok, true);
  packet.production_status = "READY";
  fs.writeFileSync(path.join(root, "work", "exports", "backup.json"), `${JSON.stringify(packet)}\n`);
  const changed = buildReleaseExport({ root, candidateCommit: COMMIT, references: ["README.md"], backupStatusReference: "work/exports/backup.json", now: "2026-01-02T00:00:00.000Z" });
  assert.equal(changed.status, "blocked");
  assert.match(changed.errors.join("; "), /preserve the production hold/);
});

test("requires observed Drive metadata before marking upload complete", () => {
  const root = fixture();
  const manifest = buildReleaseExport({ root, candidateCommit: COMMIT, references: ["README.md"], now: "2026-01-01T00:00:00.000Z" });
  manifest.destinations.google_drive.status = "uploaded";
  manifest.bundle_checksum = releaseExportChecksum(manifest);
  const result = validateReleaseExport(manifest, { now: Date.parse("2026-01-02T00:00:00.000Z") });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("; "), /observed file_id/);
});

test("accepts only an archive reproduced from the exact candidate commit", () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, "work", "exports"), { recursive: true });
  for (const args of [
    ["init", "-q"],
    ["add", "."],
    ["-c", "user.name=MGT Test", "-c", "user.email=test@invalid.local", "commit", "-qm", "fixture"]
  ]) assert.equal(spawnSync("git", args, { cwd: root, windowsHide: true }).status, 0);
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true }).stdout.trim();
  const reference = "work/exports/candidate.zip";
  assert.equal(spawnSync("git", ["archive", "--format=zip", `--output=${path.join(root, reference)}`, commit], { cwd: root, windowsHide: true }).status, 0);
  const manifest = buildReleaseExport({ root, candidateCommit: commit, references: ["README.md"], archiveReference: reference, now: "2026-01-01T00:00:00.000Z" });
  assert.equal(manifest.status, "ready_for_export");
  assert.equal(verifyReleaseExport({ root, manifest }).ok, true);
  fs.appendFileSync(path.join(root, reference), "changed");
  const changed = buildReleaseExport({ root, candidateCommit: commit, references: ["README.md"], archiveReference: reference, now: "2026-01-01T00:00:00.000Z" });
  assert.equal(changed.status, "blocked");
  assert.match(changed.errors.join("; "), /exactly reproduce/);
});

test("creates an idempotent candidate archive and rejects reuse for another commit", () => {
  const root = fixture();
  for (const args of [
    ["init", "-q"],
    ["add", "."],
    ["-c", "user.name=MGT Test", "-c", "user.email=test@invalid.local", "commit", "-qm", "fixture"]
  ]) assert.equal(spawnSync("git", args, { cwd: root, windowsHide: true }).status, 0);
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true }).stdout.trim();
  const reference = "work/exports/generated-candidate.zip";

  const first = createReleaseArchive({ root, candidateCommit: commit, reference });
  assert.equal(first.created, true);
  assert.equal(first.candidate_commit, commit);
  assert.equal(first.reference, reference);
  assert.equal(createReleaseArchive({ root, candidateCommit: commit, reference }).created, false);

  fs.appendFileSync(path.join(root, "README.md"), "next candidate\n");
  assert.equal(spawnSync("git", ["add", "."], { cwd: root, windowsHide: true }).status, 0);
  assert.equal(spawnSync("git", ["-c", "user.name=MGT Test", "-c", "user.email=test@invalid.local", "commit", "-qm", "second"], { cwd: root, windowsHide: true }).status, 0);
  const nextCommit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true }).stdout.trim();
  assert.notEqual(nextCommit, commit);
  assert.throws(() => createReleaseArchive({ root, candidateCommit: nextCommit, reference }), /already exists and does not reproduce/);
});

test("keeps archive creation inside the sanitized export directory", () => {
  const root = fixture();
  assert.throws(() => createReleaseArchive({ root, candidateCommit: COMMIT, reference: "infra/portal/archive.zip" }), /safe work\/exports/);
  assert.throws(() => createReleaseArchive({ root, candidateCommit: COMMIT, reference: "work/exports/../archive.zip" }), /safe work\/exports/);
});
