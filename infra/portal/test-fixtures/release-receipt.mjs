import { buildReleaseReceiptReview } from "../release-receipt.mjs";
// Synthetic metadata only. No remote observation or human approval is asserted.
export function receiptReviewFixture(manifest, { pending = false } = {}) {
  const now = "2026-01-01T00:55:00.000Z";
  if (pending) return buildReleaseReceiptReview({ manifest, now });
  const repositories = manifest.destinations.github.repository.length ? manifest.destinations.github.repository : ["https://github.com/mgt/fixture.git"];
  const archive = manifest.entries.find(entry => entry.kind === "archive");
  const archiveName = archive?.reference?.replaceAll("\\", "/").split("/").pop() || "export.zip";
  const archiveChecksum = archive?.checksum || "sha256:" + "b".repeat(64);
  const archiveBytes = archive?.bytes || 42;
  const appProperties = { mgtExportId: `mgt-release-${manifest.candidate_commit}`, mgtCandidateCommit: manifest.candidate_commit, mgtBundleChecksum: manifest.bundle_checksum, mgtArchiveChecksum: archiveChecksum };
  const githubReceipt = { status: "confirmed", repositories: repositories.map((repository, index) => ({ repository, repository_id: 1000 + index, branch: manifest.branch, commit: manifest.candidate_commit, observed_at: now,
    asset: { id: 2000 + index, name: archiveName, bytes: archiveBytes, checksum: archiveChecksum, release_tag: `mgt-${manifest.candidate_commit.slice(0, 12)}`, web_url: `https://github.com/mgt/fixture/releases/download/mgt-${manifest.candidate_commit.slice(0, 12)}/${archiveName}` } })) };
  const driveName = typeof manifest.destinations?.google_drive?.file_name === "string" && manifest.destinations.google_drive.file_name ? manifest.destinations.google_drive.file_name : `MGT-Skin-Care-v2-${manifest.candidate_commit.slice(0, 12)}-export.zip`;
  const googleDriveReceipt = { status: "confirmed", export_id: appProperties.mgtExportId, app_properties: appProperties, file_id: "1ReceiptFixture", folder_id: "1ReceiptFolder", file_name: driveName, web_url: "https://drive.google.com/file/d/1ReceiptFixture/view", bundle_checksum: manifest.bundle_checksum,
    archive_checksum: archiveChecksum, bytes: archiveBytes, observed_at: now };
  return buildReleaseReceiptReview({ manifest, githubReceipt, googleDriveReceipt, now });
}
