# Backend and subscription infrastructure — September 7, 2026

The phased build, test and production-readiness program is maintained in [`BUILD-READINESS-GUIDE.md`](../../BUILD-READINESS-GUIDE.md).

## Implemented
- Existing customer tabs use /api/hub: profile/matching, routine simplification, saved retailer destinations, reminders, knowledge, coach, session/account, and support.
- Administration pages now call the same verified-session API. A typed user ID no longer supplies identity. Roles must be provisioned in the accounts record by an operator. No public role-grant endpoint exists.
- One consumer Premium membership shares `/membership`, with separately configured monthly and annual Stripe Prices. Customer, checkout-attempt, and confirmed status records are isolated to that consumer membership.
- Product checkout, partner onboarding, connected-account payouts, refunds and vendor transfers remain blocked or deferred. The partner API namespace returns a clear deferred response until commercial readiness is approved.
- Premium enrollment remains closed without complete approval and configuration. No existing tab is paywalled, and no paid benefits are promised beyond the approved membership description.
- The membership page no longer uses personalized plan recommendations. It presents the single Premium offer and cannot enroll or charge a customer by selection alone.
- Shop outbound opens and saved-list changes are counted only as daily aggregate engagement. Authorized operations roles can view a 30-day retailer and segment summary; it contains no customer identity, skin profile, search, free text, order, amount, revenue or profit data. These counters expire after 180 days by default through `OPERATIONS_AGGREGATE_METRIC_RETENTION_DAYS`.
- Assistant guidance results and selections of approved portal next steps are also stored as daily aggregate counters. The operations panel shows guidance by bounded role and the aggregate Support handoff funnel. It does not store the submitted question, customer identity, account details or ticket text in those metrics, and the counts are not unique-customer or service-outcome measures.

## Stripe setup
1. Use a Stripe sandbox/test account first. After Premium benefits, the $14.99 monthly / $149.99 annual prices, trial terms, and support ownership are approved, create the two recurring Prices.
2. Set `STRIPE_PREMIUM_MONTHLY_PRICE_ID` and `STRIPE_PREMIUM_ANNUAL_PRICE_ID`. Keep `STRIPE_SECRET_KEY` server-side only.
3. The app creates a restricted customer-portal configuration for payment methods, provider invoices, end-of-period cancellation, and Premium monthly/annual changes. Set the business identity and terms URL in the Stripe account.
4. Register /webhooks/subscriptions on the API (the included edge configuration forwards it). Subscribe to checkout.session.completed and customer.subscription.created, updated and deleted. Store its signing secret in STRIPE_SUBSCRIPTION_WEBHOOK_SECRET.
5. Finalize company legal_name, support_email and policies_published in settings/company, then set SUBSCRIPTION_TERMS_APPROVED=true and SUBSCRIPTIONS_ENABLED=true.
6. Test checkout, decline, renewal failure, cancellation, portal access and replayed events in the sandbox before configuring live credentials. Browser return URLs never activate access.

Current local tests use a mocked Stripe client with real signature verification. They cover the Premium catalog, configured-price validation, Checkout metadata, trial handling, portal access, signed-event confirmation, duplicate delivery, ownership, and sanitized activity. No Stripe account has been provisioned, prices created, payments collected, or live webhooks validated.

The 2026-09-25 provisional plans checkpoint passed every local release gate at `work/verification/2026-09-25T16-05-56-744Z/report.md`: 70 HTTP/persistence/release-contract tests, production web build, 29-route proxy journey, accessibility-theme contract, and a zero-hit public artifact vendor scan. This is local fixture evidence only.

## Deployment scaffold
Copy infra/portal/env.example to infra/portal/.env and fill service values outside source control. DATABASE_URL must identify the reviewed Supabase database, use verified TLS, and URI-encode reserved characters in credentials. API and worker use the same external database. Compose no longer provisions an independent database; existing local database volumes have not been deleted. Only the TLS edge publishes host ports. API refuses demo mode or HTTP public origins in production. Web-to-API forwarding is set at build time. Do not deploy before schema/identity reconciliation and role-based RLS checks.

Before building containers, run `pnpm infra:preflight`. It rejects placeholder origins, missing backend settings, unverified database TLS, automatic production migration, invalid worker/backup windows, incomplete notification-webhook configuration, missing named support ownership, missing deployed accessibility evidence, partially enabled subscriptions, and floating container image tags. Configuration validation does not establish live readiness. Run `pnpm test:infra` after changing this contract.

`pnpm test:compliance-contract` protects the repository-local Path B controls: the single Premium catalog and two-price configuration, durable AI-disclosure enforcement and revocation, consent controls before reviewed requests, deferred partner/payout APIs, and the additive RLS/append-only migration. It is source-contract evidence only; target-database RLS behavior and deployed provider behavior still require staging evidence.

