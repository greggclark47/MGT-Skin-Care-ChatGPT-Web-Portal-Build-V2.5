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
| Migration consolidation | The repository uses an ordered `0000`–`0010` database lineage and `0001`–`0002` portal lineage with clean-database and repeat-application contract tests. |
| Subscription architecture | Free/Premium comparison, monthly/annual Prices, Product binding, explicit test/live mode, recurring consent, Checkout, billing portal, and signed webhooks are implemented fail-closed. |
| Billing mode visibility | Customer session state and operator readiness distinguish MGT product commerce from subscription billing configuration. |
| Release evidence integrity | Staging, production, export, receipt, launch, monitoring, and closeout artifacts are checksum-bound and contract-tested. |
| Accessibility baseline | Theme contrast, reduced motion, forced colors, focus behavior, semantic components, and production build accessibility contracts pass locally. |
| Runtime hardening | API, worker, and web containers are read-only with dropped capabilities and no-new-privileges; the edge supplies CSP and cross-origin protections; public readiness is redacted; enabled local AI must report all required models. |
| Backup readiness contract | Backup records require a valid SHA-256 checksum plus a recent HTTPS-referenced restore drill. Production readiness fails when either the backup or restore proof is stale. |
| Ingredient seed parity | The deterministic fallback now derives from the canonical versioned 15-rule seed. Forward migration `0010_ingredient_rule_seed_alignment.sql` adds the previously omitted zinc-oxide rule used by the sunscreen seed product, and a contract prevents code/migration seed drift. |
| Catalog runtime safety | Production `/readyz` now fails closed with a redacted `catalog_unready` code unless every core routine slot has an in-stock, approved, non-sample product and every active product ingredient has a valid independently approved SME rule. Public catalog browsing and routine generation enforce the same gate even if an orchestrator ignores readiness. The operator health view reports bounded counts and warnings without exposing product names, customer data or vendor details. |
| Public projection safety | Approved knowledge articles and company settings now cross the public portal only through exact reader-facing projections. Author/reviewer/version/revision/review-note, tax, billing, operational, and internal-note fields remain server-side, with portal regressions covering both routes. |
| Authenticated session safety | The session response now projects only the account identifier, email, and bounded roles needed by the portal. Identity-provider, provider-subject, login-timestamp, and internal account fields remain server-side. |
| Session role allowlist | Public session roles are filtered through the reviewed operator-role catalogue; unknown internal role labels cannot reach the browser even if present in stored account data. |
| Optional billing readiness | The operator readiness phase treats disabled subscriptions as `not_applicable` under the Lean/referral scope, while an enabled subscription path remains fully gated on Stripe configuration, terms, prices, and signed events. |
| Anti-aging public catalog projection | Anti-aging discovery, comparison, and nearby-provider responses now expose only customer-facing record fields and a bounded provenance summary; import-run, ingestion, reviewer, and external-ID metadata remain server-side. |
| Style and wardrobe projection | Style-profile and wardrobe responses, including account export and legacy-array reads, now allowlist customer fields so unknown actor, photo, revision, and private-note fields remain server-side. |
| Operator snapshot projection | The authenticated `/admin` snapshot now uses exact operator projections for catalog, knowledge, support, order, job, and company records so actor/email fields, payment identifiers, vendor identifiers, and private notes do not cross the reviewed console boundary. |
| Skin profile and routine projection | Saved skin-match profiles, routine steps, match intelligence, score results, feedback, and account exports now use exact customer-facing projections. Raw records remain available only inside locked mutation paths, so contaminated actor, provider, internal-trace, and private-note fields stay server-side without breaking feedback, simplification, cart seeding, or revision behavior. |
| Account profile projection | Account-profile reads and exports now use the validated customer profile, communication/accessibility preferences, image-storage choice, timestamps, profile version, and revision only. Stored actor, provider-subject, and private-note fields remain server-side while existing synchronization and AI-context reads remain internal. |
| Replenishment reminder projection | Customer reminder reads and account exports now expose only product, due date, and paused state. Worker delivery identifiers, notification timestamps, and private notes remain server-side while existing scheduling and removal behavior is preserved. |
| Saved-retailer projection | Saved-retailer reads and account exports now expose only IDs from the reviewed retailer directory, filtering unknown or contaminated stored values without changing the existing save/remove allowlist. |
| Regimen export projection | Account export now allowlists regimen-cycle and check-in fields, preserving legacy partial records while excluding actor, consent, and arbitrary private fields. Two-week cycle scheduling, check-in, and deletion behavior remain unchanged. |
| Order export projection | Account export now allowlists order references, status, line items, totals, currency, and timestamps. Payment identifiers, actor/email fields, vendor metadata, and arbitrary private fields remain excluded; the external-commerce-only boundary is unchanged. |
| Notification payload projection | Customer notification reads and exports now use exact envelopes and kind-specific payloads. Replenishment exposes only product/due date; anti-aging reminders expose only entry/due date/cadence; delivery leases, claims, error details, actor fields, and arbitrary payload notes remain server-side. |
| Direct regimen-cycle projection | Direct regimen-cycle list, create, summary, check-in, and export responses now use exact cycle, summary, guidance, boundary, and check-in projections. Actor, consent, and arbitrary private fields remain server-side while two-week scheduling, check-in, and deletion behavior remain unchanged. |
| Image-export projection | Account-export Test Drive image metadata now uses a validated projection for approved image purposes, bounded names and sizes, timestamps, and removal state. Drive file IDs, provider references, actor fields, malformed records, and arbitrary private metadata remain excluded without changing test-storage lifecycle behavior. |
| Account-overview integrity counts | Account setup counts and readiness states now derive from validated public-shaped records, preventing malformed or incomplete actor-matching rows from overstating customer progress while preserving metadata-only output and existing synchronization routes. |
| Anti-aging record integrity projection | Customer-facing progress entries, reminders, and provider-handoff records now require valid public-shaped fields before list, summary, preview, control, export, or account-export projection. Invalid actor-matching rows are excluded while deletion remains privacy-complete and external-provider boundaries remain unchanged. |
| Support record integrity projection | Customer Support reads and account exports now require bounded ticket subjects, messages, reply text, statuses, request types, and timestamps. Malformed tickets are excluded and malformed replies are dropped while actor, email, assignment, escalation, source, and private metadata remain server-side. |
| Operator Support integrity projection | Operator/admin Support reads and aggregate Support metrics now reuse the validated ticket projection. Invalid rows are excluded, invalid replies are removed before operator updates, operator-only assignment/escalation/first-response fields are bounded, and invalid tickets cannot be updated. |
| AI output trace integrity projection | Account-export AI traces now require bounded identifiers, task/version fields, consent and knowledge revisions, result kinds, valid timestamps, and bounded citation references. Malformed traces are excluded while stale-state semantics and the AI provider boundary remain unchanged. |
| AI disclosure projection integrity | Account-consent reads and account exports now require the current disclosure version, valid capture/revocation timestamps, and internally consistent grant state. Malformed disclosures fail closed as `null` without changing consent enforcement or AI routing. |
| Subscription projection integrity | Account-export and V1 subscription ownership/entitlement projections now require structurally valid stored subscription records. Malformed identifiers, customer references, flags, periods, and timestamps are excluded or fail closed while Stripe checkout, webhook confirmation, cancellation, and external payment behavior remain unchanged. |
| Billing read projection integrity | `/billing` and `/billing/activity` now expose only validated membership and activity fields and reject malformed customer references before Stripe read calls. Invalid billing rows are omitted while checkout, webhook, portal, trial-cycle, and payment behavior remain unchanged. |
| Anti-aging AI telemetry projection integrity | Account-export and operator anti-aging AI telemetry now require approved response/task/validation fields, bounded latency and cost values, valid ratings/reasons/comments, and valid timestamps. Malformed event and feedback rows are excluded while recording, routing, and aggregate policy metrics remain unchanged. |
| Deletion-request projection integrity | Customer session, deletion-request, and account-export views plus the operator deletion queue now require valid request IDs, lifecycle states, timestamps, attempt counts, blocker codes, and completion proofs. Malformed rows fail closed or are excluded without changing deletion holds, worker processing, identity erasure, or cancellation. |
| Subscription-webhook health projection integrity | The operator subscription-webhook health view now requires valid receipt IDs, event types, lifecycle statuses, counters, timestamps, and sanitized error codes. Malformed receipts are excluded from operational counts and alerts while signed webhook processing and Stripe behavior remain unchanged. |
| Operations-alert history projection integrity | Operations-health and alert-history views now require validated alert IDs, delivery states, attempts, timestamps, retry values, alert codes, and sanitized error codes. Malformed events are excluded from counts and history while alert delivery, retries, and worker behavior remain unchanged. |
| AI routing telemetry projection integrity | Operator AI-routing and AI-economics views now require validated task identifiers, timestamps, bounded latency/cost/token values, retry attempts, boolean fallback/validation flags, and bounded failure codes. Malformed telemetry is excluded from route counts, economics, rates, alerts, and hourly views while AI provider routing, budget settlement, and the frozen provider stack remain unchanged. |
| AI budget projection integrity | Operator AI-economics budget and reservation views now require validated budget keys, non-negative bounded cents, lifecycle states, and timestamps. Malformed rows are excluded from budget listings, pending-hold counts, stale-hold alerts, and economics summaries while reservation locking, settlement, reconciliation, and the frozen provider stack remain unchanged. |
| AI reservation reconciliation projection integrity | The operator reservation and reconciliation view now requires validated hold IDs, budget references, bounded cents, operator references, billing references, and timestamps. Malformed pending holds and reconciliation records are excluded while reservation locking, settlement, reconciliation authorization, and the frozen provider stack remain unchanged. |
| Support metric projection integrity | Operator Support metrics now require validated dates, bounded counts, reviewed event types, and allowlisted dimensions. Malformed or free-text metric rows are excluded from Support totals, funnels, outcomes, and escalation summaries while ticket lifecycle, support ownership, and customer-facing Support behavior remain unchanged. |
| Referral metric projection integrity | Operator referral metrics now require validated dates, bounded counts, reviewed retailer IDs, and approved portal-discovery segments, including the explicit aggregate segment. Malformed or hidden dimensions are excluded from retailer outbound, saved, unsaved, retailer, and segment summaries while the referral-only commerce boundary and retailer routing remain unchanged. |
| Anti-aging search telemetry projection integrity | Anti-aging search and operations views now require validated UTC days, bounded request/empty-result counters, and bounded latency samples. Malformed rows are excluded from provider-search SLOs, daily summaries, readiness operations, and decision packets while provider discovery, location privacy, catalog review, and external-provider boundaries remain unchanged. |
| Operator snapshot integrity projection | Authenticated `/admin` catalog products, ingredient rules, reviewed knowledge, order references, and job summaries now require validated identifiers, bounded text, reviewed enums, non-negative numeric fields, and valid timestamps. Malformed persisted rows are excluded while operator workflows, external-commerce boundaries, and frozen AI/Stripe/Google Drive integrations remain unchanged. |
| Current operations alert-state projection integrity | The current `/admin/operations-health` alert delivery state now requires validated delivery status, delivery identifier, attempt count, timestamps, retry values, and terminal state. Malformed state fails closed to a safe `not_sent` view while alert delivery, retries, worker behavior, and alert history remain unchanged. |
| Operations health input projection integrity | Persisted notifications, operation runs, follow-up tasks, deletions, Support tickets, and subscription webhook receipts feeding `/admin/operations-health` now require validated operational fields before aggregation. Malformed rows are excluded from health counts and alert summaries while worker execution and external boundaries remain unchanged. |
| Operator audit projection integrity | The authenticated operator audit list now requires bounded identifiers and action labels plus valid timestamps. Malformed rows are excluded without exposing private fields while audit writes, role administration, and operator workflows remain unchanged. |
| Notification record integrity projection | Customer notification reads and account exports now require valid identifiers, reviewed kinds and statuses, required timestamps and attempts, and kind-specific payload fields. Malformed records fail closed while delivery leases, claims, errors, actor fields, and arbitrary payload metadata remain excluded. |
| Public catalog product integrity projection | `/catalog` now requires bounded identifiers, safe text, and reviewed routine slots before projecting customer product records. Malformed active rows are excluded while the established legacy fallback for omitted names/descriptions, matching, stock eligibility, and referral-only commerce remain unchanged. |
| Reviewed-knowledge integrity projection | Public reviewed-knowledge reads now require bounded identifiers and text plus HTTPS source URLs. Malformed approved rows are excluded without changing article search/content behavior, approval workflow, or AI knowledge use. |
| Company-settings integrity projection | The public company/settings response now requires bounded non-control text, a valid support email, bounded affiliations, and an exact publication flag. Invalid values fall back safely or are omitted without exposing private settings or changing company display and operator behavior. |
| Legacy-order integrity projection | Customer exports and operator order references now require bounded identifiers, reviewed lifecycle statuses, bounded/safe item records, bounded money values, normalized currency shape, and valid dates when present. Malformed stored orders are excluded rather than partially projected, while the referral-only commerce boundary and legacy order references remain unchanged. |
| Reviewed-knowledge integrity projection | The public reviewed-knowledge route now requires approved articles with bounded identifiers/text and HTTPS source URLs. Malformed approved rows are excluded while article search/content behavior and AI knowledge use remain unchanged. |

