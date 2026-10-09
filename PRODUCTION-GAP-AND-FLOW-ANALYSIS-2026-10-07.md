# MGT Skin Care v2 — Production Gap and Flow Analysis

Date: 2026-10-07
Owner: Gregg Clark
Candidate branch: `codex/reconcile-main-2026-09-20`

## Executive result

The repository implements the complete local application foundation for the initial production scope: referral-first product discovery, Free and Premium portal access, customer identity and privacy controls, Skin Match and routine generation, bounded guidance, support operations, subscription billing, background operations, immutable deployment images, and checksum-bound release evidence.

The application is not yet production-ready because the remaining blockers require real accounts, infrastructure, approved content, deployed services, or human sign-off. Repository code must not manufacture those facts. The correct next transition is from locally verified candidate to an isolated staging environment.

## Scope correction completed

The static demo previously displayed three paid tiers—Essential, Guided, and Studio—that were not implemented in the billing backend. The canonical product model is now represented consistently:

- Free is the non-billable baseline.
- Premium is the only paid MGT consumer membership.
- Premium has one Stripe Product with one monthly and one annual Price.
- Product purchases remain on external retailer sites.
- Entitlements change only after a verified subscription webhook.
- Vendor payouts, connected accounts, product checkout, and photo analysis remain deferred.

## End-to-end flow review

### 1. Customer profile and routine

`Browser session → consent → validated Skin Match answers → revision lock → deterministic match → saved profile → AM/PM routine`

Implemented controls: isolated guest sessions, CSRF and exact-origin checks, rate limits, bounded inputs, optimistic revision checks, explicit guest/account merge decisions, profile removal, account export, and 30-day deletion recovery.

Remaining live evidence: Supabase email delivery, two-account isolation, production RLS, concurrent writes, identity deletion, and retention validation.

### 2. Guidance and safety

`Question → deterministic policy screen → medical/payment/privacy routing → consent and entitlement gate → approved knowledge or bounded model → schema/claim validation → answer or support handoff`

Implemented controls: medical and urgent escalation, prompt-injection cases, reviewed-source citations, disclosure consent, provider budgets, reservation/reconciliation, fallback routing, and aggregate privacy-safe metrics.

Remaining live evidence: approved catalog/knowledge review, model inventory, latency/error limits, hosted-provider billing reconciliation, and SME/privacy acceptance of the golden set.

### 3. Referral discovery

`Retail edit → allowlisted destination → aggregate outbound metric → external retailer`

Implemented controls: HTTPS retailer allowlist, no query-string profile leakage, saved retailer isolation, segment validation, explicit vendor-of-record boundary, and blocked MGT product checkout routes.

Remaining live evidence: destination ownership, regional availability, commercial terms, disclosure wording, and freshness process.

### 4. Premium subscription

`Signed-in account → approved Free/Premium comparison → recurring-consent confirmation → Stripe Checkout → pending local request → signed webhook → subscription record → entitlement`

Implemented controls: one Premium Product, monthly/annual Price validation, test/live mode matching, signed raw-body webhook verification, duplicate/replay safety, customer and metadata ownership checks, trial reuse protection, billing portal, cancellation/resumption commands, and webhook-authoritative access.

Remaining live evidence: Stripe sandbox Product and Prices, webhook endpoint, test-clock renewals, decline/cancellation cases, published terms, support ownership, and explicit enablement decision.

### 5. Support and privacy operations

`Guided handoff or form → durable request → operator assignment/escalation → customer-visible reply → resolution`

`Deletion request → recovery window → blocker scan → identity deletion → portal erasure/anonymization → completion proof`

Implemented controls: approved request categories, safe customer projection, operator RBAC, escalation reasons, audit trail, reply validation, deletion leases, subscription/order/AI blockers, identity-first deletion, and anonymized retained records.

Remaining live evidence: named support rota, response targets, external delivery if selected, privacy retention approval, and staged deletion transcript.

### 6. Runtime, recovery, and release