After the local gates have run, `pnpm infra:readiness` creates a secret-free F71–F80 status packet. It separates configuration and local-test results from pending live evidence such as target-project RLS validation, backup restoration, deployed accessibility, container startup, sandbox webhooks, and provider qualification. Add `-- --require-ready` when a release process should fail unless every required phase is `pass` or `not_applicable`.

The publish runbook is [`FULL-SHIP-PLAN.md`](./FULL-SHIP-PLAN.md). It is the required handoff for candidate freeze, staging, live evidence, go/no-go, immutable image publication, smoke checks, rollback and post-launch monitoring. The readiness CLI accepts only explicit non-secret `RELEASE_EVIDENCE_*` flags; those flags must be set from attached evidence and must not be used to bypass a failed preflight.

Use [`ship-packet.example.json`](./ship-packet.example.json) as the release-record shape. Validate a completed packet with `pnpm infra:ship-packet -- path/to/ship-packet.json --require-ready`; it fails closed unless the readiness packet, candidate identity, owners, evidence references, image digests, rollback target and monitoring checks are complete.

Every ship packet now includes a `staging_evidence` ledger for F437–F460. Its four required records bind the isolated staging target, secret-injection proof without values, immutable artifact plus health/readiness result, and release-owned evidence ledger to the exact candidate commit and image digests. The ledger also requires a target-isolation record, a safe `/healthz` and `/readyz` probe, an attestation, and a six-item local artifact manifest for deployment, isolation, secret-injection, preflight, probe, and rollback evidence. The manifest accepts only bounded UTF-8 `.json`, `.log`, `.md`, or `.txt` files below `10 MiB` under `work/` or `infra/`; it rejects traversal, links, binary content, placeholders, and credential-like text. Its preflight and probe hashes must match the attestation, and every staging record must use the same rollback artifact. Run `pnpm infra:staging-probe -- --origin https://staging.example --output work/staging/probe.json` only against an approved staging origin; the probe writes status and timing only, never response bodies. After the actual ledger fields and local evidence files are complete, run `pnpm infra:staging-artifacts -- --ledger path/to/ship-packet.json --output work/staging/staging-evidence.json`, then `pnpm infra:staging-review -- --ledger work/staging/staging-evidence.json --output work/staging/review.json`. The review canonicalizes and hashes the ledger, re-hashes every artifact, and emits only candidate identity, statuses, counts, and redacted errors. Next run `pnpm infra:staging-handoff -- --ledger work/staging/staging-evidence.json --review work/staging/review.json --output work/staging/handoff.json --max-review-age-minutes 60`. It re-reads both files, enforces their exact checksum binding and the stated freshness window, and can only return `blocked` or `pending_human_promotion_approval`. Named release and platform approvers must each create a checksum-bound approval record, with the same future execution window, before `pnpm infra:staging-authorization -- --handoff work/staging/handoff.json --release-approval work/approvals/release.json --platform-approval work/approvals/platform.json --output work/staging/authorization.json --max-approval-age-minutes 60` can return `pending_operator_execution`. A named operator may then create a non-secret receipt and post-operation safe-probe artifact. `pnpm infra:staging-execution-review -- --authorization work/staging/authorization.json --receipt work/staging/execution-receipt.json --probe work/staging/post-execution-probe.json --output work/staging/execution-review.json` validates the recorded receipt against the authorization checksum, approved window, local operation record, and probe. Its only successful state is `awaiting_external_release_gate`; it does not verify the real-world operation or approve production, deploy, publish, or change traffic. `pnpm test:staging-evidence`, `pnpm test:staging-pipeline`, `pnpm test:staging-artifacts`, `pnpm test:staging-authorization`, and `pnpm test:staging-execution-review` reject placeholders, mutable or mismatched images, changed files, stale or mismatched reviews/approvals, incomplete records, unresolved blockers, failed health/readiness, window violations, and invented approved states.

The final production gate is separate from staging. Create it with `createProductionGateTemplate`, complete the production-only target, eight live evidence rows, five owner approvals, and the explicit decision record, then review it with `pnpm infra:production-gate -- --gate work/production/gate.json --output work/production/gate-review.json`. The validator rejects staging origins, mismatched candidate/image continuity, missing or unresolved production evidence, credential-like values, and a `go` decision without every check and owner approval passing. Its report is status-only: `blocked`, `held`, `pending_human_go_no_go`, or `go_recorded`; it never publishes, deploys, or moves traffic. Once the gate is complete, run `pnpm infra:production-evidence -- --gate work/production/gate.json --output work/production/evidence.json` to bind its staging dossier, eight evidence rows, eight rollback records, five owner decisions, and the go/no-go record to locally inspectable checksums. The manifest accepts only safe bounded text files under `work/` or `infra/`; it does not fetch remote material, validate a host, or make a launch decision. Use `pnpm test:production-gate` and `pnpm test:production-evidence` for the contract suites.

