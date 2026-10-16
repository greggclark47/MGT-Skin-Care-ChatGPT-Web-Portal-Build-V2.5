import { createHash } from "node:crypto";
import { matchesDriveFileIdentity } from "./drive-file-identity.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const DRIVE_ID = /^[A-Za-z0-9_-]{5,256}$/;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id%2Cname%2Csize%2Cparents%2CwebViewLink%2CappProperties";
const DRIVE_LIST_URL = "https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files%28id%2Cname%2Csize%2Cparents%2CwebViewLink%2CappProperties%29";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function archiveEntry(manifest) {
  return (Array.isArray(manifest?.entries) ? manifest.entries : []).find((entry) => entry?.kind === "archive") || null;
}

function archiveName(manifest) {
  const archive = archiveEntry(manifest);
  return archive ? text(archive.reference).replaceAll("\\", "/").split("/").pop() : "";
}

function driveFileName(manifest) {
  return text(manifest?.destinations?.google_drive?.file_name) || `MGT-Skin-Care-v2-${text(manifest?.candidate_commit).slice(0, 12)}-export.zip`;
}

function requireManifest(manifest) {
  const archive = archiveEntry(manifest);
  if (!SHA.test(text(manifest?.candidate_commit)) || !CHECKSUM.test(text(manifest?.bundle_checksum)) || !archive || !CHECKSUM.test(text(archive.checksum)) || !Number.isSafeInteger(archive.bytes) || archive.bytes < 1) {
    throw new Error("Drive archive transfer requires a checksum-bound candidate manifest with one valid archive entry.");
  }
  if (!archiveName(manifest) || !driveFileName(manifest).toLowerCase().endsWith(".zip")) throw new Error("Drive archive transfer requires a ZIP filename.");
  return archive;
}

function folder(value) {
  const id = text(value);
  if (!DRIVE_ID.test(id) || PLACEHOLDER.test(id)) throw new Error("Drive archive transfer requires an observed non-placeholder parent folder ID.");
  return id;
}

function properties(manifest) {
  const archive = requireManifest(manifest);
  return {
    mgtExportId: `mgt-release-${text(manifest.candidate_commit)}`,
    mgtCandidateCommit: text(manifest.candidate_commit),
    mgtBundleChecksum: text(manifest.bundle_checksum),
    mgtArchiveChecksum: text(archive.checksum)
  };
}

export function driveArchiveTransferMetadata({ manifest, folderId } = {}) {
  const parent = folder(folderId);
  requireManifest(manifest);
  return { name: driveFileName(manifest), mimeType: "application/zip", parents: [parent], appProperties: properties(manifest) };
}

export function buildDriveResumableUploadRequest({ manifest, folderId, contentLength } = {}) {
  const archive = requireManifest(manifest);
  const metadata = driveArchiveTransferMetadata({ manifest, folderId });
  if (!Number.isSafeInteger(contentLength) || contentLength !== archive.bytes) throw new Error("Drive archive upload length must match the manifest archive bytes.");
  return {
    method: "POST",
    url: DRIVE_UPLOAD_URL,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": "application/zip",
      "x-upload-content-length": String(contentLength)
    },
    body: JSON.stringify(metadata),
    metadata
  };
}

export function buildDriveReconcileRequest({ manifest, folderId } = {}) {
  const parent = folder(folderId);
  const property = properties(manifest);
  const query = `'${parent}' in parents and trashed = false and appProperties has { key = 'mgtExportId' and value = '${property.mgtExportId}' }`;
  return { method: "GET", url: `${DRIVE_LIST_URL}&q=${encodeURIComponent(query)}`, query, fields: ["id", "name", "size", "parents", "webViewLink", "appProperties"] };
}

function canonicalSize(value) {
  if (Number.isSafeInteger(value) && value >= 1) return value;
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed) && parsed >= 1) return parsed;
  }
  return undefined;
}

function propertyMatch(actual, expected) {
  return actual && typeof actual === "object" && !Array.isArray(actual) && Object.entries(expected).every(([key, value]) => actual[key] === value);
}

export function reconcileDriveArchiveCandidates({ manifest, folderId, files } = {}) {
  const parent = folder(folderId);
  const expected = driveArchiveTransferMetadata({ manifest, folderId: parent });
  if (!Array.isArray(files) || files.length > 100) throw new Error("Drive archive reconciliation requires a bounded file list.");
  const matches = files.filter((file) => file && typeof file === "object" && !Array.isArray(file) && DRIVE_ID.test(text(file.id)) && !PLACEHOLDER.test(text(file.id)) && text(file.name) === expected.name && Array.isArray(file.parents) && file.parents.length === 1 && file.parents[0] === parent && propertyMatch(file.appProperties, expected.appProperties));
  if (matches.length === 1) return { status: "matched", file: matches[0] };
  if (matches.length > 1) return { status: "ambiguous", file_ids: matches.map((file) => text(file.id)).sort() };
  return { status: "missing" };
}

export function validateDriveArchiveReadback({ manifest, folderId, metadata, content, observedAt = new Date().toISOString() } = {}) {
  const archive = requireManifest(manifest);
  const parent = folder(folderId);
  const expected = driveArchiveTransferMetadata({ manifest, folderId: parent });
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("Drive archive readback metadata is invalid.");
  if (!DRIVE_ID.test(text(metadata.id)) || PLACEHOLDER.test(text(metadata.id))) throw new Error("Drive archive readback must include an observed file ID.");
  if (text(metadata.name) !== expected.name) throw new Error("Drive archive readback filename does not match the manifest.");
  if (!Array.isArray(metadata.parents) || metadata.parents.length !== 1 || metadata.parents[0] !== parent) throw new Error("Drive archive readback parent folder does not match the approved folder.");
  if (!propertyMatch(metadata.appProperties, expected.appProperties)) throw new Error("Drive archive readback properties do not match the candidate.");
  if (!matchesDriveFileIdentity(metadata.id, metadata.webViewLink)) throw new Error("Drive archive readback must include a matching HTTPS file URL.");
  const size = canonicalSize(metadata.size);
  if (size !== archive.bytes) throw new Error("Drive archive readback size does not match the manifest archive.");
  if (!(Buffer.isBuffer(content) || content instanceof Uint8Array) || content.byteLength !== archive.bytes) throw new Error("Drive archive content bytes do not match the manifest archive.");
  const checksum = `sha256:${createHash("sha256").update(Buffer.from(content)).digest("hex")}`;
  if (checksum !== text(archive.checksum)) throw new Error("Drive archive content checksum does not match the manifest archive.");
  if (typeof observedAt !== "string" || Number.isNaN(Date.parse(observedAt)) || Date.parse(observedAt) > Date.now()) throw new Error("Drive archive readback time must be a valid past timestamp.");
  return { status: "confirmed", export_id: expected.appProperties.mgtExportId, app_properties: expected.appProperties, file_id: text(metadata.id), folder_id: parent, file_name: expected.name, web_url: metadata.webViewLink, bundle_checksum: text(manifest.bundle_checksum), archive_checksum: text(archive.checksum), bytes: archive.bytes, observed_at: observedAt };
}