`Commit → verification → immutable API/web images → provenance/SBOM → isolated staging → migrations → health/readiness → browser journeys → owner approval → production window → monitored release → closeout`

Implemented controls: production-only PostgreSQL, separate reviewed migrations, read-only containers, dropped capabilities, HTTPS edge headers, same-origin API routing, worker leases, fresh-heartbeat readiness, backup/restore readiness, exact action commit pins, image digest enforcement, artifact manifests, checksums, receipts, rollback records, and fail-closed release gates.

Remaining live evidence: approved host/domain, secret manager, immutable base-image digests, database targets, migration/RLS transcript, encrypted off-host backup restore, monitoring and alerts, deployed accessibility results, rollback rehearsal, and final go/no-go approval.

## Backend restructure implemented in this candidate

The operator readiness API now groups checks into five actionable backend phases instead of returning one undifferentiated list:

1. Data and identity
2. Operations and recovery
3. AI and quality
4. Billing and commercial
5. Support and accessibility

Each phase returns `ready` or `blocked`, a ready/total count, and sanitized blocker names. Checks distinguish configuration evidence from runtime evidence. The operator portal renders this phase view and retains the detailed checklist for diagnosis. No secret value, customer identifier, provider payload, or private evidence URL is returned.

The subsequent v2.12 control-plane increment adds an aggregate operations-health endpoint and portal panel. It identifies notification delivery failures and queue aging, due or blocked deletion work, overdue support requests, recent worker delivery failures, and failed or stalled signed subscription events. Production preflight now also requires a non-secret dashboard reference, incident runbook, accountable alert owner, and bounded support response target. These controls expose only aggregate counts and sanitized alert codes; live monitoring evidence is still required before production approval.

The v2.13 alert-delivery increment connects that aggregate state to a dedicated operations webhook. The worker delivers only sanitized alert codes and counts, suppresses repeats with a durable fingerprint, records delivery outcome, and emits a single recovery event after the alert set clears. Production configuration now requires an HTTPS destination and server-side token; live receipt and escalation evidence remain external launch gates.

The v2.14 delivery-assurance increment adds a timestamped HMAC signature (`x-mgt-signature`) to each alert payload, a bounded delivery timeout, and retained sanitized delivery-event history. Receiving services should reject stale timestamps and validate the signature against the raw request body before processing. The administrator view exposes only delivery status and aggregate alert codes, never the token, payload detail, customer information, or endpoint location.

The v2.15 operational-resilience increment adds a bounded retry cooldown, classified delivery outcomes, monotonic attempt counts, and a compliance-restricted alert-history endpoint. Failure details are deliberately reduced to safe categories (`delivery_rejected` or `delivery_unavailable`) before durable storage. This allows operators to prove alert-flow behavior and investigate timing without storing gateway responses, endpoint details, or sensitive customer context.

The v2.16 receiver-contract increment provides a stable delivery ID across retries, an explicit attempt number, and a reusable signature verifier. Receiver implementations must deduplicate on `x-mgt-delivery-id`, verify the HMAC of `timestamp.rawBody`, and reject messages outside their configured replay window. Retries keep the same delivery ID while their audit entries remain distinct, allowing safe at-least-once transport without duplicate incident creation.

The v2.17 terminal-delivery increment adds an explicit signature version, non-secret key identifier, bounded payload size, strict request-shape verification, and a finite retry policy. Permanent client rejections stop immediately; transient failures stop after the configured maximum and are recorded as `abandoned`, never retried silently forever. Receiver authentication now relies on the signed body rather than repeating the shared secret in an Authorization header.

The v2.18 recovery-timing increment adds an independently verifiable payload digest and bounded exponential retry delay. Each transient failure persists its next retry time and delay without recording sensitive transport details. Receivers must validate both the digest and signature before parsing JSON; operators can distinguish a waiting retry from a terminal handoff without accessing endpoint or token data.

The v2.19 receiver-backoff increment honors valid `Retry-After` guidance from an alert receiver while retaining a local exponential floor and a strict configured ceiling. Rate limits and temporary service responses remain retryable; permanent client responses are terminal. Only sanitized outcome categories and the resulting schedule are retained, so an operator can understand recovery behavior without storing remote response bodies or infrastructure details.

