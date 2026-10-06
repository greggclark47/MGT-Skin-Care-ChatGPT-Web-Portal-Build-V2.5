# MGT Skin Care v2 — Blueprint and Production Reconciliation

Generated: 2026-10-06  
Status: repository-local implementation verified; production deployment remains blocked on live environment evidence and human approvals.

## Authoritative sources

Use the sources in this order when they disagree:

1. The tested GitHub implementation on branch `codex/reconcile-main-2026-09-20`.
2. Repository release controls in `infra/portal/FULL-SHIP-PLAN.md`, `infra/portal/README.md`, and the newest commit-bound checkpoint.
3. The October 2 Google Drive production ship plan.
4. The September 29 Google Drive compliance, migration, and readiness analyses.
5. The September 5 master blueprint for product intent and decisions that were not superseded.

Google Drive references:

- [Master implementation blueprint v2](https://docs.google.com/document/d/1OwmTl9fYWKmyetTdoSZmwULegR2p9njL4nSoGB0BErc/edit)
- [Production readiness response](https://docs.google.com/document/d/1vui2cMm7_Bkp6COoZO9JrA4IPVjLWzA-yJ5SMCydiA4/edit)
- [Production ship plan — October 2](https://docs.google.com/document/d/1_CH18zq4xodxRc9oA0zAa67sbozPHDFHPgOwtEGtY58/edit)
- [Blueprint compliance update](https://docs.google.com/document/d/1WqpLf5pfG_ldVmDc1BIqS2mxL8aYCvyM8_dPSzpRL6Q/edit)
- [Migration cost and complexity analysis](https://docs.google.com/document/d/1lmRRKodMDAloCycGkDCJWFCazkCSWbBloe4lUL_xfQk/edit)

GitHub references:

- [Primary portal repository](https://github.com/greggclark47/MGT-Skin-Care-ChatGPT-Web-Portal-Build-V2.5)
- [MGT Skin Care v2 repository](https://github.com/greggclark47/MGT-Skin-Care-v2)
- Active release branch: `codex/reconcile-main-2026-09-20`

## Reconciled product scope

- The portal is referral-first for physical products. Retailers own product checkout, charges, shipping, returns, and refunds.
- MGT Premium is the only paid MGT consumer service. Free is the non-billable baseline.
- Premium supports monthly and annual Stripe Prices bound to one approved Stripe Product.
- Stripe subscription state becomes authoritative only through signed webhook reconciliation.
- Product-order commerce, vendor payouts, Stripe Connect, and the vendor portal remain deferred.
- Photo analysis remains disabled for the initial release. The schema retains the future consent type, but no photo upload or analysis route is exposed.
- AI responses are limited to approved knowledge excerpts, deterministic routine operations, or bounded operator analysis.

## Drive items already closed in the current build

| Drive concern | Current repository resolution |
| --- | --- |
| Duplicate application lineages | One workspace now owns API, web, mobile contracts, domain, AI gateway, analytics, database migrations, and release controls. |
| Durable AI disclosure consent | Versioned account consent, revocation, endpoint enforcement, export inclusion, audit records, and UI controls are implemented. |
| Medical-boundary pathway | Medical and urgent inputs now return a structured escalation type, prevent provider calls, and stop the active Coach topic until the customer starts a different cosmetic question. |
| Blocked medical claims | Domain and gateway validators reject blocked claims; gateway fallbacks and reviewed-output tests run in the release suite. |
| Append-only records | Checked-in migration `0007_compliance_release_controls.sql` installs immutable triggers for skin-match answers and subscription events. |
| Customer-data isolation baseline | Migration `0008_customer_data_rls.sql` enables owner-scoped RLS across customer tables and keeps provider, Stripe-mapping, and AI-routing records service-only. A redacted, read-only structural audit now fails closed on missing policies, triggers, extensions, or portal migrations. |
| Portal document-store isolation | Portal migration `0002_hub_records_rls.sql` makes the server-side session/account/profile/support/billing store service-only. The structural audit verifies both this boundary and the application connection's RLS authority without exposing its role name. |
| Service-table isolation | Migration `0009_service_table_rls.sql` closes direct browser-role access to public catalog, model configuration, webhook, admin, audit, fulfillment, and migration-ledger tables that are served only through the API. |
| Migration consolidation | The repository uses an ordered `0000`–`0009` database lineage and `0001`–`0002` portal lineage with clean-database and repeat-application contract tests. |
| Subscription architecture | Free/Premium comparison, monthly/annual Prices, Product binding, explicit test/live mode, recurring consent, Checkout, billing portal, and signed webhooks are implemented fail-closed. |
| Billing mode visibility | Customer session state and operator readiness distinguish MGT product commerce from subscription billing configuration. |
| Release evidence integrity | Staging, production, export, receipt, launch, monitoring, and closeout artifacts are checksum-bound and contract-tested. |
| Accessibility baseline | Theme contrast, reduced motion, forced colors, focus behavior, semantic components, and production build accessibility contracts pass locally. |
| Runtime hardening | API, worker, and web containers are read-only with dropped capabilities and no-new-privileges; the edge supplies CSP and cross-origin protections; public readiness is redacted; enabled local AI must report all required models. |
| Backup readiness contract | Backup records require a valid SHA-256 checksum plus a recent HTTPS-referenced restore drill. Production readiness fails when either the backup or restore proof is stale. |

## Known blockers and their solutions

| Priority | Blocker | What is missing | Solution / exit evidence |
| --- | --- | --- | --- |
| P0 | Production environment | No approved production `.env`, host, domain, secret manager, or deployed origin is recorded. | Select the hosting target and domain, create `infra/portal/.env` from `env.example` in the deployment secret manager, run preflight, and retain the redacted result. Never commit secrets. |
| P0 | Production database and identity | The checked-in RLS baseline and structural audit are complete, but no live Supabase/Postgres project, migration transcript, authenticated cross-account isolation result, or real identity lifecycle transcript exists. | Provision separate staging and production projects; apply the checked-in migration lineage; run `pnpm infra:database-audit -- --output work/staging/database-audit.json`, then run authenticated RLS, immutability, account export/deletion, and concurrency checks; attach redacted evidence. |
| P0 | Immutable deployment | No approved Node/Caddy/Ollama image digests or container-startup proof for the target host. | Resolve immutable digests, build the exact candidate, deploy to isolated staging, and record startup, `/healthz`, `/readyz`, TLS, and edge-route results. |
| P0 | Backup recovery | No target-system backup and restore rehearsal. | Create an encrypted backup, restore it into an isolated target, verify row counts and application readiness, and record recovery time and checksum. |
| P0 | Legal approval | Eight counsel items remain organizationally open in the Drive readiness response. | Obtain dated approval for AI disclosure, cosmetic claims, cancellation, data access, PHI exclusion, photo scope, retention, and knowledge-evidence policy. Photo approval is not a launch gate while photo functionality remains disabled. |
| P0 | Named ownership | Release, go/no-go, rollback, incident, data, platform, support, and accessibility owners are not recorded. | Assign named people and decision records in the ship packet. Code cannot satisfy this gate. |
| P1 | Deployed accessibility | Local contracts pass, but no manual/deployed WCAG report exists. | Run automated and manual checks against staging, remediate serious findings, name the reviewer, and attach the report. |
| P1 | Support readiness | Portal support exists locally, but no staffed production response test is recorded. | Configure the production delivery/queue, submit a test request, confirm response and escalation timing, and attach the transcript without customer data. |
| P1 | Stripe live evidence | No live Product/Price lookup, Checkout, customer portal, signed delivery, cancellation, retry, refund-policy, or reconciliation evidence. | Decide whether subscriptions launch on day one. If yes, configure approved live identifiers and run the F440 billing evidence set. If no, keep `SUBSCRIPTIONS_ENABLED=false`; billing becomes non-gating. |
| P1 | AI provider evidence | No live provider availability, budget, latency, failure, or escalation-rate report. | Decide whether AI launches on day one. If yes, configure the approved providers and run the eval/provider evidence set. If no, keep AI unconfigured and preserve the visible unavailable state. |
| P1 | Monitoring and launch window | No staffed observation window, incident channel, rollback rehearsal, or 15-minute/1-hour/24-hour/7-day owner record. | Complete staging rehearsal, approve the launch window, and fill the existing checksum-bound monitoring and closeout records. |
| P2 | Google Drive release archive | Drive contains the planning sources, but the current GitHub release checkpoint has not been archived there. | After the next release commit, export a credential-free release bundle and upload it into `MGT Skin Care V2`; verify the Drive file ID, URL, size, and checksum before marking the export complete. |

## Safe continuation order

1. Keep the current branch and passing local gates as the immutable candidate baseline.
2. Decide day-one scope for subscriptions, hosted AI, notifications, and photo functionality. Default uncertain services to disabled.
3. Assign the eight launch owners and select hosting, domain, Supabase projects, secret manager, support route, and launch window.
4. Populate production configuration outside Git and run `node infra/portal/preflight.mjs`.
5. Provision isolated staging and production services; apply the ordered migrations and run the read-only structural database audit.
6. Run staging probes, customer journeys, RLS/identity checks, backup restore, accessibility review, support test, and optional billing/AI evidence.
7. Complete the production gate, evidence manifest, human approvals, execution review, receipt verification, and rollback rehearsal already implemented under `infra/portal`.
8. Deploy only the approved commit and immutable digests. Stop on any failed readiness, RLS, restore, accessibility, support, provider, or rollback gate.
9. Monitor at 15 minutes, 1 hour, 24 hours, and 7 days; then archive the checksum-bound closeout packet to GitHub and Google Drive.

## Current verification boundary

The local release suite validates builds, API and persistence contracts, release controls, web rendering, accessibility contracts, the production proxy journey, and the generated public artifact scan. It does not prove the behavior of live Supabase, identity, Stripe, AI providers, backups, DNS/TLS, containers, or human support. Production remains `NOT READY` until those target-system records are supplied.
