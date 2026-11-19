import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { releaseExportChecksum } from "./release-export.mjs";
import {
  buildDriveReconcileRequest,
  buildDriveResumableUploadRequest,
  driveArchiveTransferMetadata,
  reconcileDriveArchiveCandidates,
  validateDriveArchiveReadback
} from "./release-drive-archive.mjs";

const CONTENT = Buffer.from("archive");
const ARCHIVE_CHECKSUM = `sha256:${createHash("sha256").update(CONTENT).digest("hex")}`;
const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const FOLDER = "1FolderABC";

function manifest() {
  const value = {
    version: "1.0",
    candidate_commit: COMMIT,
    branch: "codex/test",
    generated_at: "2026-01-01T00:00:00.000Z",
    status: "ready_for_export",
    destinations: { github: { status: "pending_push", repository: [], branch: "codex/test", commit: COMMIT }, google_drive: { status: "pending_upload", file_name: `MGT-Skin-Care-v2-${COMMIT.slice(0, 12)}-export.zip` } },
    entries: [{ id: "archive", reference: "work/exports/package.zip", kind: "archive", checksum: ARCHIVE_CHECKSUM, bytes: CONTENT.length }],
    errors: []
  };
  value.bundle_checksum = releaseExportChecksum(value);
  return value;
}

function metadata(value = manifest()) {
  return { ...driveArchiveTransferMetadata({ manifest: value, folderId: FOLDER }), id: "1DriveFile", size: String(CONTENT.length), parents: [FOLDER], webViewLink: "https://drive.google.com/file/d/1DriveFile/view" };
}

test("builds resumable upload and reconciliation requests without exposing credentials", () => {
  const value = manifest();
  const upload = buildDriveResumableUploadRequest({ manifest: value, folderId: FOLDER, contentLength: CONTENT.length });
  assert.equal(upload.method, "POST");
  assert.match(upload.url, /uploadType=resumable/);
  assert.equal(upload.headers["x-upload-content-length"], String(CONTENT.length));
  assert.equal(upload.metadata.parents[0], FOLDER);
  assert.equal(upload.body.includes("authorization"), false);
  const reconcile = buildDriveReconcileRequest({ manifest: value, folderId: FOLDER });
  assert.equal(reconcile.method, "GET");
  assert.match(reconcile.url, /appProperties/);
  assert.match(reconcile.query, /mgt-release-0123456789abcdef0123456789abcdef01234567/);
});

test("accepts only an exact Drive metadata and byte readback", () => {
  const value = manifest();
  const receipt = validateDriveArchiveReadback({ manifest: value, folderId: FOLDER, metadata: metadata(value), content: CONTENT, observedAt: "2026-01-01T01:00:00.000Z" });
  assert.deepEqual(receipt, { status: "confirmed", export_id: `mgt-release-${COMMIT}`, app_properties: { mgtExportId: `mgt-release-${COMMIT}`, mgtCandidateCommit: COMMIT, mgtBundleChecksum: value.bundle_checksum, mgtArchiveChecksum: ARCHIVE_CHECKSUM }, file_id: "1DriveFile", folder_id: FOLDER, file_name: value.destinations.google_drive.file_name, web_url: "https://drive.google.com/file/d/1DriveFile/view", bundle_checksum: value.bundle_checksum, archive_checksum: ARCHIVE_CHECKSUM, bytes: CONTENT.length, observed_at: "2026-01-01T01:00:00.000Z" });
  for (const [label, mutate, expected] of [
    ["wrong parent", item => { item.parents = ["1OtherFolder"]; }, /parent folder/],
    ["wrong property", item => { item.appProperties.mgtBundleChecksum = "sha256:" + "c".repeat(64); }, /properties/],
    ["wrong content", item => item, /content checksum/],
    ["wrong name", item => { item.name = "other.zip"; }, /filename/]
  ]) {
    const item = metadata(value);
    const bytes = label === "wrong content" ? Buffer.from("changed") : CONTENT;
    mutate(item);
    assert.throws(() => validateDriveArchiveReadback({ manifest: value, folderId: FOLDER, metadata: item, content: bytes, observedAt: "2026-01-01T01:00:00.000Z" }), expected, label);
  }
});

test("reconciles zero, one, and multiple exact Drive candidates explicitly", () => {
  const value = manifest();
  const file = metadata(value);
  assert.deepEqual(reconcileDriveArchiveCandidates({ manifest: value, folderId: FOLDER, files: [] }), { status: "missing" });
  assert.deepEqual(reconcileDriveArchiveCandidates({ manifest: value, folderId: FOLDER, files: [file] }), { status: "matched", file });
  const second = { ...file, id: "1DriveFile2", webViewLink: "https://drive.google.com/file/d/1DriveFile2/view" };
  assert.deepEqual(reconcileDriveArchiveCandidates({ manifest: value, folderId: FOLDER, files: [file, second] }), { status: "ambiguous", file_ids: ["1DriveFile", "1DriveFile2"] });
});

test("rejects unsafe folders, lengths, and upload output that could be misbound", () => {
  const value = manifest();
  assert.throws(() => driveArchiveTransferMetadata({ manifest: value, folderId: "REPLACE_WITH_FOLDER" }), /non-placeholder/);
  assert.throws(() => buildDriveResumableUploadRequest({ manifest: value, folderId: FOLDER, contentLength: CONTENT.length + 1 }), /length/);
  assert.throws(() => validateDriveArchiveReadback({ manifest: value, folderId: FOLDER, metadata: metadata(value), content: CONTENT, observedAt: "2027-01-01T00:00:00.000Z" }), /past timestamp/);
});