For the GitHub/Google Drive handoff, run `pnpm infra:release-export -- --output work/exports/release-export.json`. It binds the accepted release documents, and an optional local `.zip`, to the exact candidate commit with one canonical bundle checksum. GitHub remotes are recorded as `pending_push`; Google Drive is recorded as `pending_upload` without invented folder IDs or URLs. `pnpm test:release-export` re-hashes the entries and rejects changed files, traversal, credential-like content, and destination states that lack observed completion metadata. Mark a Drive upload complete only after a connected Drive readback supplies its real file ID and HTTPS URL.

After a real push and Drive upload, record the observed destination receipts and run `pnpm infra:release-receipt -- --manifest work/exports/release-export.json --github-receipt work/exports/github-receipt.json --drive-receipt work/exports/google-drive-receipt.json --output work/exports/release-receipt.json`. The review binds both receipts to the same candidate and archive checksum; without both receipts it remains `awaiting_receipts`, and any mismatch is `blocked`.

Finally run `pnpm infra:release-closeout -- --manifest work/exports/release-export.json --review work/exports/release-receipt.json --output work/exports/release-closeout.json --max-receipt-age-minutes 1440`. It revalidates the manifest and receipt chain, rejects stale destination observations, and can only report `blocked`, `pending_receipts`, `stale_receipts`, or `release_closeout_ready`.

The finalization matrix is `pnpm infra:release-finalization -- --manifest work/exports/release-export.json --closeout work/exports/release-closeout.json --review work/exports/release-receipt.json --records work/exports/finalization-records.json --output work/exports/release-finalization.json`. It binds six separate local records—decision, rollback, monitoring, support, customer communication, and audit archive—to the exact candidate and checksum chain. Missing receipts leave it `pending_closeout`; changed or unsafe records are `blocked`.

The launch-review matrix is `pnpm infra:release-launch-review -- --manifest work/exports/release-export.json --closeout work/exports/release-closeout.json --review work/exports/release-receipt.json --finalization work/exports/release-finalization.json --records work/exports/launch-records.json --output work/exports/release-launch-review.json`. It binds ten launch controls—window, freeze, owner, operator, rollback trigger, incident route, first-hour watch, customer-impact watch, command-log archive, and closeout timestamp—to the finalization checksum. It remains `pending_finalization` until the earlier chain is ready.

The execution-review matrix is `pnpm infra:release-execution-review -- --manifest work/exports/release-export.json --closeout work/exports/release-closeout.json --review work/exports/release-receipt.json --finalization work/exports/release-finalization.json --launch-review work/exports/release-launch-review.json --records work/exports/execution-records.json --output work/exports/release-execution-review.json`. It binds twelve execution controls to the launch-review checksum and remains `pending_launch_review` until the prior chain is ready.

Generate a starting draft with `pnpm infra:create-ship-packet -- --output path/to/draft.json`. The generator discovers only repository metadata, recent local report paths and valid immutable image digests; it never copies credentials or customer data and leaves all human approval fields pending.

The application, edge, and Ollama images are required to use approved immutable `@sha256:` digests. Set `NODE_IMAGE`, `OLLAMA_IMAGE`, and `CADDY_IMAGE` in the deployment environment after reviewing the exact image digests; floating tags such as `latest` and `2` are rejected by preflight.

The edge now sends compression and baseline security headers, exposes liveness and readiness separately, routes same-origin API and signed subscription webhook traffic directly to the API, and emits structured access logs. Compose rotates local JSON logs, waits for both API and web health before starting the edge, and gives Node services explicit shutdown windows.

Dockerfiles and Compose remain unvalidated in containers. Pin image digests and review network/secret management before deployment. `PORTAL_AUTO_MIGRATE=false` is required in production. The portal only checks its required storage columns at startup; migration application is a separately reviewed operation after inspecting both migration lineages. Local development may explicitly opt into the existing migration helper. No migration history has been reconciled against a live project here.

## Continuous verification
The repository runs the same secret-free local release gate on pull requests and pushes to `main`. It installs only the locked dependency graph, validates deployment and migration contracts, and creates fresh local verification evidence. It does not run production preflight, contact any external service, build containers, deploy, or receive production credentials.

## Local-first AI setup
The portal uses one shared gateway. Ollama is the default runtime for high-frequency tasks, DeepSeek runs as the local reasoning fallback through Ollama, OpenClaw can be enabled in native Ollama mode, and GPT-5.6 Sol is the opt-in escalation for explicitly entitled premium work. LangChain Core bounds and serializes the retrieved context; it does not create an additional model call. Routing telemetry and daily AI spend caps are persisted through the same Supabase/Postgres store as the portal, rather than resetting on an API restart.

The shared portal shell preserves the Skip to content link and moves keyboard focus to the main landmark after in-portal navigation. Opening the mobile menu focuses its first primary destination; Escape closes it and returns focus to Menu. The production proxy journey also verifies the Skip link, labeled primary and policy navigation, main landmark, and image alternative-text attributes on every portal route. These are local accessibility safeguards, not substitutes for a full assistive-technology or WCAG audit.

