# Build checkpoints and saving

Historical checkpoint guidance below: destination and connection statements describe the earlier workflow, not current verified access. See [the October 9 Drive review](infra/portal/GOOGLE-DRIVE-REVIEW-2026-10-09.md) for the v2.22 reference, later folder receipts, current repository pair and pending live verification. Preserve this history; do not infer current upload authority from it.

The user authorized saving all future build checkpoints in this task to:
- Google Drive: mgt-skincare-v2 / _snapshots (folder 1YdGrqoC0RBYvHi2dK1zotnfsC19f7EHY).
- Public GitHub: greggclark47/MGT-Skin-Care---ChatGPT-Web-Portal-Build-V1.

After a meaningful build, validate the changes, commit the source locally, create a uniquely named complete source ZIP, upload it to both destinations, and verify both saves. Preserve earlier snapshots. Include source, assets, documentation, lockfiles, and configuration templates. Exclude live credentials, local databases, dependencies, and generated caches. Keep GitHub's public visibility as already approved.

The GitHub connector currently returns 403 for writes. The signed-in GitHub browser upload flow works. GitHub saves are ZIP snapshots, not an extracted source tree. Do not claim a direct source push or automatic background synchronization.

## September 8, 2026 — shop filter restoration

Search, storefront region, specialty, segment, and comparison selections are represented in the page address. Copy shop link, comparison links, and downloaded shortlist links restore that context in the main shop. Clear filters keeps comparison selections. Unknown filter values fall back to valid defaults, and comparison IDs are deduplicated, validated, and limited to three.
