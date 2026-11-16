# Merge preflight on the integration branch

Run 2026-11-16 (UTC) on `integration/team47studio-transfer-2026-11-16` (candidate `1ef5c51` plus the packet, patches 0001 and 0002, and the D09 documents from `bfe3cac`).

| Check | Result |
|---|---|
| `t47 release merge-check` | 6 pass, 0 warn, 0 fail, 3 info: both patches already applied, packet manifest verified, iOS scripts and CI job present, D09 folder verified (35 files, status PRELIMINARY) |
| Repository secret scan (`tracked-secret-scan.mjs`) | pass, 1,044 tracked files |
| Mobile contract test (`apps/mobile/test/contract.cjs`) | 4 pass, 0 fail |
| Packet tests in place | 111 passed, 3 skipped (private modules absent from the public subset) |
| D09 manifest | verified |
| Diff against the candidate | 116 files added, 1 modified (`apps/mobile/package.json`, three script lines) |

Not run: the repository's `lint` and full `verification` workflow, which need the Node dependencies installed; the build workspace has none. They run in CI when a pull request is opened.