`node infra/portal/accessibility-theme-contract.cjs` calculates WCAG contrast for the declared normal-text theme-token pairs, requiring 4.5:1 in both themes, and protects the reduced-motion, forced-color, and visible-focus rules. It is included in `node infra/portal/verify.cjs`. Component-state, image, zoom/reflow, browser, and assistive-technology review remain separate release evidence.

The shared shell also maintains route-specific browser titles, politely announces in-portal page changes, and moves focus to the new main content. Support, Coach, and account forms expose busy and associated error states, while the application error boundary focuses its recovery heading. These behaviors preserve the visible MGT experience and still require deployed browser and assistive-technology validation.

Shared confirmation dialogs restore opener focus and expose their title, description and busy state. Retailer comparisons, Shop filters, reviewed-library search and Replenishment totals now connect their controls and politely announced status text. These improvements do not alter retailer ranking, catalog content, reminders, purchases or commercial boundaries.

Membership selectors, renewal confirmations, guest invitations, the shared Beauty & Style profile and confirmed billing activity now expose clearer grouping, busy/error relationships, status announcements and focus return. Subscription status continues to depend on authoritative signed events; portal activity is not a payment receipt.

Operator controls now associate gated-action reasons, use keyboard-reachable pressed buttons for knowledge and ingredient-rule selection, connect role-management and AI/reconciliation forms to their busy/error state, and announce advisory analysis results. Authorization, approval, audit and cost controls are unchanged.

The Compose file includes Ollama with a persistent model volume, bounded parallelism, model residency controls, and a one-shot `model-sync` profile. After setting approved model tags in the environment, synchronize only the models needed by the current feature set:

```text
docker compose up -d ollama
docker compose --profile model-sync run --rm model-sync
docker compose up -d api web edge
```

The Codex build lane is not an Ollama model or a public portal runtime. It remains the controlled engineering/escalation path behind the server boundary; Ollama handles routine portal traffic. Do not add a public `codex` endpoint or expose a model/provider label to the client.

Caddy now persists its configuration state separately from certificates and validates the mounted Caddyfile in its healthcheck. The edge still remains the only service publishing host ports.

Keep `OPENCLAW_ENABLED=false` until the OpenClaw runtime has been installed and tested against Ollama's native `/api/chat` endpoint. Set `OPENCLAW_API_MODE=openai-completions` only for a separately verified compatible proxy. Hosted OpenAI escalation is optional; keep its key unset to run the portal entirely on the local stack. Supabase remains the identity and production data system of record: provide its Auth URL/key and a production PostgreSQL connection in the server environment only. The worker also needs `SUPABASE_SERVICE_ROLE_KEY` to complete requested identity deletion; keep that privileged key server-side and never expose it to the web build.

## Tab coverage and remaining external setup
| Area | Backend | Remaining |
|---|---|---|
| Applications | Navigation | None for navigation |
| Skin Match / My Skin / Routine | Persistent profile and rules matching | Approved product and ingredient data |
| Shop / Saved | Allowlisted retailer links; saved destinations | Negotiated vendor agreements |
| Replenishment | Persistent reminders, durable in-app notifications and optional HTTPS webhook delivery | Configure a delivery channel and test it with real recipients |
| Coach | Reviewed-library local-first gateway with Ollama, DeepSeek fallback, LangChain context pipeline and Supabase-backed telemetry | Ollama models, reviewed content, optional hosted escalation validation |
| Learn | Approved knowledge records | Editorial publishing |
| Account | Supabase OTP, secure cookie session, data export, and delayed account deletion with cancellation and operational blockers | Auth provider, email delivery, service-role identity deletion, and live lifecycle validation |
| Support | Typed requests, shared references, customer-visible lifecycle, assigned operator updates and aggregate flow metrics | External helpdesk delivery and named staffing |
| Plans & Billing | Stripe checkout, portal and signed status webhooks | Both plan prices, benefits, terms and Stripe setup |
| Admin | Session roles, exact-email operator role management, privacy-safe deletion operations, knowledge/rule drafting and approval, support replies | Initial superadmin bootstrap; full product management UI remains incomplete |
| Company / policies / partners | Existing informational routes | Final legal content and agreements |

Operator access at `/admin/operators` lets an existing superadmin find an account that has completed sign-in and assign only the five supported portal roles. It never creates an account or grants a role from a client-provided identity. The server checks the operator's current role inside the update transaction, prevents self-edits, rejects stale revisions or out-of-band role changes, and records each change with its prior and new roles. A trusted administrator must still provision the first superadmin after verifying that account outside this portal; there is no public bootstrap endpoint.

