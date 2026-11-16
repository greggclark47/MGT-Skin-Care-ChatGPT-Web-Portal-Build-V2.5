# 12 Transfer packet: end-to-end integration

Version 1.2.0, 2026-11-16. One document to carry the merge from three places (GitHub, Google Drive, the workstation) into one build across Web Portal, Android, Google Play and iOS. Labels: [REPO] recorded in the repository or Drive; [DECISION] needs the owner; [NOT RUN] written but not executed.

## 1. What is being merged

| Piece | Location | Version | State |
|---|---|---|---|
| Candidate build | `codex/reconcile-main-2026-09-20` at `1ef5c51` | deployed through `47d405b` | release HOLD |
| D09 handoff | `docs/d09-v3.6-overlay` at `bfe3cac` | design v4.1, handoff v1.2 | PRELIMINARY |
| Deployment packet | `packet/team47studio-deployment-2026-11-14` | 1.2.0 | this document |
| **Integration branch** | `integration/team47studio-transfer-2026-11-16` | candidate + packet + patches 0001 and 0002 + D09 documents | for review; not merged anywhere |

The integration branch is the transfer vehicle. It is the candidate with only additions: one new packet folder, one new CI workflow, three new script lines in `apps/mobile/package.json`, and the D09 documents folder copied in unchanged. Nothing else in the candidate is modified, so it reverts by deleting the branch.

Changed since packet 1.1.0: the handoff now carries owner-set prices (Starter $0, Guided $14.99 or $149.90 a year, Studio $29.99 or $299.90 a year, preliminary) and an optional 14-day Guided trial pending approval (handoff item O-7). Packet 1.1.0 had modelled Studio as unset because handoff v1.0 said so; 1.2.0 follows v1.2.

## 2. Where each thing lives

| Store | Holds | Never holds |
|---|---|---|
| GitHub (public repository) | code, technical runbooks, merge kit, D09 packet, spec, prompt and sources | economics, go-to-market, counsel and partnerships material, the demo, any secret |
| Google Drive (private) | full packet zip, ROI workbook, internal documents, encrypted agent-plane backups | the backup key, any secret. Files with "Bill" in the title are out of scope for every agent and connector |
| Workstation | checkout, virtual environment, `~/.t47` state, Ollama models, OpenClaw | anything served to the internet |
| Secret Manager, vendor consoles | every production secret | — |

## 3. Workstation setup [NOT RUN]

```powershell
powershell -ExecutionPolicy RemoteSigned -File .\Install-T47.ps1 -Dest C:\t47
```

`merge/Install-T47.ps1` clones the integration branch, builds a virtual environment, installs the packet, runs the tests (expect 135 passed) and writes five read-only reports to `~/.t47/reports`: merge preflight, local AI, site, repository, release status. Then continue with `07-RUNBOOK-LOCAL-HARDWARE.md` from step 7 (backup key), and the bake-off.

## 4. Accounts and access to have ready

Names only. Each is signed in by the owner on the workstation or in the vendor console; none is stored in this packet.

| For | Needed | Platform |
|---|---|---|
| GitHub | push access to the repository | all |
| Google Cloud | project access for Cloud Run, Artifact Registry, Secret Manager | web |
| Cloudflare | zone access (no DNS or TLS change is part of this merge) | web |
| Supabase | production and staging projects | web, mobile |
| Stripe | live account activation; four prices to create (Guided and Studio, monthly and annual) | web |
| Expo / EAS | account and project link (`eas login`, `eas init`) | Android, iOS |
| Google Play Console | developer account ($25 once [REPO]), app record for `com.team47studio.app` | Google Play |
| Apple Developer Program | enrollment ($99 a year [REPO]), App Store Connect app record, same bundle id | iOS |
| Password manager | `T47_BACKUP_KEY`; later `OLLAMA_CLOUD_API_KEY` | workstation |

## 5. Merge sequence

Run `t47 release merge-check` before and after each step. It is read-only and reports the packet, its manifest, each patch (applied, applies, or conflict), the iOS scripts, the CI job and the D09 folder.

