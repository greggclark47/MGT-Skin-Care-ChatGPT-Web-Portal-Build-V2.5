import assert from "node:assert/strict";
import test from "node:test";
import { matchesDriveFileIdentity } from "./drive-file-identity.mjs";
import { releaseExportChecksum, validateReleaseExport } from "./release-export.mjs";
import { buildReleaseReceiptReview, releaseReceiptChecksum, validateReleaseReceiptReview } from "./release-receipt.mjs";

const now = "2026-01-02T00:00:00.000Z";
const ID = "1AbcDEF_Archive-01";
const URL = `https://drive.google.com/file/d/${ID}/view`;
function fixture() {
  const manifest = { version: "1.0", candidate_commit: "a".repeat(40), branch: "codex/test",
    generated_at: "2026-01-01T00:00:00.000Z", status: "ready_for_export", errors: [],
    entries: [{ id: "archive", reference: "work/exports/archive.zip", kind: "archive", checksum: "sha256:" + "b".repeat(64), bytes: 42 }],
    destinations: { github: { status: "pending_push", repository: ["https://github.com/mgt/test.git"], branch: "codex/test", commit: "a".repeat(40) }, google_drive: { status: "pending_upload", file_name: "MGT-Skin-Care-v2-aaaaaaaaaaaa-export.zip" } } };
  manifest.bundle_checksum = releaseExportChecksum(manifest);
  const github = { status: "confirmed", repository: "https://github.com/mgt/test.git", repository_id: 1001, branch: "codex/test", commit: manifest.candidate_commit, observed_at: "2026-01-01T01:00:00.000Z", asset: { id: 2001, name: "archive.zip", release_tag: "mgt-aaaaaaaaaaaa", web_url: "https://github.com/mgt/test/releases/download/mgt-aaaaaaaaaaaa/archive.zip", checksum: manifest.entries[0].checksum, bytes: 42 } };
  const drive = { status: "confirmed", file_id: ID, folder_id: "1FolderABC", file_name: "MGT-Skin-Care-v2-aaaaaaaaaaaa-export.zip", web_url: URL, bundle_checksum: manifest.bundle_checksum,
    archive_checksum: manifest.entries[0].checksum, bytes: 42, observed_at: "2026-01-01T01:05:00.000Z" };
  return { manifest, github, drive };
}
function review(f) { return buildReleaseReceiptReview({ manifest: f.manifest, githubReceipt: f.github, googleDriveReceipt: f.drive, now }); }
function uploaded(f) {
  const manifest = structuredClone(f.manifest);
  manifest.destinations.google_drive = { status: "uploaded", file_id: f.drive.file_id, web_url: f.drive.web_url };
  manifest.bundle_checksum = releaseExportChecksum(manifest);
  return validateReleaseExport(manifest, { now });
}
const variants = [
  ["missing ID", { file_id: undefined }], ["null ID", { file_id: null }], ["array ID", { file_id: [ID] }],
  ["ID whitespace", { file_id: " " + ID }], ["ID case mismatch", { file_id: ID.toLowerCase() }],
  ["placeholder ID", { file_id: "REPLACE_WITH_FILE_ID", web_url: "https://drive.google.com/file/d/REPLACE_WITH_FILE_ID/view" }],
  ["missing URL", { web_url: undefined }], ["null URL", { web_url: null }], ["array URL", { web_url: [URL] }],
  ["URL whitespace", { web_url: " " + URL }], ["URL newline", { web_url: URL + "\n" }],
  ["HTTP", { web_url: URL.replace("https:", "http:") }],
  ["unrelated host", { web_url: URL.replace("drive.google.com", "archive.invalid") }],
  ["lookalike subdomain", { web_url: URL.replace("drive.google.com", "drive.google.com.invalid") }],
  ["user info", { web_url: URL.replace("https://", "https://reader@") }],
  ["explicit port", { web_url: URL.replace("drive.google.com", "drive.google.com:443") }],
  ["normalized dot segment", { web_url: URL.replace("/file/", "/extra/../file/") }],
  ["encoded ID", { web_url: URL.replace(ID, "%31AbcDEF_Archive-01") }],
  ["encoded slash", { web_url: URL.replace("/d/", "/d%2F") }],
  ["backslash", { web_url: URL.replace("/file/", "\\file/") }],
  ["folder link", { web_url: `https://drive.google.com/drive/folders/${ID}` }],
  ["different file", { web_url: URL.replace(ID, "AnotherArchive") }],
  ["duplicate query", { web_url: URL + "?usp=sharing&usp=drive_link" }],
  ["conflicting ID query", { web_url: URL + "?id=AnotherArchive" }],
  ["fragment", { web_url: URL + "#AnotherArchive" }]
];
const surfaces = [
  ["shared identity check", f => assert.equal(matchesDriveFileIdentity(f.drive.file_id, f.drive.web_url), false)],
  ["uploaded export manifest", f => { const r = uploaded(f); assert.equal(r.ok, false); assert(r.errors.some(e => e.includes("matching HTTPS web_url"))); }],
  ["receipt builder", f => { const r = review(f); assert.equal(r.status, "blocked"); assert(r.errors.some(e => e.includes("file_id must match"))); }],
  ["rehashed receipt review", f => {
    const good = fixture(); const r = review(good);
    r.receipts.google_drive = f.drive;
    r.receipt_checksum = releaseReceiptChecksum(r);
    const validated = validateReleaseReceiptReview(r, { manifest: f.manifest, now });
    assert.equal(validated.ok, false); assert(validated.errors.some(e => e.includes("file_id must match")));
  }]
];
assert.equal(variants.length * surfaces.length, 100);
for (const [surface, reject] of surfaces) for (const [variant, changed] of variants) {
  test(`${surface} rejects ${variant}`, () => {
    const f = fixture();
    assert.equal(matchesDriveFileIdentity(f.drive.file_id, f.drive.web_url), true);
    assert.equal(uploaded(f).ok, true);
    assert.equal(review(f).status, "export_complete");
    assert.equal(validateReleaseReceiptReview(review(f), { manifest: f.manifest, now }).ok, true);
    Object.assign(f.drive, changed); reject(f);
  });
}