Portal Support accepts only the five approved request types and records whether a request began in the form or an explicit guidance handoff. Customers see a server-generated reference and the states `open`, `in_review`, `waiting_customer` and `closed`; operator identity and internal source fields are excluded from customer responses. Superadmin and compliance operators can assign a request to themselves by updating it, move it through those states, and add timestamped customer replies. A reply is required when waiting for the customer, resolving, or reopening a request. The operations dashboard reports 30-day aggregate guidance, handoff, intake and update counts without customer questions, ticket text, identifiers or email addresses. These portal records do not establish external delivery or a response-time commitment.

An operator may also mark one fixed internal escalation reason while updating a request: content safety, account/privacy, billing scope, retailer purchase, technical issue, specialist review or other. The reason and assignment stay out of the customer response and account export. The operations dashboard reports aggregate reason counts only; it does not establish named staffing, an external helpdesk handoff, or a response-time commitment.

## Operations worker and backup verification
Compose now runs a separate worker every 60 seconds. It expires sessions and stale rate limits, retains AI-routing logs, notifications, billing activity and run records according to the environment settings, creates one durable replenishment notification per due reminder, and delivers it in-app by default. Set `NOTIFICATION_DELIVERY=webhook` only after configuring an HTTPS endpoint and token; failed deliveries are leased and retried up to three times without duplicate delivery. The worker writes a health heartbeat after each successful run, and its container becomes unhealthy when that heartbeat is stale.

Signed-in users can schedule account deletion with a 30-day cancellation window. The worker pauses a request when it finds active subscriptions, a legacy paid membership, an unfinished order, operator access, a vendor account, or an unsettled hosted-AI charge. When eligible, it deletes the Supabase identity first, then removes portal-owned personal data and sessions in one database transaction. Completed transaction and audit records are retained only in anonymized form, and a non-identifying completion record is kept for operational proof. Retried jobs are leased and tolerate a previously deleted Supabase identity. Live Supabase deletion and organization-specific legal-retention policy still require production validation and counsel review.

Superadmin and compliance operators can inspect a read-only privacy operations panel. It reports queue totals, due and blocked requests, blocker categories, provider readiness and anonymous completion proof without returning account IDs, emails, provider error text, support messages or profile data. Raw deletion records are no longer included in the broad admin response. The general admin response also withholds support, order, partner and job records from non-operations roles and strips actor and target identifiers from audit rows. Anonymous completion proof is retained for 730 days by default through `OPERATIONS_DELETION_PROOF_RETENTION_DAYS`.

Every signature-verified subscription webhook now receives a durable, sanitized receipt before processing. Successful, ignored, duplicate and failed outcomes update that receipt without retaining customer, payment method or subscription payloads. Invalid signatures are never recorded. The operations dashboard shows 24-hour event, delivery, duplicate, failure and stalled-processing counts plus provider event IDs and safe error codes for reconciliation. Receipts are retained for 90 days by default through `OPERATIONS_WEBHOOK_RECEIPT_RETENTION_DAYS`.

The worker does not create database dumps itself: automatic unencrypted database dumps on the app host are not an acceptable production backup design. Use an encrypted, off-host PostgreSQL backup service with a tested restoration procedure. A superadmin or compliance operator records each verified backup through `POST /api/hub/admin/backup/verified` with its completion time, storage identifier and checksum. Future-dated completions are rejected. The worker exposes that proof on `/readyz` and marks it stale after `BACKUP_MAX_AGE_HOURS` (26 by default). Production `/readyz` returns HTTP 503 when the worker or backup is stale, while `/healthz` remains the container liveness probe so operators can still open the portal and correct readiness.

Run `pnpm --filter @mgt/api test:operations` and `pnpm --filter @mgt/api test:readiness` for worker and readiness regression checks. Checkout-request reconciliation, live webhook delivery validation, live identity-deletion validation, a live notification provider and a real restore drill still require environment-specific implementation and validation. No claim of complete production readiness is made.

Validation: API compilation, web build, existing referral suite and new billing suite. Remaining: real Stripe sandbox lifecycle, production PostgreSQL, container startup, browser interactions and deployment.

## Trial and billing-cycle update
New eligible Premium subscriptions use a 14-day free trial with payment_method_collection=always. The first paid billing period begins at trial end. No upfront subscription payment is collected. Trial eligibility is once per signed-in account, based on stored history and Stripe subscription history.

Configure monthly and annual recurring Price IDs with the two named Premium variables listed above. Monthly Prices must recur every month and annual Prices every year, with `interval_count=1`. The approved product prices are $14.99/month and $149.99/year; no Prices have been created in this repository.

The app creates a restricted Stripe billing-portal configuration: cancellations at period end, payment methods and invoices enabled, and paid subscription price changes limited to Premium's configured Prices with Stripe confirmation and prorated invoicing. Trial-cycle changes use a separate authenticated endpoint, leaving trial_end untouched and creating no prorations. Trial subscriptions cannot change Prices through the billing portal because that could end a trial early. During a trial, cancellation ends access at trial end without starting the paid cycle. In a paid period, access remains until the end of that period. Payment failures can still suspend access according to subscription status.

