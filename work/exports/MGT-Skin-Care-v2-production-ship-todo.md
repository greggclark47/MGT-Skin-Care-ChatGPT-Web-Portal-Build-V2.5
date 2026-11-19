# MGT Skin Care v2 — Production Ship Todo Plan

Status: production not ready. Local build and release controls are substantially complete through F629. Remaining work is live environment setup, evidence collection, ownership, scope decisions, and final documentation.

## 1. Lock scope and economics

- Choose referral-only, referral plus Premium subscriptions, or expanded launch with hosted AI and notifications.
- Record enabled routes, disabled capabilities, operating budget, provider spend limits, support coverage, launch date, and rollback authority.
- Prefer referral-only for the lowest-cost, lowest-risk launch. Keep subscriptions, hosted AI, notifications, and commerce disabled until their evidence is complete.
- Evidence: approved scope memo and budget limits.

## 2. Assign accountable owners

- Name release, platform, database/data, support, accessibility, billing, AI/runtime, and incident owners.
- Record contacts, backup owners, responsibilities, coverage windows, and escalation routes.
- Evidence: signed owner matrix and staffed launch window.

## 3. Set up hosting and domains

- Create separate staging and production projects.
- Configure domain, TLS, edge routing, API origin, web origin, health routes, and readiness routes.
- Pin immutable API, web, Node, Ollama, and Caddy image digests.
- Disable automatic database migration at startup.
- Configure deployment logs and rollback access.
- Evidence: digest manifest, TLS proof, startup log, `/healthz`, `/readyz`, and edge-routing report.

## 4. Configure secrets safely

- Copy `infra/portal/env.example` into the approved secret manager.
- Replace placeholders with approved values only.
- Prohibit secrets in Git, images, logs, screenshots, evidence, and customer responses.
- Confirm staging injection and rotate any exposed credential.
- Do not provision paid-provider credentials until the feature is approved.
- Evidence: secret-injection proof containing names and statuses only.

## 5. Provision the database

- Create production PostgreSQL/Supabase project.
- Apply migrations through the approved process and record the exact version.
- Validate RLS, session isolation, roles, identity lifecycle, CSRF/origin protection, transactions, concurrency, retention, and deletion.
- Create a reversible data rollback plan.
- Evidence: migration, RLS, identity, concurrency, retention, deletion, and rollback reports.

## 6. Establish backups and restore

- Configure encrypted off-host backups and retention.
- Restore to a separate destination.
- Record checksum, duration, migration version, owner, and failed-restore procedure.
- Confirm `/readyz` reports backup and worker state separately from `/healthz`.
- Schedule recurring restore drills.
- Evidence: restore transcript and checksum.

## 7. Approve catalog and content

- Validate brand, product, type, ingredients, concerns, routine slot, safety rules, and source/review status.
- Import into staging and record before/after counts, rejected rows, missing ingredients, missing SME approvals, slot coverage, and rollback proof.
- Review educational content, safety language, and product claims.
- Evidence: catalog approval, import report, safety-rule approval, and content review.

## 8. Complete deployed accessibility validation

- Test keyboard navigation, focus, Escape, screen-reader semantics, contrast, zoom, reflow, mobile widths, browser matrix, reduced motion, and forced colors.
- Test sign-in, support, deletion, billing, dialogs, tables, errors, and route changes.
- Disposition every defect as fixed, exception, or blocker.
- Publish the report and only then set accessibility evidence fields.
- Evidence: deployed report URL, timestamp, browser/device matrix, and no unresolved blockers.

## 9. Establish support operations

- Select monitored mailbox/helpdesk and name owner plus backup.
- Define coverage hours, response workflow, escalation, and incident handling.
- Run a staging ticket through creation, status changes, customer-visible reply, privacy boundaries, audit history, and closure.
- Evidence: test ticket, lifecycle transcript, ownership confirmation, and escalation guide.

## 10. Decide billing scope

### Billing disabled

- Keep enrollment closed and mark billing not applicable.
- Remove claims implying active enrollment.
- Document the deferred decision.

### Billing enabled

