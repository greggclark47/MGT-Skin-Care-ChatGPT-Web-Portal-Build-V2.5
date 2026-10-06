# MGT Skin Care v2 full ship plan

Status: **NOT READY** until the required production configuration and live evidence are supplied outside source control.

This is the publish runbook for the referral portal. It is intentionally fail-closed: local verification can approve the repository candidate, but only staging and production evidence can approve a publish. No step below should place credentials, customer data, provider payloads, or backup files in the repository.

## 1. Release ownership and inputs

Assign these roles before opening a launch window:

| Role | Required decision or evidence |
| --- | --- |
| Release owner | Exact candidate commit, checkpoint, launch window, go/no-go decision |
| Support owner | Monitored support route, test ticket, coverage hours, response workflow |
| Data owner | Reviewed database project, migrations, RLS, retention and restore approval |
| Platform owner | Image digests, secrets injection, TLS/edge, health/readiness and rollback |
| Accessibility owner | Deployed keyboard, screen-reader, mobile/browser, contrast and WCAG evidence |
| Billing owner | Only if subscriptions are enabled: approved offers, sandbox lifecycle and signed webhooks |
| AI/runtime owner | Only if AI is enabled: model inventory, fallback, spend and provider evidence |

Required inputs are stored in the approved secret manager or evidence system, never in Git:

- A production-shaped `infra/portal/.env` with verified TLS, immutable image digests, ownership fields and approved provider settings.
- The reviewed Supabase/Postgres project and a migration/RLS report.
- A support mailbox or helpdesk route that can receive and answer a test request.
- A deployed accessibility report URL with a past validation timestamp.
- An encrypted off-host backup, restore destination, checksum and restore transcript.
- Approved container image digests and the exact release commit.
- Optional Stripe sandbox/live approvals, approved Product ID, and Price IDs if `SUBSCRIPTIONS_ENABLED=true`.
- Optional AI provider/model and billing evidence if a runtime is enabled.

## 2. Candidate freeze

1. Stop feature changes for the release candidate. Record the branch, exact commit, open exceptions and owners.
2. Confirm the existing branding, logo, route map, referral-only boundary and shared shell are unchanged unless the release decision explicitly includes them.
3. Run the local gates from a clean dependency install:

```text
pnpm install --frozen-lockfile
pnpm test:infra
pnpm test:compose-contract
pnpm test:lineage
pnpm test:verification
pnpm release:checkpoint
```

4. Save the checkpoint and verification reports under `work/` and attach them to the release record.
5. Push the candidate branch and require the protected-branch GitHub verification workflow to pass. Do not call a local pass a hosted pass.
6. Copy `infra/portal/ship-packet.example.json` into the approved evidence workspace, replace every placeholder, and keep the completed packet outside source control when it contains organization-specific names or links.
7. Generate a repository-grounded draft with `pnpm infra:create-ship-packet -- --output path/to/draft.json`; review the discovered branch, commit, latest local report paths and immutable image values before completing the packet. A generated draft is never approval.

The candidate is rejected if any local gate fails, the public artifact scan finds a provider/vendor string, or the source tree contains an unreviewed generated artifact.

## 3. Staging environment and data