Configure Stripe trial reminder emails and cancellation/renewal notices, publish matching terms, and use Stripe test clocks to validate trial-to-paid transitions, monthly and annual renewals, declines and end-of-period cancellation before launch. These transitions have mocked regression coverage here, not a live Stripe sandbox verification.
### Post-execution review

Build the post-execution review after the execution-review chain is ready:

```text
pnpm infra:release-post-execution-review
```

The review remains `pending_execution_review` until the exact candidate, execution review, and twelve post-execution records are available. It fails closed on changed artifacts, unsafe records, or fabricated readiness.

### Closure review

Build the closure review after post-execution review is ready:

```text
pnpm infra:release-closure-review
```

The review remains `pending_post_execution_review` until the exact candidate and twelve closure records are available.

Build the closure-approval dossier after the closure review is ready:

`pnpm infra:release-closure-approval -- --manifest work/exports/release-export.json --closure-review work/exports/release-closure-review.json --records work/exports/closure-approval-records.json --output work/exports/release-closure-approval.json`

The dossier covers F537–F546 and remains `pending_closure_review` until the closure review is ready. It reaches only `ready_for_release_decision` after ten checksum-bound approval and operations records are present. It does not publish, deploy, change traffic, or prove live production readiness.

Build the release-decision review after the closure-approval dossier is ready:

`pnpm infra:release-decision-review -- --manifest work/exports/release-export.json --closure-approval work/exports/release-closure-approval.json --records work/exports/release-decision-records.json --output work/exports/release-decision-review.json`

The F547–F558 review remains `pending_closure_approval` until the exact approval dossier is ready. It reaches only `ready_for_release_authorization` after twelve checksum-bound decision records are present. It is not a deployment authorization and does not perform or prove a live release.

Build the operator-authorization review after the release-decision review is ready:

`pnpm infra:release-authorization-review -- --manifest work/exports/release-export.json --decision-review work/exports/release-decision-review.json --records work/exports/release-authorization-records.json --output work/exports/release-authorization-review.json`

The F559–F573 review remains `pending_decision_review` until the exact decision review is ready. It reaches only `ready_for_operator_authorization` after fifteen checksum-bound authorization-readiness records are present. It does not issue, execute, or prove a deployment authorization.

Build the execution-request review after the operator-authorization review is ready:

`pnpm infra:release-execution-request-review -- --manifest work/exports/release-export.json --authorization-review work/exports/release-authorization-review.json --records work/exports/release-execution-request-records.json --output work/exports/release-execution-request-review.json`

The F574–F585 review remains `pending_authorization_review` until the exact authorization review is ready. It reaches only `ready_for_execution_request` after twelve checksum-bound scope and safety records are present. It is not an execution command, deployment receipt, or live release proof.

Build the execution-receipt review after the execution-request review is ready:

`pnpm infra:release-execution-receipt-review -- --manifest work/exports/release-export.json --execution-request-review work/exports/release-execution-request-review.json --records work/exports/release-execution-receipt-records.json --output work/exports/release-execution-receipt-review.json`

The F586–F597 review remains `pending_execution_request` until the exact execution-request review is ready. It reaches only `ready_for_execution_receipt` after twelve checksum-bound pre-action records are present. It does not create a receipt, execute a command, or prove a live release.

Build the external-execution intake review after the execution-receipt review is ready:

`pnpm infra:release-execution-intake-review -- --manifest work/exports/release-export.json --execution-receipt-review work/exports/release-execution-receipt-review.json --records work/exports/release-execution-intake-records.json --output work/exports/release-execution-intake-review.json`

The F598–F609 review remains `pending_execution_receipt` until the exact execution-receipt review is ready. It reaches only `ready_for_external_execution_intake` after twelve checksum-bound receipt-schema records are present. It does not create a receipt, execute a command, or prove a live release.

Build the receipt-verification review after the external-execution intake review is ready:

`pnpm infra:release-execution-receipt-verification -- --manifest work/exports/release-export.json --execution-intake-review work/exports/release-execution-intake-review.json --records work/exports/release-receipt-verification-records.json --output work/exports/release-receipt-verification.json`

The F610–F629 review remains `pending_external_execution_intake` until the exact intake review is ready. It reaches only `ready_for_receipt_verification` after twenty checksum-bound verification records are present. It does not accept a receipt, execute a command, or prove a live release by itself.

Build the final-release verification after receipt verification is ready:

`pnpm infra:final-release-verification -- --manifest work/exports/release-export.json --receipt-verification work/exports/release-receipt-verification.json --records work/exports/final-release-verification-records.json --output work/exports/final-release-verification.json`

The F630–F649 review remains `pending_receipt_verification` until the exact receipt verification is ready. It reaches only `ready_for_final_release_review` after twenty checksum-bound production evidence and closure records are present. It does not publish, deploy, or independently prove production readiness.

Build the production-decision review after final-release verification is ready:

