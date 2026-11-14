# MGT Skin Care v2 — Production Ship Today Plan

Date: 2026-10-02
Status: local gates green; production not yet authorized
Branch: `codex/reconcile-main-2026-09-20`
Local portal tests: 116 passed
Static demo: rebuilt successfully

## Ship decision

The build is locally prepared for a release window, but it is not production-ready until live environment evidence, accountable owners, and launch approvals are supplied. The plan below is executable today only if those external prerequisites can be completed and independently reviewed. Do not mark missing live evidence as pass.

## Recommended same-day scope

Use the economically conservative launch profile:

- Referral portal enabled
- Product checkout, retailer purchase confirmation, fulfillment, refunds, and commerce disabled
- Premium subscriptions disabled unless billing evidence is already complete
- Hosted AI escalation disabled unless provider, consent, fallback, and spend evidence is complete
- External email/SMS/push disabled unless delivery, consent, suppression, and support evidence is complete
- In-portal support and reminders enabled only with a staffed owner

## Preflight: before the launch window

1. Name release, platform, data, support, accessibility, and incident owners.
2. Confirm hosting provider, production domain, database project, secret manager, and rollback authority.
3. Freeze the release candidate and record the exact commit, branch, checkpoint, and image digests.
4. Confirm the approved scope and operating budget.
5. Confirm that the production-shaped configuration contains no placeholders.
6. Confirm that no credentials or customer data are present in evidence or source control.

Stop if any owner, target, scope, budget, or rollback decision is missing.

## Staging evidence window

1. Provision an isolated staging target.
2. Inject secrets through the approved secret manager.
3. Deploy the exact candidate using immutable artifacts.
4. Run `/healthz` and `/readyz` checks.
5. Apply migrations through the approved process with automatic startup migration disabled.
6. Validate PostgreSQL/Supabase RLS, identity lifecycle, session isolation, concurrency, and transaction rollback.
7. Import only approved catalog and content data.
8. Run customer journeys: sign-in, Skin Match, My Skin, Routine, Coach, Shop, Saved, Replenishment, Account, Support, and enabled membership paths.
9. Run the deployed accessibility review.
10. Run the support test ticket through its full lifecycle.
11. Complete the encrypted backup restore drill.
12. Record each result with owner, timestamp, reference, checksum, and rollback reference.

Stop on failed readiness, failed RLS, failed restore, unresolved accessibility blocker, broken support route, data mismatch, or mutable artifact identity.

## Production evidence window

Complete and independently review:

- Configuration and secret-injection evidence
- Support ownership and test-ticket evidence
- Deployed accessibility report
- Database migrations, RLS, and identity lifecycle report
- Backup and restore transcript
- Immutable image/startup/edge report
- Catalog/content approval report
- Rollback rehearsal and approved rollback target
- Monitoring and incident route
- Billing evidence if subscriptions are enabled
- AI runtime evidence if hosted AI is enabled

The evidence packet must contain no placeholders, secrets, customer payloads, or fabricated ready states.

## Launch authorization

Before deployment, obtain named decisions for:

- Release go/no-go
- Platform readiness
- Data and migration readiness
- Support readiness
- Accessibility readiness
- Rollback readiness
- Launch window
- Incident ownership
- Customer communication

The current local release-control chain can verify checksums and record readiness. It cannot replace these real-world approvals or execute the deployment.

## Production execution window

1. Confirm the latest encrypted backup and restore point.
2. Confirm the approved rollback target.
3. Apply the reviewed migration plan and record the resulting version.
4. Inject secrets through the deployment system.
5. Deploy the exact immutable API, web, and edge artifacts.
6. Verify `/healthz`, `/readyz`, TLS, and edge routing.
7. Run external smoke checks for the home page, sign-in, one customer journey, and Support.
8. Test billing/webhooks only when billing is explicitly enabled.
9. Observe logs, worker heartbeat, error rate, latency, backup state, and support delivery for 15 minutes.
10. Record the non-secret operator receipt and post-operation probe.
11. Stop promotion immediately on a rollback trigger.

## Post-launch checks

Run checks at:

- 15 minutes
- 1 hour
- 24 hours
- 7 days

Review errors, latency, readiness, workers, backups, support, accessibility, customer impact, billing/webhooks, and AI spend where applicable.

## Immediate rollback triggers

- Failed health or readiness
- TLS or edge-routing failure
- Data isolation defect
- Customer-data exposure
- Migration incompatibility
- Material accessibility regression
- Repeated webhook misprocessing
- Provider spend or control failure
- Unstaffed support or incident escalation

Rollback to the last approved immutable artifacts. Do not automatically reverse database migrations.

## Required artifacts before declaring shipped

- Approved scope and budget memo
- Named-owner matrix
- Staging evidence ledger
- Production evidence matrix
- Migration and RLS report
- Restore transcript
- Accessibility report
- Support test report
- Rollback plan and rehearsal
- Final ship packet
- Named go/no-go decision
- Operator execution receipt
- Post-operation probe
- Monitoring records
- Release archive and destination receipts

## Current blockers

The local build is not the blocker. The remaining blockers are external: production hosting and domain, secret-manager configuration, live database/RLS evidence, backup restore proof, deployed accessibility validation, support ownership and route, catalog/content approval, billing and AI scope decisions, monitoring/on-call, rollback authority, final evidence packet, and authenticated GitHub/Drive destination receipts.

Until these are complete, the correct release state is **not ready for production**.