## Known blockers and their solutions

| Priority | Blocker | What is missing | Solution / exit evidence |
| --- | --- | --- | --- |
| P0 | Production environment | No approved production host, domain, secret-manager binding, or deployed origin is recorded. | Select the hosting target and domain; use the approved secret manager to materialize the candidate-bound staging/production contract pair and six role-scoped private inputs; run secret-injection admission and preflight; retain only redacted evidence. Never commit secrets or create a shared repository-adjacent production `.env`. |
| P0 | Production database and identity | The checked-in RLS baseline and structural audit are complete, but no live Supabase/Postgres project, migration transcript, authenticated cross-account isolation result, or real identity lifecycle transcript exists. | Provision separate staging and production projects; apply the checked-in migration lineage; run `pnpm infra:database-audit -- --output work/staging/database-audit.json`, then run authenticated RLS, immutability, account export/deletion, and concurrency checks; attach redacted evidence. |
| P0 | Immutable deployment | No approved Node/Caddy/Ollama image digests or container-startup proof for the target host. | Resolve immutable digests, build the exact candidate, deploy to isolated staging, and record startup, `/healthz`, `/readyz`, TLS, and edge-route results. |
| P0 | Backup recovery | No target-system backup and restore rehearsal. | Create an encrypted backup, restore it into an isolated target, verify row counts and application readiness, and record recovery time and checksum. |
| P0 | Legal approval | Eight counsel items remain organizationally open in the Drive readiness response. | Obtain dated approval for AI disclosure, cosmetic claims, cancellation, data access, PHI exclusion, photo scope, retention, and knowledge-evidence policy. Photo approval is not a launch gate while photo functionality remains disabled. |
| P0 | Named ownership | Release, go/no-go, rollback, incident, data, platform, support, and accessibility owners are not recorded. | Assign named people and decision records in the ship packet. Code cannot satisfy this gate. |
| P1 | Deployed accessibility | Local contracts pass, but no manual/deployed WCAG report exists. | Run automated and manual checks against staging, remediate serious findings, name the reviewer, and attach the report. |
| P1 | Support readiness | Portal support exists locally, but no staffed production response test is recorded. | Configure the production delivery/queue, submit a test request, confirm response and escalation timing, and attach the transcript without customer data. |
| P1 | Stripe live evidence | No live Product/Price lookup, Checkout, customer portal, signed delivery, cancellation, retry, refund-policy, or reconciliation evidence. | Decide whether subscriptions launch on day one. If yes, configure approved live identifiers and run the F440 billing evidence set. If no, keep `SUBSCRIPTIONS_ENABLED=false`; billing becomes non-gating. |
| P1 | AI provider evidence | No live provider availability, budget, latency, failure, or escalation-rate report. | Decide whether AI launches on day one. If yes, configure the approved providers and run the eval/provider evidence set. If no, keep AI unconfigured and preserve the visible unavailable state. |
| P1 | Full ingredient matrix | The canonical reviewed seed contains 15 rules; the blueprint calls for 34. No approved source for the remaining 19 rules is present locally. | An SME must supply and approve the remaining rules, or formally approve the 15-rule launch scope. Import only approved rows and require every active catalog ingredient to appear in the approved matrix. |
| P1 | Monitoring and launch window | No staffed observation window, incident channel, rollback rehearsal, or 15-minute/1-hour/24-hour/7-day owner record. | Complete staging rehearsal, approve the launch window, and fill the existing checksum-bound monitoring and closeout records. |
| P2 | Google Drive release archive | Drive contains the planning sources, but the current GitHub release checkpoint has not been archived there. | After the next release commit, export a credential-free release bundle and upload it into `MGT Skin Care V2`; verify the Drive file ID, URL, size, and checksum before marking the export complete. |