1. Create or select a separate staging Supabase/Postgres project. Do not point staging at production data.
2. Copy `infra/portal/env.example` into the deployment secret store and fill staging values. Keep `PORTAL_AUTO_MIGRATE=false`.
3. Generate the `staging_evidence` section with `pnpm infra:create-ship-packet`. Complete the isolated-target fields, then run `pnpm infra:staging-probe -- --origin https://APPROVED-STAGING-ORIGIN --output work/staging/probe.json` after deployment. Record one evidence row for F437–F440: isolated staging target, secret-injection proof without values, immutable artifact plus `/healthz` and `/readyz`, and the release-owned evidence ledger. The target, probe, and attestation must agree on the exact candidate commit, origin, and image digests. Keep the required deployment, isolation, secret-injection, preflight, probe, and one shared rollback artifact as local text evidence below `work/` or `infra/`; do not place credentials in them. Generate a content-hashed standalone ledger with `pnpm infra:staging-artifacts -- --ledger path/to/completed-ship-packet.json --output work/staging/staging-evidence.json`, then re-hash it with `pnpm infra:staging-review -- --ledger work/staging/staging-evidence.json --output work/staging/review.json`. Build the independent human handoff with `pnpm infra:staging-handoff -- --ledger work/staging/staging-evidence.json --review work/staging/review.json --output work/staging/handoff.json --max-review-age-minutes 60`. It binds both local files, requires the review to match the exact canonical ledger within the stated 1–1440 minute freshness window, and can only remain blocked or await named release and platform approval. Each named approver records a decision-record reference, timestamp, handoff checksum, and a matching future execution window of four hours or less in its own local approval artifact. Then run `pnpm infra:staging-authorization -- --handoff work/staging/handoff.json --release-approval work/approvals/release.json --platform-approval work/approvals/platform.json --output work/staging/authorization.json --max-approval-age-minutes 60`. The resulting artifact can only remain blocked or `pending_operator_execution`; it contains no deployment, traffic, or publish command. After a named operator independently records a non-secret action record and captures a fresh safe probe, run `pnpm infra:staging-execution-review -- --authorization work/staging/authorization.json --receipt work/staging/execution-receipt.json --probe work/staging/post-execution-probe.json --output work/staging/execution-review.json`. It binds the recorded receipt to the authorization checksum, approved execution window, local operation record, and post-operation probe. A valid dossier is only `awaiting_external_release_gate`; it neither executes nor independently proves a real-world operation, and it cannot approve production, publish a release, or change traffic. Do not change a row to `pass` until its referenced evidence, SHA-256 checksum, rollback reference, owner and actual result are attached. A successful local artifact review, handoff, authorization, or execution dossier is only integrity evidence; it does not validate the host, deployment, secret manager, database, or live release.
4. Run `pnpm infra:preflight` against the injected staging environment. Then run `pnpm infra:readiness` with `RELEASE_LOCAL_GATES=true` and only the evidence flags that have actually been verified.
5. Review both migration lineages, apply migrations through the approved database process, and record the applied version. Portal migration `0002_hub_records_rls.sql` is mandatory because it keeps sessions, accounts, support, billing, and profile documents inaccessible to browser database roles. Do not rely on application startup to migrate. Run `pnpm infra:database-audit -- --output work/staging/database-audit.json` against the reviewed target and attach the redacted result.
6. Validate Supabase Auth URL/key, service-role deletion behavior, authenticated cross-account RLS, account export/deletion, stale revision handling and two-connection concurrent profile writes. The structural database audit does not replace these behavioral checks.
7. Manually provision the first staging superadmin through the trusted identity process. There is no public bootstrap endpoint.
8. Import only approved staging catalog/content. Record before/after counts, rejected rows, ingredient-rule approval, slot coverage and rollback proof.

Required exit evidence: completed F437–F460 staging-evidence ledger, artifact review, pending human handoff, checksum-bound release/platform authorization, and post-operation evidence dossier. Before any production decision, complete the separate F461–F464 production gate with a production-only target, exact candidate continuity, eight live evidence rows, five owner approvals, and a named go/no-go record. Review it with `pnpm infra:production-gate -- --gate work/production/gate.json --output work/production/gate-review.json`; its status is evidence only and does not publish or move traffic. Once that complete gate and its local non-secret evidence files exist, run `pnpm infra:production-evidence -- --gate work/production/gate.json --output work/production/evidence.json` to bind the 23 referenced artifacts to the canonical gate checksum and re-hash them before handoff. This local integrity manifest does not validate a host, make a decision, deploy, publish, or move traffic. Staging and production evidence must remain separate. Required production evidence also includes the staging environment summary without secrets, migration report, RLS report, identity lifecycle transcript, concurrency report, catalog-health report and a reversible data rollback plan.

## 4. Support, accessibility and customer journeys

