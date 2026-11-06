# Production Ship Plan Alignment

Source plan: [MGT Skin Care v2 - Production Ship Todo Plan](https://docs.google.com/document/d/1_CH18zq4xodxRc9oA0zAa67sbozPHDFHPgOwtEGtY58/edit?tab=t.0)

This document incorporates the linked plan into the remaining build and release structure. It is a checklist and evidence map, not a production approval. Local checks cannot substitute for live owner, provider, database, accessibility, hosting, or deployment evidence.

## Ship profiles

Choose one profile before configuration:

- **Lean:** referral portal only; subscriptions, commerce, hosted AI escalation, and external notifications disabled.
- **Standard:** referral portal plus Premium subscriptions with complete Stripe sandbox and support evidence.
- **Expanded:** Standard plus approved hosted AI, notifications, and additional operating coverage.

The Lean profile is the default economic-integrity recommendation. Optional capabilities stay disabled until their evidence, cost ceiling, legal terms, support process, and rollback behavior are complete.

## Requirement-to-gate map

| Requirement | Required setup | Evidence and release gate |
| --- | --- | --- |
| Scope and economics | Enabled routes, disabled capabilities, budget, provider spend ceilings, launch date, rollback authority | Approved scope memo; F656-F657; ship packet |
| Accountable ownership | Release, platform, data, support, accessibility, security, billing, AI, and incident owners with backups | Owner matrix; F650-F655; launch window |
| Hosting and domains | Separate staging/production, domain, TLS, edge, API/web origins, immutable digests | F670-F701; staging and production evidence |
| Secret management | Approved secret manager, placeholder-free values, staged injection, rotation procedure | F675/F697; secret-free attestation |
| Database | Production PostgreSQL/Supabase, migrations, RLS, identity lifecycle, concurrency, retention, deletion | F639/F660/F702-F704; migration/RLS reports |
| Backups and restore | Encrypted off-host backup, separate restore target, checksum, retention, restore drill | F530/F640/F661/F745; restore transcript |
| Catalog and content | Approved products, ingredients, safety rules, SME review, educational content, import rollback | Catalog/import/content evidence |
| Accessibility | Keyboard, focus, Escape, screen reader, contrast, zoom/reflow, mobile, browser, reduced motion, forced colors | F638/F654/F681/F751; deployed report |
| Support | Monitored route, named owner, coverage, test ticket, reply lifecycle, escalation | F526/F641/F653/F708/F750; support report |
| Billing | Approved Stripe Prices, terms, signed webhooks, lifecycle, reconciliation, rollback | Conditional F527/F645/F666/F710/F752 |
| AI runtime | Model/provider inventory, consent, entitlement, fallback, latency, spend, billing | Conditional F531/F646/F667/F711/F753 |
| Notifications | Provider, sender, consent, suppression, retries, idempotency, redaction, delivery and retention | F712; notification evidence |
| Staging | Isolated target, exact candidate, health/readiness, customer journeys, support, accessibility, backup, rollback | F437-F460 staging dossier |
| Production evidence | Configuration, support, accessibility, database, backup, startup, rollback, monitoring, incident, optional providers | F630-F649; production evidence matrix |
| Decision and launch | Go/no-go, legal/policy, budget, target, migration, backup, rollback, monitoring, incident, communications | F650-F689; named approvals |
| Supervised execution | Freeze, operator handoff, commands, probes, smoke journeys, alerts, rollback watch, audit capture | F690-F719; no implicit execution |
| Observation and closure | Receipt, route observations, database/RLS, worker, monitoring baseline, support, optional providers, archive | F720-F754 and post-execution chain |

## Structured remaining work

### Stage 1 - Decide

1. Select Lean, Standard, or Expanded profile.
2. Approve operating budget and provider ceilings.
3. Name every accountable owner and backup.
4. Confirm authoritative hosting, domain, database, secret manager, and archive destinations.
5. Confirm launch window and rollback authority.
6. Obtain and archive the approved Privacy Notice, Terms of Use, and AI Disclosure publication record for the production origin; it is separate from any subscription-terms decision.

### Stage 2 - Configure

1. Create isolated staging and production targets.
2. Configure TLS, edge routing, API/web origins, image digests, deployment logging, and rollback access.
3. Configure secret-manager injection with no values in source control.
4. Provision database, migrations, RLS, identity, retention, deletion, and backups.
5. Load approved catalog/content data.
6. Configure only the optional providers included in the approved profile.

### Stage 3 - Validate staging

1. Deploy the exact candidate to staging.
2. Run preflight, health/readiness, TLS, edge, worker, database, RLS, backup, and migration checks.
3. Run all enabled customer journeys.
4. Run support lifecycle validation.
5. Run deployed accessibility validation.
6. Record evidence with owner, timestamp, reference, checksum, result, and rollback reference.
7. Obtain release and platform approvals.

### Stage 4 - Prepare production

1. Freeze the candidate branch.
2. Build the production evidence matrix.
3. Verify candidate, bundle, image, migration, backup, support, accessibility, and optional-provider continuity.
4. Complete owner decisions, legal/policy review, scope decision, and budget decision.
5. Prepare launch window, command allowlist, rollback target, customer notice, incident channel, and monitoring dashboards.
6. Keep the launch hold active until the named decision-maker releases it.

### Stage 5 - Execute only after approval

1. Confirm latest backup and rollback target.
2. Apply the reviewed migration plan.
3. Inject secrets through the deployment system.
4. Deploy immutable API, web, and edge artifacts.
5. Verify health, readiness, TLS, edge, and smoke journeys.
6. Observe errors, latency, worker heartbeat, backup state, support delivery, and customer impact.
7. Record a non-secret operator receipt and post-operation probe.

### Stage 6 - Close out

1. Run 15-minute, one-hour, 24-hour, and seven-day reviews.
2. Verify rollback readiness and incident records.
3. Reconcile optional billing, AI, and notification outcomes when enabled.
4. Archive the final packet and destination receipts.
5. Record final closure and unresolved exceptions.

## Stop conditions

Stop and keep production gated for missing ownership, unresolved scope or budget, failed health/readiness, failed RLS, failed restore, mutable artifacts, missing TLS, unresolved accessibility blocker, broken support route, migration mismatch, provider evidence treated as optional when enabled, or missing rollback authority.

## Economic-integrity rules

- Do not pay for optional providers before their launch scope is approved.
- Prefer in-portal support and reminders before external messaging.
- Keep subscriptions disabled until reconciliation and support are staffed.
- Keep hosted AI escalation disabled until spend and fallback controls are proven.
- Use a small approved catalog before investing in automated imports.
- Prefer one encrypted off-host backup and a verified restore drill before adding high-cost redundancy.
- Do not count clicks, modeled conversion, or local readiness as revenue or production proof.

## Current release boundary

The latest verified local release-control checkpoint is F1089. It hardens the recovery gate so a serialized ready recovery-drill review independently rejects altered accountable-owner decisions, RTO/RPO measurements, migration identity, or checksum-bound evidence fields even after checksum recomputation. The full local verifier passed 1,358/1,358 checks on 2026-10-30; evidence is `work/verification/2026-10-30T23-24-09-102Z/report.md`. The local release checkpoint is `work/checkpoints/2026-10-30T23-25-55-244Z/report.md`: all local gates PASS, production preflight BLOCKED, release decision NOT READY. This verifies source and local fixtures only. It does not perform or prove a real backup/restore, create policy approval, configure production, or replace staging/production evidence and candidate-specific human go/no-go approval.

## Historical F1083 boundary

The project currently has local release-control coverage through F1083. This includes strict signed-backup freshness admission, API/worker startup fencing, versioned fail-closed production-admission guidance, browser/API catalogue parity, secret-free environment-template parity, candidate-bound six-file secret-injection admission, contract-pair evidence binding, provider-ACL evidence gating, stage-isolated Compose identity/host ports, catalog safety/public projection enforcement, reviewed-knowledge public projection, reviewed-knowledge integrity projection, company-settings public projection and integrity projection, legacy-order integrity projection, authenticated-session public projection, session role allowlisting, optional billing readiness semantics, operator snapshot projection, operator snapshot integrity projection, current operations alert-state projection integrity, operations health input projection integrity, operator audit projection integrity, notification record integrity, public catalog product integrity, anti-aging public catalog, style/wardrobe, skin profile/routine, account profile, replenishment reminder, saved-retailer, regimen export, order export, notification payload, direct regimen-cycle, image export, account-overview, anti-aging, Support, AI output trace, AI disclosure, subscription, billing-read, deletion-request, subscription-webhook, AI-routing, AI-budget, AI-reservation, Support-metric, referral-metric, and anti-aging-search persisted-record integrity projections. F1075–F1082 additionally require distinct safe public Privacy, Terms, AI Disclosure, account-portal, and Android API URLs; reject unsafe production Android configuration and secret-shaped public variable names; run that Android preflight before the standard EAS production command; and synchronize production-ready release fixtures with the same policy-publication admission. F1083 makes a separate, evidence-bound approval record for all three published policies mandatory before the production-environment review can be ready; a generic subscription-terms record cannot substitute. The full local verifier passed 1,353/1,353 checks on 2026-10-30; evidence is `work/verification/2026-10-30T18-47-12-369Z/report.md`. This is local source and fixture evidence only. Gregg Clark of MGT is the designated accountable owner, approver, and operator; that designation does not replace candidate-specific approvals. The remaining production blockers are live environment configuration and provider binding, real staging/production evidence, optional-feature decisions, external destination receipts, policy approval, and a recorded candidate-specific go/no-go decision. No local phase may change those states to pass without the referenced real-world evidence.