The v2.20 multi-worker increment adds a durable alert-send lease. A worker claims an incident state before network delivery, so concurrent workers cannot create parallel alert sends. If a process stops after claiming the lease, the next worker safely resumes once the short lease expires using the same delivery ID. The operations health view exposes only the lease deadline, not any endpoint or credential.

The v2.21 fenced-lease increment prevents a late worker from overwriting a newer delivery attempt after a lease expires. Each claim receives a unique fencing token; only the still-current token can finalize alert state. A late success or failure is retained only as a sanitized `superseded` audit event, preserving receiver idempotency and the newest worker's authoritative outcome.

The v2.22 delivery-fencing increment applies the same protection to customer reminder delivery. If a reminder lease expires during a slow provider call, the replacement attempt is authoritative and the late worker becomes a no-op. This keeps retry state, delivery counts, and the notification record consistent without recording provider details.

The v2.23 customer-notification boundary increment removes internal lease and claim fields from the customer notification response, records only bounded delivery outcome codes instead of adapter error text, and sends a stable notification identifier plus attempt number to webhook receivers. Receivers can deduplicate a slow/late reminder retry without receiving worker coordination details; customer responses expose only the notification state and reminder payload.

The v2.24 account-deletion execution increment assigns a fresh claim ID to each leased deletion attempt and requires that claim for both successful erasure and failure recovery. A late worker can no longer reset or finalize a newer deletion attempt; the control is covered by a concurrent-worker regression and does not claim live provider completion.

The v2.25 account-deletion boundary increment retains only a bounded identity failure code and projects deletion requests without account identifiers, leases, claims, or adapter details. Session, export, and request responses preserve customer-visible progress and a generic service-failure indicator while preventing provider diagnostic text from crossing the API boundary.

The v2.26 customer-notification webhook increment replaces bearer-token replay exposure with a signed, replay-bounded v1 envelope. Each receiver request carries a non-secret key identifier, content digest, timestamp, stable notification ID, and attempt number; verification binds every header to the exact body without serializing the shared secret.

The v2.27 release-contract increment brings production preflight into parity with the signed notification runtime: an invalid notification webhook key identifier is rejected before deployment, while an omitted key continues to use the documented `primary` default.

The v2.28 customer-notification delivery increment adds bounded exponential retry scheduling. Retryable failures honor a receiver `Retry-After` value, permanent client rejections stop immediately, and a configured maximum prevents repeated worker sweeps from generating uncontrolled delivery attempts. Retry state stays internal and customer responses remain limited to notification status.

The v2.29 release-contract increment validates the customer-notification retry policy before deployment. Cooldown, maximum delay, and attempt count must be bounded whole numbers, and the maximum delay cannot be lower than the initial cooldown; invalid settings can no longer silently fall back at runtime.

The v2.30 notification-delivery increment makes the customer webhook timeout an explicit bounded deployment setting. Runtime and preflight now reject invalid timeout values rather than silently applying a default, while retaining a documented ten-second default for an omitted value.

The v2.31 ownership-contract increment assigns Gregg Clark of MGT as the accountable owner and named approver in generated release, staging, and production templates. Role-specific evidence and explicit pending/go/hold decisions remain fail-closed; the ownership declaration is not an approval by itself.

The v2.32 evidence-integrity increment hashes the complete nested prerequisite document, rejects incomplete or altered reviews before reading artifacts, and binds release approvals and production decisions to their declared role owners. Gregg Clark of MGT remains the shared default owner. Generated prerequisites no longer claim unexecuted build/test results, and examples remain pending. The regression suite includes 100 nested-evidence mutation cases. Existing prerequisite documents and dependent reviews must be regenerated; see [the migration and ownership procedure](infra/portal/OWNERSHIP-AND-EVIDENCE-PROCEDURE.md). These checks do not replace live evidence or grant production approval.

## Remaining gap register