test("supported binary share-link forms bind the same exact opaque ID", () => {
  for (const suffix of ["", "/view", "/preview", "/edit"]) for (const query of ["", "?usp=sharing", "?usp=drive_link", "?usp=drivesdk"]) {
    const f = fixture(); f.drive.web_url = `https://drive.google.com/file/d/${ID}${suffix}${query}`;
    assert.equal(matchesDriveFileIdentity(ID, f.drive.web_url), true);
    assert.equal(uploaded(f).ok, true);
    assert.equal(review(f).status, "export_complete");
    assert.equal(validateReleaseReceiptReview(review(f), { manifest: f.manifest, now }).ok, true);
  }
});

test("pending destinations require no invented file identity", () => {
  const f = fixture();
  assert.equal(validateReleaseExport(f.manifest, { now }).ok, true);
  const pending = buildReleaseReceiptReview({ manifest: f.manifest, now });
  assert.equal(pending.status, "awaiting_receipts");
  assert.equal(validateReleaseReceiptReview(pending, { manifest: f.manifest, now }).ok, true);
});

test("unknown query parameters and non-string coercion are not silently repaired", () => {
  assert.equal(matchesDriveFileIdentity(ID, URL + "?redirect=elsewhere"), false);
  assert.equal(matchesDriveFileIdentity({ toString: () => ID }, URL), false);
  assert.equal(matchesDriveFileIdentity(ID, { toString: () => URL }), false);
  assert.equal(matchesDriveFileIdentity(ID + "\n", URL), false);
});

test("identity consistency never substitutes for existing byte and digest bindings", () => {
  for (const mutation of [{ bytes: 43 }, { archive_checksum: "sha256:" + "c".repeat(64) }, { bundle_checksum: "sha256:" + "d".repeat(64) }]) {
    const f = fixture(); Object.assign(f.drive, mutation);
    assert.equal(review(f).status, "blocked");
  }
});
