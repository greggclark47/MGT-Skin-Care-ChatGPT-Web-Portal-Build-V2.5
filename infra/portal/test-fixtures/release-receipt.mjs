import { buildReleaseReceiptReview } from "../release-receipt.mjs";
// Synthetic metadata only. No remote observation or human approval is asserted.
export function receiptReviewFixture(manifest, { pending = false } = {}) {
  const now = "2026-01-01T00:55:00.000Z";
  if (pending) return buildReleaseReceiptReview({ manifest, now });
  const repositories = manifest.destinations.github.repository.length ? manifest.destinations.github.repository : ["https://github.com/mgt/fixture.git"];
  const githubReceipt = { status: "confirmed", repositories: repositories.map(repository => ({ repository, branch: manifest.branch, commit: manifest.candidate_commit, observed_at: now })) };
  const archive = manifest.entries.find(entry => entry.kind === "archive");
  const googleDriveReceipt = { status: "confirmed", file_id: "1ReceiptFixture", web_url: "https://drive.google.com/file/d/1ReceiptFixture/view", bundle_checksum: manifest.bundle_checksum,
    archive_checksum: archive?.checksum || "sha256:" + "b".repeat(64), bytes: archive?.bytes || 42, observed_at: now };
  return buildReleaseReceiptReview({ manifest, githubReceipt, googleDriveReceipt, now });
}