`pnpm infra:production-decision-review -- --manifest work/exports/release-export.json --final-release-verification work/exports/final-release-verification.json --records work/exports/production-decision-records.json --output work/exports/production-decision-review.json`

The F650–F669 review remains `pending_final_release_review` until the exact final-release verification is ready. It reaches only `ready_for_production_decision` after twenty checksum-bound decision records are present. It does not deploy, publish, or convert local evidence into a production release.

Build the production launch-readiness review after the production-decision review is ready:

`pnpm infra:production-launch-readiness -- --manifest work/exports/release-export.json --production-decision work/exports/production-decision-review.json --records work/exports/production-launch-records.json --output work/exports/production-launch-readiness.json`

The F670–F689 review remains `pending_production_decision` until the exact production-decision review is ready. It reaches only `ready_for_launch_window` after twenty checksum-bound launch controls are present. It does not deploy, publish, or change traffic.

Build the launch-execution review after launch readiness is ready:

`pnpm infra:production-launch-execution-review -- --manifest work/exports/release-export.json --launch-readiness work/exports/production-launch-readiness.json --records work/exports/launch-execution-records.json --output work/exports/launch-execution-review.json`

The F690–F719 review remains `pending_launch_window` until the exact launch-readiness review is ready. It reaches only `ready_for_launch_execution_review` after thirty checksum-bound pre-execution controls are present. It does not execute commands, deploy, publish, or change traffic.

Build the launch-observation review after launch-execution review is ready:

`pnpm infra:production-launch-observation-review -- --manifest work/exports/release-export.json --launch-execution work/exports/launch-execution-review.json --records work/exports/launch-observation-records.json --output work/exports/launch-observation-review.json`

The F720–F754 review remains `pending_launch_execution_review` until the exact launch-execution review is ready. It reaches only `ready_for_launch_observation` after thirty-five checksum-bound supervised-launch controls are present. It does not execute, deploy, publish, or change traffic.

Build the post-launch monitoring review after launch observation is ready:

`pnpm infra:post-launch-monitoring-review -- --manifest work/exports/release-export.json --launch-observation work/exports/launch-observation-review.json --records work/exports/post-launch-monitoring-records.json --output work/exports/post-launch-monitoring-review.json`

The F755–F764 review remains `pending_launch_observation` until the exact launch-observation review is ready. It reaches only `ready_for_post_launch_review` after the 15-minute, one-hour, 24-hour, seven-day, error, latency, support, backup, incident, and closure-hold records are present. It does not prove that a production launch occurred.

Build the production stabilization review after post-launch monitoring is ready:

`pnpm infra:production-stabilization-review -- --manifest work/exports/release-export.json --post-launch-monitoring work/exports/post-launch-monitoring-review.json --records work/exports/production-stabilization-records.json --output work/exports/production-stabilization-review.json`

The F765–F779 review remains `pending_post_launch_review` until the exact post-launch monitoring review is ready. It reaches only `ready_for_production_stabilization_review` after sustained observation windows, SLO, support, backup, rollback, customer-impact, billing-integrity, privacy-access, and final-closure records are present. It does not deploy, publish, change traffic, or convert local records into live production proof.

Build the production closeout review after stabilization is ready:

`pnpm infra:production-closeout-review -- --manifest work/exports/release-export.json --production-stabilization work/exports/production-stabilization-review.json --records work/exports/production-closeout-records.json --output work/exports/production-closeout-review.json`

The F780–F799 review remains `pending_production_stabilization_review` until the exact stabilization review is ready. It reaches only `ready_for_production_closeout_review` after final endpoint, data, security, billing, support, accessibility, privacy, monitoring, rollback, and owner-attestation records are present. It does not deploy, publish, change traffic, or convert local records into live production proof.

Build the production reconciliation review after closeout is ready:

`pnpm infra:production-reconciliation-review -- --manifest work/exports/release-export.json --production-closeout work/exports/production-closeout-review.json --records work/exports/production-reconciliation-records.json --output work/exports/production-reconciliation-review.json`

The F800–F814 review remains `pending_production_closeout_review` until the exact closeout review is ready. It reaches only `ready_for_production_reconciliation` after GitHub/Drive receipt, candidate, staging, target, image, ownership, accessibility, backup, billing, monitoring, rollback, and final reconciliation records are present. It does not deploy, publish, change traffic, or convert local records into live production proof.

The F815 prerequisite packet can be generated with `pnpm infra:production-prerequisites -- --candidate-commit <sha> --output work/production/prerequisites.json`. It validates the production-shaped environment without writing secret values and separates local configuration blockers from required live evidence and approvals.

The F816–F825 prerequisite review can be generated with `pnpm infra:production-prerequisite-review -- --prerequisites work/production/prerequisites.json --output work/production/prerequisite-review.json`. It binds ten external prerequisite records and remains pending until live evidence is supplied.