| Step | Action | Check | Rollback |
|---|---|---|---|
| 1 | Review the integration branch diff against the candidate | `git diff codex/reconcile-main-2026-09-20...integration/team47studio-transfer-2026-11-16 --stat` shows additions only, plus `apps/mobile/package.json` | none needed |
| 2 | Open a pull request from the integration branch into the candidate [DECISION] | CI: existing `verification` workflow plus the new `deployment-packet` job | close the pull request |
| 3 | Merge it | `t47 release merge-check`: patches "already applied", manifest verified | `git revert` the merge commit |
| 4 | Release the D09 handoff from PRELIMINARY and settle O-1, N-1, C-9, O-7 [DECISION] | gate G24 accepted | — |
| 5 | Handoff merge steps 1 to 8 (theme, routes and redirects, chrome, catalogue, commerce, security, care, partners), each as its own pull request | candidate gate scripts; handoff acceptance tests | per pull request |
| 6 | Face scan stays behind its flag, off | gate G25 | flag off |
| 7 | Platform sections below | `t47 release status` | per platform |

Steps 1 to 3 need no decision beyond approving the pull request. Steps 5 onward are engineering work specified by the handoff; this packet sequences and checks it, it does not implement it.

## 6. Web portal

Prerequisites: steps 1 to 3. Then, in order: encrypted backup and restore drill (G07, `t47 backup drill`); approved catalog (G08); authenticated journeys (G06); Stripe live with the four prices and a rehearsal (G03, G04); named approvers (G09). Deploy with the repository's existing release workflow for the exact commit and digests (G01). Acceptance: `/readyz` returns 200, `t47 diagnostics site` has no FAIL, `t47 release status --platform web` prints SHIP. Rollback: the repository's rollback owner redeploys the previous digests.

Subscriptions stay off until G03 and G04 are accepted. The trial (O-7) is not built until approved.

## 7. Android and Google Play

1. `eas login`, `eas init` in `apps/mobile`.
2. `pnpm --filter @mgt/mobile android:preview`, install the APK on a physical device, walk the sign-in and Skin Match paths.
3. `pnpm --filter @mgt/mobile android:production` for the signed AAB (G14).
4. Play Console: listing, Data safety from `PLAY-DATA-SAFETY-DRAFT.md`, content rating, policy URLs, store images from the D09 v2.1 packet (they pass `t47 release assets`).
5. `pnpm --filter @mgt/mobile android:submit:internal` to the internal track (G15).
6. Record the billing route (G18). Recommended for first submission: no purchase in the app.

Acceptance: internal-track install works; `t47 release status --platform android` prints SHIP. Rollback: halt the rollout in Play Console.

## 8. iOS and App Store

1. Enroll in the Apple Developer Program; create the App Store Connect record.
2. With patch 0001 merged: `pnpm --filter @mgt/mobile ios:preview` (internal distribution needs the test device registered with EAS), then `ios:production`.
3. `ios:submit:testflight`. `eas.json` has no iOS submit profile, so the first run asks for the App Store Connect details; add the profile afterwards so it is repeatable.
4. TestFlight on a device (G16). App Privacy answers, age rating, review notes, and an in-app account deletion path (G17).
5. Billing route as Android (G18).

Acceptance: TestFlight build installs and signs in; `t47 release status --platform ios` prints SHIP. Rollback: remove the build from review or from sale.

## 9. What "frictionless" rests on

- Additions only: the integration branch changes one existing file by three lines.
- Checked, not assumed: both patches verified against `1ef5c51`; the repository's secret scan and the mobile contract test pass on the integration branch; both manifests verify (`evidence/merge-check-integration.md`). The repository lint and full verification workflow were not run here; they run in CI on the pull request.
- One preflight command for every later step.
- The holds are untouched: release HOLD, subscriptions off, agents draft-only, nothing merged into `main` or the candidate.

## 10. Not done by this packet

Opening or merging a pull request; any deploy; enabling subscriptions; creating Stripe prices; store submissions; anything on the workstation (the setup script and the Windows task script are [NOT RUN]); implementing the handoff's proposed tables, endpoints and screens.