The v2.34 staging-window increment upgrades authorization summaries to schema 1.1 and revalidates each separate approval's decision, owner, handoff binding, issuance freshness and exact shared window. Strict UTC timestamps reject coercion and impossible dates. Execution receipts now require valid pending authorization and use start-inclusive/end-exclusive windows; late historical audit remains valid without authorizing another execution. One hundred timestamp mutation tests plus boundary and binding tests cover these paths. Old authorizations require regeneration from actual new approvals, not relabeling. Authenticated signing, trusted policy enforcement, atomic consumption, live deployment and remote publication remain unimplemented/unperformed by this increment.

The v2.33 canonical-ownership increment requires the exact owner name Gregg Clark of MGT in production preflight, ship-packet owners/approvers/reviewers/monitoring, staging ledger and promotion approvals, pending staging authorization summaries, and production gate owners/approvers/decider. All preflight failures now block release readiness, including errors outside the old phase-prefix lists. One hundred owner-mutation regression cases cover missing, altered, and non-string values. This does not authenticate a human, grant approval, or implement the architecture's cloud executor or persistent ledger; those remain separate work.

| Priority | Gap | Repository state | Required exit evidence |
| --- | --- | --- | --- |
| P0 | Staging/production target | Contracts complete | Approved host, domain, secret manager, deployment identity, redacted preflight |
| P0 | Database and identity | Migrations/RLS/audit contracts complete | Applied migration transcript, structural audit, two-account RLS test, identity lifecycle |
| P0 | Backup and restore | Worker and proof contract complete | Encrypted off-host backup plus isolated restore checksum and duration |
| P0 | Catalog and knowledge | Draft/approval workflow complete | Approved non-sample catalog, slot coverage, ingredient rules, reviewed sources |
| P0 | Release images | GHCR workflow implemented | Successful current-candidate image build, digests, attestations, SBOMs |
| P1 | Stripe subscription | Backend and UI complete, disabled | Sandbox Product/Prices, signed webhook suite, terms, support, enablement approval |
| P1 | AI services | Routing/budget/safety complete | Approved model inventory, latency/error report, billing reconciliation, SME sign-off |
| P1 | Support operations | Portal queue complete | Named rota, incident route, response targets, external delivery test if enabled |
| P1 | Accessibility/browser | Local contracts complete | Deployed keyboard, screen-reader, zoom, mobile, and contrast evidence |
| P1 | Monitoring/rollback | Preflight, aggregate control plane, and evidence contracts complete | Live dashboard and alert proof, rehearsal, previous image target, first-hour owner |

## Execution allocation and realistic proxy dates

These are planning ranges from the current candidate, not promises. They assume one accountable owner can provision accounts and approve content without procurement delay.

| Workstream | Active engineering/operations effort | Earliest evidence window |
| --- | ---: | --- |
| Candidate verification and image publication | 2–4 compute hours | 2026-10-07 to 2026-10-08 |
| Staging host, secrets, database, migrations, identity | 1–2 working days | 2026-10-08 to 2026-10-09 |
| RLS, backup/restore, worker, monitoring | 1–2 working days | 2026-10-09 to 2026-10-12 |
| Catalog/knowledge approval and AI qualification | 2–5 working days | 2026-10-09 to 2026-10-15 |
| Stripe sandbox and subscription lifecycle | 1–2 working days after account inputs | 2026-10-12 to 2026-10-14 |
| Browser/accessibility and rollback rehearsal | 1–2 working days | 2026-10-14 to 2026-10-16 |
| Go/no-go review and controlled production window | 0.5–1 working day | Earliest 2026-10-16 |

Account provisioning, legal terms, SME review, partner agreements, or security approvals can move the production date. Compute cannot substitute for those decisions.

## Production decision

Current decision: **NOT READY FOR PRODUCTION TRAFFIC**.

Current safe state: **READY FOR CURRENT-CANDIDATE CI AND ISOLATED STAGING SETUP**, subject to successful publication of this exact commit and preservation of the existing fail-closed controls.
