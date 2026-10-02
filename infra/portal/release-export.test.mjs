import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildReleaseExport,
  releaseExportChecksum,
  validateReleaseExport,
  verifyReleaseExport
} from "./release-export.mjs";

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

test("requires observed Drive metadata before marking upload complete", () => {
  const root = fixture();
  const manifest = buildReleaseExport({ root, candidateCommit: COMMIT, references: ["README.md"], now: "2026-01-01T00:00:00.000Z" });
  manifest.destinations.google_drive.status = "uploaded";
  manifest.bundle_checksum = releaseExportChecksum(manifest);
  const result = validateReleaseExport(manifest, { now: Date.parse("2026-01-02T00:00:00.000Z") });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("; "), /observed file_id/);
});