The F826–F850 environment review can be generated with `pnpm infra:production-environment-review -- --prerequisite-review work/production/prerequisite-review.json --output work/production/environment-review.json`. It binds twenty-five production runtime fields and remains pending until the prerequisite review is ready.

The F851–F950 evidence matrix can be generated with `pnpm infra:production-evidence-matrix-review -- --environment-review work/production/environment-review.json --output work/production/evidence-matrix-review.json`. It binds 100 records across the production evidence surface and remains fail-closed until live evidence exists.

The F951–F975 reconciliation review can be generated with `pnpm infra:production-evidence-reconciliation-review -- --evidence-matrix work/production/evidence-matrix-review.json --output work/production/reconciliation-review.json`. It cross-checks 25 continuity, ownership, artifact, rollback, launch, and destination-receipt records.

The F976–F1010 launch-readiness review can be generated with `pnpm infra:production-launch-readiness-review -- --reconciliation-review work/production/reconciliation-review.json --output work/production/launch-readiness-review.json`. It binds 35 final production launch records and remains fail-closed until reconciliation and live evidence are ready.

Build the production authorization review after reconciliation is ready:

`pnpm infra:production-authorization-review -- --manifest work/exports/release-export.json --production-reconciliation work/exports/production-reconciliation-review.json --records work/exports/production-authorization-records.json --output work/exports/production-authorization-review.json`

The F815–F839 review remains `pending_production_reconciliation` until the exact reconciliation review is ready. It reaches only `ready_for_production_authorization` after scope, window, freeze, infrastructure, data, support, accessibility, privacy, optional provider, monitoring, rollback, incident, communication, and final go/no-go records are present. It does not deploy, publish, change traffic, or convert local records into live production proof.

Build the production execution-readiness review after authorization is ready:

`pnpm infra:production-execution-readiness-review -- --manifest work/exports/release-export.json --production-authorization work/exports/production-authorization-review.json --records work/exports/production-execution-readiness-records.json --output work/exports/production-execution-readiness-review.json`

The F840–F864 review remains `pending_production_authorization` until the exact authorization review is ready. It reaches only `ready_for_production_execution` after operator, approval, session, window, candidate, artifact, host, edge, secret-store, database, migration, backup, rollback, monitoring, support, communication, optional provider, stop-criteria, and execution-hold records are present. It does not execute, deploy, publish, change traffic, or convert local records into live production proof.

Build the production execution review after execution readiness is ready:

`pnpm infra:production-execution-review -- --manifest work/exports/release-export.json --production-execution-readiness work/exports/production-execution-readiness-review.json --records work/exports/production-execution-records.json --output work/exports/production-execution-review.json`

The F865–F889 review remains `pending_production_execution` until the exact execution-readiness review is ready. It reaches only `ready_for_production_execution_review` after operator, timestamp, scope, target, candidate, artifact, image, deployment, migration, backup, health, readiness, route, auth, database, RLS, worker, support, optional provider, monitoring, alert, rollback-watch, and execution-hold records are present. It does not execute, deploy, publish, change traffic, or convert local records into live production proof.

Build the production execution-receipt review after execution review is ready:

`pnpm infra:production-execution-receipt-review -- --manifest work/exports/release-export.json --production-execution work/exports/production-execution-review.json --records work/exports/production-execution-receipt-records.json --output work/exports/production-execution-receipt-review.json`

The F890–F914 review remains `pending_production_execution_review` until the exact execution review is ready. It reaches only `ready_for_production_execution_receipt` after operator, timestamp, scope, target, candidate, artifact, image, deployment, migration, backup, health, readiness, route, auth, database, RLS, worker, support, optional provider, monitoring, alert, rollback, and final receipt-hold records are present. It does not execute, deploy, publish, change traffic, or fabricate a live receipt.

Build the production receipt-verification review after execution receipts are ready:

`pnpm infra:production-receipt-verification-review -- --manifest work/exports/release-export.json --production-execution-receipt work/exports/production-execution-receipt-review.json --records work/exports/production-receipt-verification-records.json --output work/exports/production-receipt-verification-review.json`

The F915–F949 review remains `pending_production_execution_receipt` until the exact execution-receipt review is ready. It reaches only `ready_for_production_receipt_verification` after receipt integrity and freshness, operator, execution, candidate, artifact, infrastructure, route, data, support, optional provider, monitoring, rollback, audit, communication, accessibility, privacy, and final-hold records are present. It does not execute, deploy, publish, change traffic, or fabricate live evidence.

The remaining build is aligned to [`PRODUCTION-SHIP-PLAN-ALIGNMENT.md`](../../PRODUCTION-SHIP-PLAN-ALIGNMENT.md), which incorporates the linked Production Ship Todo Plan across scope/economics, ownership, hosting, secrets, database, backups, catalog, accessibility, support, billing, AI, notifications, staging, production evidence, launch decisions, supervised execution, observation, and closure. The alignment document is a checklist and evidence map; it does not replace live verification or production approval.