## Safe continuation order

1. Keep the current branch and passing local gates as the immutable candidate baseline.
2. Decide day-one scope for subscriptions, hosted AI, notifications, and photo functionality. Default uncertain services to disabled.
3. Assign the eight launch owners and select hosting, domain, Supabase projects, secret manager, support route, and launch window.
4. Materialize role-scoped production configuration through the approved secret manager, run `pnpm infra:secret-injection-admission`, then inject a short-lived validation context to run `node infra/portal/preflight.mjs`.
5. Provision isolated staging and production services; apply the ordered migrations and run the read-only structural database audit.
6. Run staging probes, customer journeys, RLS/identity checks, backup restore, accessibility review, support test, and optional billing/AI evidence.
7. Complete the production gate, evidence manifest, human approvals, execution review, receipt verification, and rollback rehearsal already implemented under `infra/portal`.
8. Deploy only the approved commit and immutable digests. Stop on any failed readiness, RLS, restore, accessibility, support, provider, or rollback gate.
9. Monitor at 15 minutes, 1 hour, 24 hours, and 7 days; then archive the checksum-bound closeout packet to GitHub and Google Drive.

## Current verification boundary

The local release suite validates builds, API and persistence contracts, release controls, web rendering, accessibility contracts, the production proxy journey, and the generated public artifact scan. It does not prove the behavior of live Supabase, identity, Stripe, AI providers, backups, DNS/TLS, containers, or human support. Production remains `NOT READY` until those target-system records are supplied.
