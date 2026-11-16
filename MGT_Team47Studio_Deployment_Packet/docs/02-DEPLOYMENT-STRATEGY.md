# 02 Deployment strategy

Version 1.1.0, 2026-11-15. Source labels: [REPO] recorded in the repository or Drive; [WEB] read from a current public source on 2026-11-14; [ESTIMATE] planning figure; [DECISION] needs the owner.

## 1. Topology: two planes, one rule between them

**Production plane (cloud, unchanged).** Cloudflare in front of a Google HTTPS load balancer, Cloud Run for web, API, the one-shot worker and the alert receiver, Supabase for data and identity, Stripe hosted Checkout and Customer Portal, Secret Manager for configuration. [REPO] This plane serves every customer request.

**Agent plane (workstation, new in this packet).** Ollama on loopback, OpenClaw as the operator's conversational front end, the `t47` package for drafting, guardrails, the review queue, model qualification, diagnostics and encrypted backups of its own state.

**The rule.** Nothing on the workstation is reachable from the internet, and no customer request depends on it. Work crosses from the agent plane to the production plane only as a reviewed export artifact that a person carries across. The repository already sets this boundary ("a personal workstation is for development and qualification, not a public production dependency"); the packet enforces it in code: the config loader refuses a non-loopback Ollama address unless explicitly overridden.

**Cloud backup.** Three things, all off the workstation: the metered Ollama Cloud fallback for drafting (off by default), encrypted agent-plane backups in a private Drive folder, and the application backup the repository's own tooling writes.

Why not serve production AI from the workstation: one consumer GPU, one residential uplink and one power supply are a single point of failure for a paying customer, and exposing a home machine widens the attack surface. The repository's `infra/gcp/phase3-ai` path exists for the day production needs GPU inference. [REPO]

## 2. Connections to set up, in order

| # | Connection | Where the secret lives | Check |
|---|---|---|---|
| 1 | Workstation to Ollama (loopback) | none | `t47 diagnostics local-ai` |
| 2 | OpenClaw to Ollama (native API, no `/v1`) | none (`ollama-local` placeholder) | `t47 openclaw audit`, then `openclaw doctor` |
| 3 | OpenClaw to `t47` (MCP over stdio) | none | ask the agent to list drafting agents |
| 4 | Workstation to the public site (GET only) | none | `t47 diagnostics site` |
| 5 | Agent-plane backup to Drive | `T47_BACKUP_KEY` in the user environment and the password manager | `t47 backup verify` on the copy read back from Drive |
| 6 | Ollama Cloud fallback | `OLLAMA_CLOUD_API_KEY` in the user environment | only after gate G12; `t47 agents run --dry-run` shows the chain |
| 7 | Stripe live, Supabase, Cloudflare, Google Cloud | Secret Manager, as today | the repository's gate scripts; not touched by this packet |
| 8 | Expo and EAS, Play Console, App Store Connect | each vendor's own sign-in on the workstation | section 4 |

No secret goes into `config/t47.toml`, Git, Drive or a chat. The loader rejects a config file that contains one.

## 3. Web portal

Live on Cloud Run. Candidate `47d405b` is deployed; later commits through `1ef5c51` are archived, not deployed. `/healthz` and `/api/hub/session` answer 200 and `/readyz` answers 503 by design until the backup and catalog gates pass. [REPO] The decision on record is HOLD.

Ship path: close the nine web P0 gates in `08-RELEASE-CHECKLISTS.md`, in the order given there. The packet contributes the restore drill record (`t47 backup drill`), the daily site diagnostic, and the single status view (`t47 release status`). It does not enable subscriptions, change DNS or TLS, or touch Supabase data.

## 4. Mobile

One Expo project builds both stores. Identifier `com.team47studio.app` on both. [REPO]

**Android and Google Play.** Scripts exist for preview, production and internal submit. Remaining: link the Expo project (`eas login`, `eas init`), produce a signed AAB, test on a physical device, complete the Play Console forms (listing, Data safety from `PLAY-DATA-SAFETY-DRAFT.md`, content rating, policy URLs), upload to the internal track. Store images from the D09 v2.1 packet pass `t47 release assets` (35 of 35 checks). One-time Play registration is $25. [REPO]

**iOS and App Store.** No iOS build or submit script exists in `apps/mobile` yet; `merge/patches/0001` adds `ios:preview`, `ios:production` and `ios:submit:testflight`, mirroring the Android ones (the mobile contract test still passes with it applied). `eas.json` has no iOS submit profile, so the first submit will ask for the App Store Connect details interactively. Remaining: Apple Developer Program enrollment ($99 a year [REPO]), an EAS iOS build, TestFlight on a device, App Privacy answers, age rating, review notes, and an in-app account deletion path, which App Review requires for apps that create accounts.

**Mobile billing route [DECISION].** This sets the fee line and what App Review will accept. Options:

| Option | Fee picture | Trade-off |
|---|---|---|
| A. No purchase in the app at launch | none | Simplest review. Members subscribe on the web. Recommended for first submission. |
| B. Store billing | 15% on each store at this size | Highest conversion inside the app, highest fee, two more billing integrations to reconcile with Stripe. |
| C. Link out to web checkout | Stripe only on iOS in the US today; Google charges a service fee on linked purchases | Lowest fee where permitted. Rules are moving; confirm with counsel before relying on it. |

Fee facts behind the table are in `06-ECONOMICS-AND-ROI.md` with sources. Record the choice against T&C Appendix C-4, then accept gate G18.

## 5. Decision records

| ID | Decision | Recommendation | Status |
|---|---|---|---|
| DR-1 | Workstation is the agent plane only; production stays in the cloud | Adopt | [DECISION] |
| DR-2 | Agent drafts cross to production only as reviewed exports carried by a person | Adopt | [DECISION] |
| DR-3 | Model changes follow the bake-off rule in `03` | Adopt | [DECISION] |
| DR-4 | Mobile billing: option A for first submission | Adopt, revisit after 90 days of data | [DECISION] |
| DR-5 | Ollama Cloud stays off until G12; then pay-as-you-go before any subscription tier | Adopt | [DECISION] |
| DR-6 | Make the repository private, or move internal documents out of it | Do one before any launch publicity | [DECISION] |
| DR-7 | Merge order across this packet, the D09 v3.9 handoff and the candidate build (`10-MERGE-PLAN.md`) | Adopt | [DECISION] |

## 6. Rollback

Agent plane: `t47 backup restore` into an empty folder, point `state_dir` at it. Remove the OpenClaw fragment by deleting the `t47-*` agent entries and the `t47` MCP server. Remove scheduled tasks with `Register-T47Tasks.ps1 -Remove`. None of this touches production. Production rollback stays with the repository's release process and its named rollback owner (gate G01).