- Create approved monthly and annual Stripe Prices.
- Approve business identity, trial, cancellation, refund, renewal, tax, and support terms.
- Configure signed webhooks.
- Test checkout, decline, trial, renewal, cancellation, portal, replayed events, entitlement, reconciliation, and rollback.
- Keep retailer purchases separate from MGT subscriptions.
- Evidence: Price IDs, sandbox report, webhook report, reconciliation report, and billing-owner approval.

## 11. Decide AI runtime scope

### Lean

- Local AI only, no hosted escalation, fixed models, manual monitoring, zero external provider spend.

### Standard

- Approved provider, fallback, consent, entitlement, token/spend limits, billing reconciliation, latency, and schema validation.

### Expanded

- Multiple providers, regional fallback, automated budget controls, health routing, and model-quality monitoring.

- Document models, providers, fallback, data sent, consent, retention, spend limits, and disable switch.
- Evidence: AI runtime report and owner approval.

## 12. Configure notifications

- Keep notifications disabled unless required.
- If enabled, select provider, verify sender identity, define recipient policy, implement consent/suppression, retries, idempotency, redaction, delivery evidence, and retention.
- Prefer in-portal alerts before paying for email, SMS, or push.
- Evidence: provider configuration, test delivery, suppression proof, and delivery report.

## 13. Run staging release controls

- Freeze branch and record exact commit and checkpoint.
- Build immutable artifacts and deploy to isolated staging.
- Run preflight, health/readiness probes, browser journeys, support, accessibility, database, and backup validation.
- Generate staging ledger, artifact review, human handoff, named approvals, operator record, and post-operation evidence.
- Keep staging and production evidence separate.
- Evidence: F437–F460 staging dossier and checksum-bound approvals.

## 14. Build the production evidence packet

- Attach configuration, support, accessibility, database/RLS, backup, billing if enabled, startup, AI if enabled, rollback, monitoring, incident, ownership, and launch-window evidence.
- Every item needs phase, owner, timestamp, reference, SHA-256 checksum, result, and rollback reference.
- Remove placeholders and credential-like text.

## 15. Perform final release review

- Confirm no critical issues, approved handling of high issues, owner signatures, restore and rollback rehearsals, staffed support/monitoring, active incident channel, matching candidate/image digests, matching database version, and approved economic scope.
- Run the release-control chain through the current final phase.

## 16. Execute the production window

- Confirm backup and rollback target.
- Apply reviewed migrations.
- Inject secrets through deployment system.
- Deploy immutable artifacts.
- Verify health/readiness and external smoke checks.
- Test one customer journey, one Support flow, and billing/webhooks only if enabled.
- Observe the first 15 minutes and record errors, latency, worker, backup, and support state.
- Promote exact candidate and archive evidence.

## 17. Monitor after launch

- Check at 15 minutes, 1 hour, 24 hours, and 7 days.
- Track errors, latency, health/readiness, worker heartbeat, backups, support delivery, accessibility, billing/webhooks, AI spend, AI latency, and customer-impact incidents.

## 18. Rollback conditions

- Failed health/readiness
- TLS or edge failure
- Data-isolation defect
- Customer-data exposure
- Migration incompatibility
- Material accessibility regression
- Repeated webhook errors
- Provider spend/control failure
- Unrecoverable support or incident escalation

Use the last approved immutable artifacts. Do not automatically reverse database migrations.

## Required clarification decisions

- Authoritative hosting provider, domain, database project, and secret manager
- Referral-only versus subscriptions
- Local-only versus hosted AI
- Notification requirement
- Named owners and support coverage
- Launch window and rollback authority
- Company identity, privacy policy, terms, retention, and deletion policy
- Approved catalog, ingredients, safety rules, and educational content
- Data residency and backup retention

## Final priority order

1. Lock scope and budget.
2. Assign owners.
3. Provision staging and production.
4. Configure secrets, database, backups, and hosting.
5. Approve catalog and content.
6. Complete accessibility and journey validation.
7. Establish support.
8. Decide billing, AI, and notification scope.
9. Complete staging evidence.
10. Complete production evidence.
11. Approve the ship packet.
12. Execute the launch window.
13. Monitor, archive, and close out.