1. Verify the named support owner can access the monitored mailbox or helpdesk route.
2. Submit a staging Support request, confirm its server-generated reference, move it through the allowed lifecycle, add a customer-visible reply, and confirm customer/operator privacy boundaries.
3. Run the deployed accessibility review on the staging origin: keyboard-only traversal, focus and Escape behavior, screen-reader labels/statuses, contrast, zoom/reflow, mobile widths, browser matrix and reduced-motion/forced-color behavior.
4. Publish the reviewed accessibility report to the approved evidence system. Set `ACCESSIBILITY_VALIDATION_REPORT_URL` and `ACCESSIBILITY_VALIDATED_AT` only after the review is complete.
5. Run the customer journeys through the edge: sign-in/verification, Skin Match, My Skin, Routine, Coach, Shop, Saved, Replenishment, Account/export/deletion, Support and any enabled membership flow.
6. Record non-JSON service failures, retry behavior, session expiry, unauthorized access, mobile overflow and operator separation defects.

Required exit evidence: support test ticket, ownership confirmation, accessibility report, browser/device matrix and zero unresolved release-blocking accessibility defects.

## 5. Operations, backups and runtime qualification

1. Build the approved immutable API, worker and web images, and use the approved Caddy and Ollama digests. Never substitute `latest` or another floating tag.
2. Start the staging stack with Compose. Run model synchronization only for approved models and only after Ollama is healthy.
3. Verify API `/healthz`, web health, edge health, TLS, same-origin API routing, security headers, compression, access logs, log rotation and graceful shutdown.
4. Confirm the worker heartbeat becomes healthy and that stale heartbeat/readiness transitions return the expected failure. Verify production `/readyz` reports backup and worker state separately from `/healthz`.
5. Complete an encrypted off-host backup restore drill into a separate destination. Record checksum, duration, owner, restored migration version and failed-restore procedure.
6. Validate retention jobs, notification delivery and webhook retry behavior with non-production recipients.
7. For enabled AI, verify installed models, latency, schema validation, fallback, consent, entitlement, budget reservation, provider billing reconciliation and spend limits. Keep hosted escalation disabled when its evidence is incomplete.

Required exit evidence: image digest manifest, Compose startup log, edge journey report, health/readiness transition report, backup restore transcript, retention/notification report and AI provider report where applicable.

## 6. Billing decision gate

Subscriptions remain disabled unless every item below is approved:

- Premium membership benefits, the approved monthly and annual Prices, trial, cancellation and refund language.
- Company identity, support route, published terms and support ownership.
- `STRIPE_LIVE_MODE`, `STRIPE_PREMIUM_PRODUCT_ID`, `STRIPE_PREMIUM_MONTHLY_PRICE_ID`, `STRIPE_PREMIUM_ANNUAL_PRICE_ID`, the matching server secret and signed webhook secret. Both Prices must resolve to the configured Product. Staging uses test mode; an approved production launch uses live mode.
- Sandbox Checkout, decline, trial, renewal, cancellation, portal, replayed event, ownership and entitlement evidence.
- Reconciliation and rollback procedure for failed or stalled events.

If any item is absent, keep `SUBSCRIPTIONS_ENABLED=false`, record F77 as `not_applicable`, and ship only the referral portal scope.

## 7. Final readiness packet and go/no-go

Run the packet only after evidence is attached:

```text
pnpm infra:preflight
pnpm infra:readiness -- --require-ready
pnpm infra:ship-packet -- infra/portal/ship-packet.json --require-ready
pnpm release:checkpoint -- --require-production
```

The ship-packet validator requires the exact candidate commit, branch, checkpoint and hosted CI references; accountable owners; one `go` approval for each required launch role; immutable Node/Ollama/Caddy digests; unique phase-bound evidence references; fresh packet metadata; the last approved rollback target with verification time; and 15-minute, one-hour, 24-hour and seven-day monitoring checks. When deployment image values are available, the packet must match them exactly. Its output contains statuses and references only, never secret values.

Set these non-secret flags only from the release evidence record, not by assumption:

