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

The project currently has local release-control coverage through F814. The remaining production blockers are live environment configuration, real staging/production evidence, named ownership, optional-feature decisions, external destination receipts, and an approved go/no-go decision. No local phase may change those states to pass without the referenced real-world evidence.
