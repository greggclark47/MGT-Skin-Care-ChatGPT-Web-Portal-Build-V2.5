# 10 Merge plan

Version 1.1.0, 2026-11-15. How three bodies of work land in one build without stepping on each other.

## The three pieces

| Piece | Where | State | Owns |
|---|---|---|---|
| Candidate build | `codex/reconcile-main-2026-09-20` at `1ef5c51` | deployed through `47d405b`; release HOLD | web, API, mobile, infrastructure, gate scripts |
| D09 v3.9 handoff | `docs/d09-v3.6-overlay` at `ec01557`, plus private Drive material | PRELIMINARY, pending owner release | design overlay, routes, proposed tables and endpoints, locked product rules, counsel gates |
| This packet | `packet/team47studio-deployment-2026-11-14`, folder `MGT_Team47Studio_Deployment_Packet/` | 1.1.0 | local agent plane, diagnostics, model qualification, release-gate view, economics, runbooks |

One structural fact to settle first: `docs/d09-v3.6-overlay` is built on `main`, which shares no history with the candidate branch. Its 23 files are all new and all under `docs/d09-v3.6/`, so they can be copied or cherry-picked onto the candidate without conflict, but a plain branch merge is not available. This is the practical form of handoff item O-1 (which build is the base).

## Where the pieces touch, and who wins

| Topic | Rule |
|---|---|
| Product rules | The handoff's 14 locked rules win. This packet was checked against them; three conflicts were found in 1.0.0 and fixed (see `11`). |
| Customer care | The handoff defines the pipeline for the in-product Coach and care centre. This packet's `customer_care` agent is the operator's drafting tool, not the member-facing Coach. Both use the same four hard escalations; here they are enforced in `t47/agents/triage.py`. |
| Agents | Agent ids, names and channels come from the candidate's `agent-operations.ts`. The packet adds one (`retention_lifecycle`) as a proposal. |
| Release gates | The candidate's `infra:*` scripts remain the checks. `t47 release status` is a view with evidence references, now carrying two gates from the handoff (G24, G25). |
| Backups | The candidate's `pnpm backup:encrypt` and `backup:restore-test` remain the application backup. The packet backs up only its own state. |
| Models | The candidate's task registry is authoritative. The packet proposes; it never edits the registry. |
| Site routes | The handoff proposes new routes and 301s. `t47 diagnostics site` reports them as information until that merge ships, so the daily check does not warn about work not yet done. |

## Order of merge

| Step | Action | Needs |
|---|---|---|
| 1 | Add `MGT_Team47Studio_Deployment_Packet/` to the candidate branch. One new folder, no existing file changed. The repository's own secret scan passes with it present. | owner approval |
| 2 | Apply `merge/patches/0002` (CI job for the packet). New workflow file, read-only token, no secrets. | owner approval |
| 3 | Apply `merge/patches/0001` (iOS scripts). Three script lines in `apps/mobile/package.json`. | owner approval |
| 4 | Copy `docs/d09-v3.6/` from the overlay branch onto the candidate. | handoff released (G24) |
| 5 | Handoff merge step 1: theme stylesheet and tokens. Reversible by removing one import. | G24 |
| 6 | Handoff steps 2 to 8: routes and redirects, chrome, catalogue, commerce, security, care, partners. | G24, and N-1 for commerce |
| 7 | Handoff step 9: face scan, behind a flag, off. | counsel (G25) |
| 8 | Run the candidate's gates, then `t47 release status`. | all of the above |

Steps 1 to 3 are independent of the handoff and can go now. Both patches were checked with `git apply --check` against `1ef5c51`; if the candidate moves, re-check before applying:

```
git apply --check MGT_Team47Studio_Deployment_Packet/merge/patches/0001-mobile-add-ios-build-and-submit-scripts.patch
git apply --check MGT_Team47Studio_Deployment_Packet/merge/patches/0002-ci-test-the-deployment-packet.patch
```

## Integrity

`MANIFEST.sha256` at the packet root covers every file in the packet: `sha256sum -c MANIFEST.sha256`. The CI job in patch 0002 runs the same check.

## What this plan does not do

It does not merge into `main` or the candidate branch, does not release the handoff, and does not decide O-1, N-1 or C-9. Those are owner decisions.