| Flag | Evidence required |
| --- | --- |
| `RELEASE_EVIDENCE_SUPPORT_WORKFLOW=true` | Support owner, monitored route and successful test ticket |
| `RELEASE_EVIDENCE_ACCESSIBILITY_DEPLOYED=true` | Deployed accessibility report and defect disposition |
| `RELEASE_EVIDENCE_DATABASE_RLS=true` | Target database, migrations, RLS and identity lifecycle report |
| `RELEASE_EVIDENCE_BACKUP_RESTORE=true` | Encrypted restore drill and healthy `/readyz` evidence |
| `RELEASE_EVIDENCE_STRIPE_SANDBOX=true` | Required only when subscriptions are enabled; signed sandbox lifecycle report |
| `RELEASE_EVIDENCE_CONTAINER_STARTUP=true` | Immutable digest, startup, health/readiness and edge report |
| `RELEASE_EVIDENCE_AI_PROVIDER=true` | Required for an enabled AI runtime; model/provider, fallback and spend report |

Go only when:

- The readiness packet is entirely `pass` or `not_applicable`.
- The local checkpoint and hosted GitHub verification both pass for the exact candidate commit.
- No Critical issue is open; High issues have evidence or an approved written exception.
- Support, data, accessibility, platform and release owners have signed the decision.
- The rollback and restore rehearsals are complete.
- The launch window, monitoring owner and incident channel are staffed.

No-go immediately for missing ownership, failed RLS isolation, stale/unhealthy backup, failed accessibility blocker, unverified image/startup, failed edge routing, unresolved data migration mismatch, or billing/provider evidence being treated as optional when enabled.

## 8. Publish sequence

1. Announce the launch window and freeze the candidate commit.
2. Confirm the latest encrypted backup and restore point.
3. Apply the reviewed database migration plan, record the resulting version, and verify schema compatibility.
4. Inject secrets and non-secret configuration through the deployment system. Do not copy `.env` into the image or repository.
5. Start the approved Ollama service if enabled, run the approved model-sync profile, then start API and worker.
6. Start web and edge. Confirm Caddy certificate issuance/renewal, host routing and the edge-only public ports.
7. Run external smoke checks against the deployed origin: home, `/healthz`, `/readyz`, one sign-in path, one customer journey, one Support test, and any enabled billing/webhook smoke.
8. Observe logs, worker heartbeat, error rate, response time, backup state and support delivery for the first 15 minutes.
9. Promote the exact candidate to the published release record and retain all evidence links.

Do not enable subscriptions, hosted AI escalation, OpenClaw or external notifications in the same window unless their evidence is already included in the readiness packet.

## 9. Rollback and incident response

Trigger rollback for failed health/readiness, edge/TLS failure, data isolation defect, public customer-data exposure, migration incompatibility, material accessibility regression, repeated webhook misprocessing or provider spend/control failure.

1. Stop promotion and record the time, commit, symptoms, affected route and owner.
2. Keep the edge available only if it can safely serve the previous release; otherwise place it in the approved maintenance state.
3. Re-deploy the last approved immutable API/web/edge digests. Do not use floating tags.
4. Keep `PORTAL_AUTO_MIGRATE=false`. Do not reverse database migrations automatically.
5. If data integrity is affected, pause writes and use the approved restore/reconciliation procedure with the data owner.
6. Disable the affected optional boundary, such as subscriptions or hosted AI, if the referral portal remains safe to operate.
7. Re-run health, readiness, privacy, Support and customer smoke checks before reopening traffic.
8. Preserve logs, audit records, webhook receipts, backup evidence and the failed release packet for the incident review.

## 10. Post-publish monitoring and closeout

Check at 15 minutes, 1 hour, 24 hours and 7 days:

- `/healthz`, `/readyz`, edge/TLS, worker heartbeat and backup freshness.
- API error rate, latency, session failures, Support saves/replies, notification delivery and retry counts.
- RLS/privacy boundary probes, deletion queue blockers, audit integrity and webhook reconciliation.
- Accessibility reports from real deployed browsers/devices and any customer-reported barriers.
- AI request/fallback/validation/cost telemetry and provider reconciliation where enabled.
- Billing entitlements, signed-event failures and customer support contacts where enabled.

Close the release only after the monitoring record, incident review, known issues, evidence links, final commit, image digests and rollback reference are attached. Unresolved findings become named follow-up work with an owner and due date.
