# MGT Skin Care v2 — Next-Phase Implementation Plan

**Version:** 4.2
**Revision date:** 2026-09-25
**Planning baseline:** `codex/reconcile-main-2026-09-20`; latest portal, accessibility, and provisional subscription phases verified locally
**Status:** Assistant and Support foundations, privacy-safe measurement, customer/operator accessibility phases, and the Path B single-Premium subscription consolidation are locally implemented; production remains **NOT READY**.

## 1. Purpose and decision boundary

This plan defines the next work around the verified MGT Skin Care v2 referral portal. It uses [`mgt-skincare-ai-infra-migration-v2.md`](mgt-skincare-ai-infra-migration-v2.md), [`SkincareAIPlatformBlueprint.md`](SkincareAIPlatformBlueprint.md), `CURRENT-SCOPE.md`, `BUILD-READINESS-GUIDE.md`, `business/OPERATING-MODEL-AND-GTM.md`, the AI task registry, and the latest local release checkpoint.

The current product boundary remains external referral. MGT does not collect a shopper's retailer purchase amount, create a retailer receipt, fulfill products, or handle retailer refunds. Existing checkout and commerce modules are retained behind server-side blocks. Subscription billing scaffolding is separate, disabled by default, and does not make product checkout active. The Phase A build adds a bounded server-side assistant route, integration coverage, and a guidance panel within the existing Support page. It does not enable a payment provider, create a live campaign, turn on OpenClaw, or change the logo or shared page layout.

Use these status labels in implementation and reporting:

- **Implemented / locally verified:** present in this branch and supported by local tests or checkpoint evidence.
- **Repository-ready:** can be developed and verified locally without external credentials, live users, or production data.
- **Environment-dependent:** requires a selected service, configuration, credentials, staging data, or operator provisioning.
- **Blocked / decision required:** conflicts with the current product boundary or lacks required business, legal, vendor, or product approval.
- **Planned:** a proposal only; do not describe as shipped.

## 2. Reconciled baseline

| Area | Verified state | Boundary for next phase |
|---|---|---|
| Product | Skin-match, routine, coach, learning, saved retailers, support and operations journeys are present in the local portal. The shop links to six independent external storefronts. | Keep the referral journey and established brand/layout stable. Retail purchase support remains with each retailer. |
| AI | The gateway has typed tasks, local-first routing, hosted entitlement checks, budget reservations, response validation and telemetry. The new assistant route sends only signed-in, consented routine/product questions to the existing reviewed Coach path. | Do not add a public model selector or promise model availability. OpenClaw remains disabled until the target runtime is verified. |
| Customer support | Portal support requests and operator replies exist. The new Support-page panel uses deterministic onboarding, support, account, retailer and payment handoffs without sending a message or creating a ticket. | AI may explain reviewed skincare content; it must not impersonate staff, confirm charges, resolve refunds, or take irreversible account/payment actions. Live support delivery remains planned. |
| Payments | Local tests cover billing/subscription behavior with a mocked Stripe client. Subscriptions are gated by `SUBSCRIPTIONS_ENABLED`, approved terms, prices, Stripe settings and signed webhooks. Product checkout is blocked under the current external-referral decision. | Distinguish subscription status/activity from a payment receipt. Retailer receipts and confirmations belong to the retailer. No payment collection until a separate business decision changes scope. |
| GTM | An external-retailer operating model and GTM plan exists. Audience and positioning are hypotheses; no active partner contract, fee schedule, attribution or performance baseline is documented. | Start with low-cost learning and trust measures. Paid budgets, affiliate claims and profit forecasts require real margin and attribution evidence. |
| Release | The 2026-09-23 checkpoint reports all seven local gates passed. Production is **NOT READY** because `infra/portal/.env` is absent and live service checks remain open. | Local pass status does not establish production readiness. |

## 3. Phased implementation sequence

### Phase A — lock task boundaries and agent behavior (Critical; repository-ready)

**Goal:** translate current `coach`, `support`, `shopping_assistant` and intent-routing capabilities into explicit assistant roles without changing the existing interface.

1. Define role contracts for customer care, new-user onboarding, routine guidance and product/referral education. Reuse existing API and task contracts where possible; present role choice only as internal routing policy unless a UX change is separately requested.
2. Keep all routine edits deterministic. An agent can explain or propose a routine change, but the existing domain engine and user confirmation own any mutation. Agents cannot submit orders, claim a retailer purchase succeeded, change billing, issue refunds, alter account roles, or make medical diagnoses.
3. Ground product and ingredient answers in approved knowledge/catalog records. Return citations or source identifiers where the task schema supports them; if approved data is absent or stale, state the limitation and route to human support.
4. Establish escalation rules: deterministic checks first; local Ollama for bounded narrative/classification; DeepSeek for local reasoning fallback; OpenClaw only after runtime qualification; hosted OpenAI only for tasks already configured for it, with consent/entitlement, budget reservation and validated response. Do not add hosted fallback to vision.
5. Add sanitized escalation/handoff states to support operations; do not send a message to staff or a customer without an explicit product delivery path and consent.
6. Add reviewed cases for onboarding, account help, product/referral questions, missing sources, uncertain answers, sensitive skin concerns, adverse reactions, privacy requests, and payment questions. Extend the existing golden set only after human review criteria are recorded.

**OpenClaw qualification gate:** keep `OPENCLAW_ENABLED=false`; validate the approved immutable runtime, native Ollama `/api/chat` compatibility, model synchronization, tool allowlist, network isolation, timeouts, prompt-injection handling, content boundaries, data retention, redaction, fallback behavior and cost/latency. Begin with a no-tools, read-only assistant. Agent tools, external actions and customer-facing rollout require separate scoped approval and a staging review.

**Exit evidence:** role/task map, reviewed policy cases, local adapter and fallback report, privacy-safe telemetry review, and a decision record for enabling OpenClaw in a non-production staging environment.

**Phase A checkpoint:** Commit `8444aa7` adds `POST /api/hub/assistant` with explicit customer-care, onboarding, routine-guidance and product/referral roles. Safety, account, payment and retailer questions receive deterministic guidance or a handoff path without a provider or payment call. Routine/product education uses the existing reviewed Coach only after sign-in and explicit AI consent, with the existing rate, entitlement, budget and source controls. The API build, focused portal/Coach checks, and full local verification passed; evidence is `work/verification/2026-09-23T01-18-44-476Z/report.md`. This is an API foundation; it does not send support messages, expose an assistant in the current UI, enable OpenClaw, or validate live providers.

**Support-page checkpoint:** Commit `518274b` adds a small guidance panel to `/support` using existing MGT components and the unchanged logo. It shows the server's next step and reviewed citations, distinguishes guidance from a saved support request, and permits deterministic retailer directions without an AI account or consent. A general “How do I get started?” question now routes to onboarding guidance. API compilation, portal integration checks, web production build, 28-page proxy journey, and browser checks of onboarding and retailer flows passed. The build still does not create tickets from guidance, enable OpenClaw, send external support messages, or verify live providers.

**Policy and fallback checkpoint:** Commit `08c9ca4` adds 18 engineering candidate cases covering all four roles, mixed retailer/payment questions, privacy and account requests, adverse and urgent reactions, and prompt injection. The tests exercise the API boundary and verify deterministic cases make no AI or payment-provider call. The assistant now returns a support handoff when approved knowledge, configuration, or a verified model answer is unavailable; it still requires sign-in and consent before a reviewed answer. The cases are **not SME-approved content**. Full local verification passed at `work/verification/2026-09-23T01-51-10-062Z/report.md`. Urgent symptom wording was checked against [NHS anaphylaxis guidance](https://www.nhs.uk/conditions/anaphylaxis/); clinical review remains a release gate.

**Support accessibility checkpoint:** Commit `f075a43` keeps the existing MGT Support layout and moves keyboard focus to a new guidance answer or error. The Support handoff moves focus to the labeled request form and does not submit it. The form exposes its busy state. Web production build and the 28-page proxy journey passed; a focused browser accessibility-tree and interaction check confirmed answer, handoff, and sign-in error focus. A full screen-reader, keyboard, mobile, contrast, and WCAG audit remains open.

### Phase B — onboarding, care and human support (High; repository-ready, delivery environment-dependent)

1. Use existing onboarding/account routes and approved learn content to explain how profiles, consent, skin-match and saved retailers work. Collect only the inputs needed for the selected journey.
2. Keep AI consent explicit before processing free-text coach input. Make it clear that answers are educational product guidance, not diagnosis or treatment.
3. Provide a clear handoff when the source is missing, the response fails validation, the customer reports a reaction, or the question concerns an order/payment handled by an external retailer.
4. Keep support tickets and admin replies as the system-of-record path until an approved helpdesk/email integration is configured. Do not imply an AI draft was sent or a human case was received until delivery is confirmed.
5. If email or webhook delivery is later selected, use explicit channel consent, verified sender/domain, unsubscribe and suppression controls for marketing, retries with deduplication for transactional events, and sanitized delivery status.

**Exit evidence:** onboarding/support acceptance cases, accessible handoff states, authenticated role checks, delivery receipts for any configured service, and a clear path to a human operator.

**Support handoff draft checkpoint:** The existing Support page now lets a user explicitly copy a submitted guidance question into the portal request form for review. Later edits to the question are not silently copied, an existing request draft is not overwritten, and no ticket is saved until the user selects Save request. Focus moves to Subject so the user can complete the request. The browser flow and local release gate passed; external delivery and named support ownership remain open.

**Request-reference checkpoint:** Saving a Portal Support request now returns its server-generated reference, save time and initial status. The confirmation and customer history display that reference, and authorized operators see the same reference in their request view. A local browser save confirmed the receipt matches the list; the portal integration test verifies server authority and customer isolation. The full local gate passed at `work/verification/2026-09-23T15-54-31-331Z/report.md`. This is a portal record, not proof of external delivery or a committed response time. Named ownership, triage states and live delivery remain open.

**Phase B1 — typed intake checkpoint:** Portal Support now accepts five server-validated request types and one of two approved sources: the direct form or an explicit guidance handoff. The selected type is visible in customer history and the operations view. Client-provided unknown categories and sources are rejected, and the customer response excludes actor, email, internal assignment and intake-source fields.

**Phase B2 — lifecycle and assignment checkpoint:** Authorized superadmin and compliance operators can move a request through open, in-review, waiting-for-customer and resolved states. Updating a request assigns it to that operator, records the update time and first response, and adds a timestamped customer reply when supplied. A customer-facing reply is required for waiting, resolved and reopened transitions. Customers see the new state and replies without receiving operator identity.

**Phase D1 — privacy-safe Support measurement checkpoint:** The analytics registry now classifies four Support events as aggregate-only. The server records daily counters for guidance requests, Support handoffs, saved request types/sources and operator updates; the operations panel shows 30-day totals and category counts. It does not retain question text, ticket messages, email addresses, account IDs or operator IDs in these metrics. Focused API, authorization, assistant-policy, analytics-contract, production web build and browser intake checks passed. Full-gate evidence is recorded with the matching release checkpoint.

### Phase C — payment confirmations and records (Critical before enabling any MGT billing; blocked for retailer purchases)

| Capability | Current status | Planned handling |
|---|---|---|
| Retailer product purchase confirmation | **Not implemented by MGT; intentionally outside current scope.** | The retailer is merchant of record and sends its own confirmation, invoice and receipt. MGT may link users to retailer support but must not fabricate purchase status. |
| MGT product checkout, order receipt, refund or fulfillment | **Blocked by current scope and API boundary.** Legacy paths remain gated. | Keep disabled unless the user separately approves a commerce model, vendor agreements, legal terms, tax/shipping operations, support ownership, database reconciliation and provider plan. |
| Premium subscription checkout | **One locked consumer Premium offer is locally tested with a mocked Stripe client; enrollment is disabled by default.** Partner billing and connected-account operations are deferred. | Before any launch, provision the approved $14.99 monthly and $149.99 annual Prices, approve trial/cancellation/refund language and support ownership, then validate signed sandbox webhook reconciliation and entitlement behavior. |
| Subscription status and webhook records | **Local implementation exists.** Activity and sanitized webhook receipt operations are not a customer payment receipt. | Derive confirmed status only from verified provider events. Treat browser return URLs as navigation, not proof of payment. Show only minimal status to the signed-in owner; provide the payment provider's invoice/receipt portal where available. |
| Confirmation email or SMS | **No live delivery path verified.** | Choose a transactional provider, sender identity and recipient policy. Send only after authoritative signed-event confirmation, with idempotency, retry, suppression, redaction and auditable delivery outcome. |

Required implementation controls if subscription confirmations are approved: one confirmation per provider event/transaction, idempotent event handling, server-side ownership verification, currency/amount/plan identity from provider data, UTC timestamps, provider reference, privacy-minimized record, correction/refund status where applicable, customer-readable support route, operator view limited by role, retention schedule, and reconciliation for delayed/duplicate/failed events. Never expose full payment credentials or sensitive provider payloads to the customer portal or AI context.

**Path B Premium consolidation checkpoint:**

1. The server-owned catalog now exposes exactly one consumer Premium offer, with monthly and annual Stripe Price configuration only.
2. Membership no longer performs plan or audience selection. It preserves the existing shell, displays the Premium details, and cannot start enrollment by review alone.
3. Checkout, trial cycle changes, the billing portal, webhook reconciliation, activity history, data export, and v1 subscription records are consumer-Premium only. Price configuration is fail-closed unless both approved Price IDs are present.
4. Partner onboarding, connected-account payout, and partner approval endpoints are hard-deferred. The product retailer referral boundary remains unchanged.
5. AI disclosure consent is versioned, timestamped, exportable, and revocable. The additive database migration adds consent controls and append-only protections for the existing write-once records.

This checkpoint does not create Stripe Prices, connect an account, collect a payment, finalize legal terms, or change the retailer merchant-of-record boundary. Production preflight requires `STRIPE_PREMIUM_MONTHLY_PRICE_ID` and `STRIPE_PREMIUM_ANNUAL_PRICE_ID` only if subscriptions are enabled. Local checks verify the code contract; sandbox, PostgreSQL/RLS, deployed accessibility, support ownership, legal approval, and live production evidence remain required.

**External dependencies:** sandbox/live account, signed webhook secret, approved prices and terms, business identity/support contact, configured database and TLS origins, security/RLS review, transactional communications provider (if messaging is wanted), legal/privacy review and named reconciliation owner. Keep live charges and all retail-purchase confirmations blocked until the exact capability has approval and staging evidence.

### Phase D — economical go-to-market experiments (Medium; planning now, execution gated)

**Objective:** learn which trusted discovery journeys create retained, qualified referral activity and positive contribution after service, content, support and acquisition costs. No audience size, conversion rate, referral fee or lifetime value is verified today.

1. **Set measurement first:** define an event dictionary using the analytics SDK's privacy/retention registry. Track consented entry source, skin-match completion, routine save, learn-content engagement, outbound retailer click, return visit and support resolution. Avoid collecting free-text skin details or sending profile data to retailers/ad platforms.
2. **Start with low-cost owned/organic tests:** educational learn content, search-friendly routine/ingredient explainers, retailer-neutral product education, consented onboarding email only if a transactional/marketing provider and consent records are ready, and social posts that point to the portal. Avoid medical, guaranteed-result, dermatologist-approved, partnership or discount claims without evidence.
3. **Validate referral economics:** obtain written retailer/partner terms before naming a relationship, adding affiliate identifiers or reporting referral revenue. Keep commercial placement separate from organic suitability ranking; disclose sponsorship and measure recommendation quality and user trust alongside revenue.
4. **Test retention respectfully:** consented routine check-ins, saved-list reminders and educational re-engagement; honor user preferences and unsubscribe. Do not use sensitive skin profile attributes for ad targeting.
5. **Treat paid media as a later, capped experiment:** begin only after baseline funnel instrumentation and an approved ceiling exist. Use one hypothesis, one channel, one landing journey, a time-box and stop-loss. Compare qualified completion and retained use against total channel, creative, discount, support and service costs.
6. **Use contribution measures:** incremental referral/partner revenue minus campaign, discount, content, provider inference, support, payment, refund/chargeback and operational costs where applicable. Report CAC, activation, retained use, referral click-through and qualified conversion with sample size and attribution limits. Avoid claiming profit from clicks, gross merchandise value, or modeled lifetime value without observed cohorts and contracted rates.
7. **Protect quality while optimizing:** do not reduce source grounding, human review, accessibility, safety checks, or approved-model routing to improve short-term conversion or inference cost. Monitor golden-case quality, correction/handoff rates, complaints and privacy incidents alongside financial outcomes.

**Phase D2 — referral engagement baseline checkpoint:** The Shop records daily aggregate counts when a visitor opens an allowlisted retailer destination or changes a saved-retailer state. The operations panel shows a 30-day retailer and segment view to superadmin and compliance roles. These counters contain no customer identifier, profile, search, free text, retailer-site activity, order, amount, revenue or profit data, and expire after 180 days by default. They measure portal actions, not unique customers, retailer purchases, conversion, revenue or profit. Commercial agreements and affiliate attribution remain pending.

**Phase D3 — assistant journey measurement checkpoint:** The server records aggregate guidance outcomes by the four bounded assistant roles and accepts next-step selections only for the six approved portal destinations. The operations panel reports guidance volume and an offered → Support opened → request saved funnel. Arbitrary roles, action names and external URLs are rejected. The counters exclude question text, ticket content, customer identifiers, account details and email addresses, and use the same 180-day aggregate retention policy. Counts describe portal actions rather than unique people or guaranteed support outcomes.

**Phase B3 — owned escalation checkpoint:** An authorized superadmin or compliance operator can assign a fixed internal escalation reason while updating a request; the request is assigned to that operator and the customer receives only the updated status and any customer-facing reply. The supported reasons are content safety, account/privacy, billing scope, retailer purchase, technical issue, specialist review and other. Customer responses and account exports exclude internal assignment and escalation fields. The operations panel shows aggregate escalation selections by reason, not customer or ticket data. This is a local workflow record; it does not establish staffing, delivery or response-time commitments.

**Phase F1 — shared navigation focus checkpoint:** The portal shell moves focus to the main landmark after an in-portal route change, so keyboard and screen-reader users reach the new page context. Opening the mobile menu moves focus to its first primary destination; Escape closes the menu and returns focus to Menu. The existing Skip to content link, reduced-motion support, visual design, routes and menu structure remain unchanged. This does not replace a full device, screen-reader, contrast or WCAG audit.

**Phase F2 — rendered accessibility markup checkpoint:** The production proxy journey now checks all 29 portal routes for the shared Skip to content link, primary-navigation identity and label, main landmark, labeled policy navigation, and alternative-text attributes on rendered images. This protects the baseline markup from regressions without changing visible content, branding, or page structure. It does not measure keyboard traversal, screen-reader announcements, contrast, zoom/reflow, or real-device behavior; those remain required release evidence.

**Phase F3 — theme accessibility contract:** The local release gate now calculates WCAG contrast ratios for 20 normal-text token pairs across the dark and light themes and requires at least 4.5:1. It also verifies that reduced-motion, forced-color, and visible-focus rules remain declared. The current minimum measured pair is 5.82:1. This protects the declared design tokens and preference hooks; component states, imagery, browser rendering, zoom/reflow, and assistive-technology behavior still require human and device validation.

**Phase F4 — route identity checkpoint:** The shared shell assigns a concise page title to every current customer and operator route. After an in-portal navigation, it updates the browser title and a polite live region while the existing focus behavior moves to the main landmark. This improves page context without changing visible navigation, branding, routes, or layout.

**Phase F5 — customer-form state checkpoint:** Support guidance, saved Support requests, Skin Coach, and account sign-in now expose their busy state and associate server errors with the relevant form. The question and verification controls mark failed input states and clear the stale error when the customer edits the affected value. Existing submission, consent, authentication, and payment boundaries are unchanged.

**Phase F6 — recovery-focus checkpoint:** The application error boundary moves focus to its recovery heading when an unexpected route failure is shown. Customers can retry or return to Applications using the existing recovery actions. This is a local focus-management safeguard; real assistive-technology announcement quality and failure behavior under deployed network conditions remain open.

**Phase F7 — confirmation-dialog checkpoint:** Shared confirmation dialogs expose their title, description, modal and busy states, retain native keyboard containment, and explicitly restore focus to the control that opened them when they close. Account deletion and routine simplification keep their existing confirmation boundaries.

**Phase F8 — retailer-shortlist checkpoint:** The shortlist announces its selected count and connects its heading, instructions and count. The existing three-retailer cap, URL persistence, independent-listing disclosure, download, copy and removal behavior are unchanged.

**Phase F9 — Shop-filter checkpoint:** Shop search, region and specialty controls identify the results they update and the matching-destination status that describes them. The result count is atomic and polite, while retailer ordering, links, saved state and referral measurement remain unchanged.

**Phase F10 — reviewed-library search checkpoint:** The reviewed-library search identifies its result collection and live result count. Source links, review status, content and empty states are unchanged.

**Phase F11 — Replenishment feedback checkpoint:** The reminder form exposes busy and associated error states, clears stale errors when values change, and announces planned and due totals. Reminder actions remain planning records and cannot purchase a product.

**Phase F12 — membership selector checkpoint:** Subscription audience and billing-cycle choices are grouped with programmatic legends. Billing actions expose busy/error relationships, and confirmed subscription status is announced without treating a browser return as payment confirmation.

**Phase F13 — renewal confirmation focus checkpoint:** The subscription workspace remembers the renewal control that opened its inline confirmation. Back or a completed request returns focus to that control when it remains available, otherwise to Refresh status. Confirmation help, busy state and errors are programmatically associated.

**Phase F14 — invited-access feedback checkpoint:** Guest invitation creation and acceptance expose busy/error relationships. Invalid email state clears when edited, and a newly created one-time invitation link is announced. Profile, billing and administration isolation remain unchanged.

**Phase F15 — Beauty & Style feedback checkpoint:** The shared style-profile form exposes busy/error relationships, clears stale save errors when a preference changes, and confirms complete-plan downloads. The plan remains deterministic and preference-based; no photo analysis, live AI assessment or shade verification is introduced.

**Phase F16 — billing activity checkpoint:** The confirmed subscription-activity region exposes its heading and loading state, announces the number of confirmed updates, and prevents duplicate refresh actions while loading. It remains a status history rather than a receipt or invoice.

**Phase F17 — gated-action explanation checkpoint:** Shared operator action controls now programmatically associate each disabled reason with its button and expose their busy state. Separation-of-duties explanations remain visible and are available to assistive technology.

**Phase F18 — knowledge-selection checkpoint:** Knowledge objects are selected with native buttons that expose pressed state. Keyboard operators can reach and select every object without relying on a pointer; approval, provenance and retrieval rules are unchanged.

**Phase F19 — ingredient-rule selection checkpoint:** Each safety-rule row now provides a native selection button with pressed state. The live-versus-draft matrix, SME approval boundary and fail-closed scoring behavior remain unchanged.

**Phase F20 — operator-access form checkpoint:** Operator lookup and role assignment expose busy/error relationships. A stale lookup error clears when the email changes; existing superadmin authorization, confirmation, concurrency and audit controls remain in force.

**Phase F21 — operator AI and reconciliation checkpoint:** The advisory-analysis form and spending-hold reconciliation forms expose busy/error relationships. Analysis input clears stale errors when edited, and returned analysis is announced as status. Daily limits, consent, role checks, cost holds and manual provider-record verification remain unchanged.

**Phase F22 — per-request support state checkpoint:** Every operator support form now owns its own busy, error and success state. Updating one request no longer disables unrelated requests, and duplicate submission is blocked only for the request being saved.

**Phase F23 — support lifecycle guidance checkpoint:** The operator form explains the API lifecycle before submission and requires a customer-facing reply for Open, Waiting for customer and Resolved. In review remains the only state that can be saved without a reply; the API remains authoritative.

**Phase F24 — support history semantics checkpoint:** Each request is programmatically connected to its heading, customer-visible replies are identified as such, empty reply history is explicit, and saved/updated/reply dates use machine-readable timestamps.

**Phase F25 — operations data navigation checkpoint:** Readiness, support, referral, privacy, billing and AI sections expose loading state and named headings. Metric groups use description lists; horizontally scrollable tables are keyboard-focusable named regions with captions and scoped row/column headers.

**Phase F26 — operator evidence and draft-state checkpoint:** Audit evidence uses a named table, scoped action rows and machine-readable dates. Knowledge/rule draft controls expose busy state, disable affected fields during a save, clear stale errors when edited and use explicit button types.

**F22–F26 verification:** Focused render checks and every full local release gate passed at `work/verification/2026-09-25T16-34-14-942Z/report.md`; the seven-gate local checkpoint passed at `work/checkpoints/2026-09-25T16-34-13-262Z/report.md`. Evidence includes 70 HTTP/persistence/release-contract tests, the production web build, 29-route proxy journey and zero-hit public artifact vendor scan. These checks preserve authorization and API enforcement; deployed keyboard, screen-reader, browser/device and complete WCAG evidence remain required.

**Phase F27 — customer request history semantics checkpoint:** Customer Support history now uses labelled request cards, machine-readable saved, updated and reply timestamps, and explicitly names replies as customer-visible. Empty history copy now uses the same customer-visible language as the operator view. Portal support records remain local portal records, not external delivery proof or response-time commitments.

**Phase F28 — account deletion evidence checkpoint:** The account deletion panel exposes its scheduled processing time with a machine-readable timestamp and lists blocking reasons when processing is paused. The existing 30-day cancellation, active-obligation blockers and confirmation dialog remain unchanged.

**Phase F29 — restock alert semantics checkpoint:** Replenishment alerts announce recent and unread counts, label each alert from its heading, expose created and scheduled reminder dates as machine-readable timestamps, and associate the mark-read action with the alert it changes. Reminders still cannot place orders or send retailer data.

**Phase F30 — operator role-state checkpoint:** Operator access management now separates lookup and save busy/error states and announces the currently selected roles before a superadmin confirms a change. Server-side superadmin, CSRF/origin, revision, live revocation and audit controls remain authoritative.

**Phase F31 — verification port isolation checkpoint:** The production web proxy journey now uses temporary loopback ports and rewrites its generated local proxy manifest to the test API for that run. It no longer requires stopping an existing local demo/API listener on port 3100, and it still avoids live services or production configuration.

**Phase F32 — independent reminder actions checkpoint:** Replenishment saves, seven-day reminder moves, reminder removals and alert mark-read actions now expose busy state only on the action being saved. An unrelated reminder or alert action no longer disables the rest of the page.

**Phase F33 — shared character-count checkpoint:** Support guidance, Support request details and operator customer replies now use a shared polite, atomic character-count component. Existing server-side length validation remains authoritative.

**Phase F34 — safe retry control checkpoint:** Shared loading-error retry controls now use explicit button type semantics so retry actions cannot accidentally submit a surrounding form.

**Phase F35 — invited-access action-state checkpoint:** Guest invitation acceptance, creation and revocation now expose action-specific busy state. Revoking one invitation no longer disables every invitation row, invitation expiry uses machine-readable timestamps, and create/accept controls use explicit button types. Profile, billing and administration isolation remain unchanged.

**Phase F36 — routine feedback action-state checkpoint:** My Skin routine check-in feedback now scopes busy state to the selected feedback option. Saving one check-in no longer disables the other feedback choices; server-side revision and feedback validation remain authoritative.

**Phase F37 — retailer save action-state checkpoint:** Retailer save and unsave controls now scope busy state to the destination being saved. Saving one retailer no longer disables every save button, while saved-list loading or error states still block all save changes.

**Phase F38 — Skin Coach composer semantics checkpoint:** Skin Coach now uses the shared polite, atomic character-count component for its question composer and marks its submit control explicitly. The existing reviewed-library, consent, sign-in and no-diagnosis boundaries remain unchanged.

**Phase F39 — account action-specific status checkpoint:** Account sign-in, verification, sign-out, profile-merge and deletion confirmation actions now track the active account action and show action-specific progress labels. The server-owned auth, merge-conflict, deletion-window and account-export controls remain authoritative.

**Phase F40 — invited-access expiry evidence checkpoint:** Accepted guest access now uses the shared timestamp helper for its access end date. Invitation creation, acceptance, revocation, profile privacy, billing isolation and administration isolation remain unchanged.

**Phase F41 — subscription renewal evidence checkpoint:** Subscription access and current-period dates now use shared machine-readable timestamps, and renewal refresh, choice, confirmation and back controls declare button behavior explicitly. Renewal requests remain confirmation-gated and server-owned.

**Phase F42 — draft-plan billing action-state checkpoint:** Plans & Billing now tracks checkout discard, billing portal, trial-cycle and checkout actions separately, with action-specific progress labels and explicit button types. Enrollment remains closed unless approved pricing, terms, configuration and consent are present.

**Phase F43 — billing activity semantics checkpoint:** Confirmed billing activity now uses the shared timestamp helper and the refresh control is explicitly non-submit. Activity remains evidence of confirmed portal updates, not proof of external invoices or receipts.

**Phase F44 — reusable command button semantics checkpoint:** Coach quick intents and diff actions, Shop checkout, library clear-search and the app error retry control now declare button behavior explicitly. Existing proposed-change, checkout, reviewed-library and error-recovery behavior remains unchanged.

**Phase F45 — AI reservation audit evidence checkpoint:** Admin AI spending reservations and recent reconciliations now keep created and reconciled dates as machine-readable timestamps, and AI analysis/reconciliation submit controls declare submit behavior explicitly. Budget enforcement, provider reconciliation and operator authorization remain server-owned.

**Phase F46 — beauty profile note-count checkpoint:** Beauty & Style personal notes now use the shared polite, atomic character-count component and the save control declares submit behavior explicitly. Preference-only styling guidance remains unchanged and does not add photo analysis or live AI assessment.

**Phase F47 — Skin Match and Routine safe-control checkpoint:** Skin Match review save/back controls and Routine retry/simplify controls now declare button behavior explicitly. Revision checks, consent, profile persistence and simplify confirmation remain unchanged.

**Phase F48 — retailer retry and listing evidence checkpoint:** Saved-retailer retry controls now declare non-submit behavior, and retailer checked dates use machine-readable timestamps. Retailer visits, saved-list state, comparison limits and no-referral/no-order boundaries remain unchanged.

**Phase F49 — replenishment submit semantics checkpoint:** The reminder create/update control now declares submit behavior explicitly. Reminder validation, due-date limits, reminder removal and non-purchase behavior remain unchanged.

**Phase F50 — operator-access submit semantics checkpoint:** Operator lookup and role-save controls now declare submit behavior explicitly. Superadmin-only access, revision checks, confirmation and audit recording remain server-owned.

**Phase F51 — membership date evidence checkpoint:** Plans & Billing trial and current-period dates now use the shared timestamp helper. Draft enrollment, recurring consent, checkout configuration and billing-service confirmation remain unchanged.

**Phase F52 — admin analysis question-count checkpoint:** Portal AI analysis questions now use the shared polite, atomic character-count component. Consent, operator authorization, no-customer-data guidance and server-side daily limits remain unchanged.

**Phase F53 — knowledge and rule action-state checkpoint:** Knowledge and rule draft/approval operations now track the active draft or approval action before showing progress labels. SME approval, separation of duties, provenance and server validation remain authoritative.

**Phase F54 — admin primitive audit timestamp checkpoint:** The shared admin audit trail now renders action timestamps with machine-readable values. Audit entries remain immutable evidence of recorded operator actions.

**Phase F55 — support subject-count checkpoint:** Customer Support request subjects now use the shared polite, atomic character-count component. Detail length validation, local request storage and external-delivery boundary remain unchanged.

**Phase F56 — Skin Match consent lock checkpoint:** Skin Match review consent is disabled while the profile save is in progress. Revision checks, consent requirement and saved-profile routing remain unchanged.

**Phase F57 — final safe-control sweep checkpoint:** The remaining customer/admin controls touched in this pass preserve explicit button roles across retailer, reminder, operator, analysis and audit flows. No production configuration, provider credential, live billing, retailer order or support-delivery claim was added.

**F27–F57 verification:** Full local verification passed at `work/verification/2026-09-27T19-17-38-186Z/report.md`, and the local release checkpoint passed at `work/checkpoints/2026-09-27T19-18-22-861Z/report.md` with production preflight still blocked and the release decision still **NOT READY**. Evidence covered the new customer-history timestamps, account-deletion blockers, restock alert state, independent reminder actions, shared character-count semantics, Skin Coach composer semantics, account action-specific progress, invited-access action state and expiry evidence, subscription renewal date evidence, draft-plan billing action state, billing activity semantics, reusable command button semantics, AI reservation audit timestamps, beauty note-count semantics, Skin Match/Routine safe controls, retailer retry/listing evidence, replenishment submit semantics, operator submit semantics, membership date evidence, admin analysis question counts, knowledge/rule action state, admin primitive audit timestamps, support subject counts, routine feedback action state, retailer save action state, operator reply character count, existing admin support semantics, the production web build, the 29-route proxy journey, root static build and zero-hit public artifact vendor scan. This is local rendered/build/proxy evidence only; deployed keyboard, screen-reader, mobile, browser/device and complete WCAG validation remain required.

**Phase F58 — application hub live-count checkpoint:** The application hub category result count now uses a polite, atomic status region so category changes announce the full count consistently. Category tabs, application links, branding and routing remain unchanged.

**Phase F59 — retailer comparison evidence checkpoint:** The retailer comparison selected-count status is now atomic, comparison feedback messages are polite and atomic, and listing-checked dates use the shared timestamp helper. The comparison remains a portal shortlist, not a price, stock, delivery or suitability guarantee.

**Phase F60 — My Skin feedback timestamp checkpoint:** My Skin last-check-in evidence now uses the shared timestamp helper. Feedback validation, revision checks and routine rebuild behavior remain server-owned.

**Phase F61 — routine tab count checkpoint:** Routine tab changes now announce the complete current step count through a polite, atomic status region. Routine ordering, tabs, mode actions and swap controls remain unchanged.

**Phase F62 — billing activity live-count checkpoint:** Confirmed subscription activity totals now use a polite, atomic status region. Billing activity remains a portal summary of confirmed updates, not external invoice or receipt evidence.

**Phase F63 — guest invitation link status checkpoint:** The one-time invited-access link container now announces itself as a polite, atomic status region. Link display remains one-time and still does not delegate profile, billing or administration access.

**Phase F64 — restock alert timestamp checkpoint:** Restock alert created and scheduled reminder times now use the shared timestamp helper. Alerts remain reminder records only and cannot place orders or contact retailers.

**Phase F65 — Support guidance result checkpoint:** Guided Support results now use a polite, atomic status region, and reviewed-source links include explicit new-tab/no-referrer treatment. Guidance still cannot create a request until the customer saves one.

**Phase F66 — profile timeline timestamp checkpoint:** The shared Skin Profile timeline now uses the shared timestamp helper for profile-version dates. The timeline remains explanatory profile history, not medical evidence.

**Phase F67 — routine feedback grouping checkpoint:** My Skin routine check-in choices are now exposed as one named feedback group. Per-option busy state, revision checks and feedback validation remain unchanged.

**F58–F67 verification:** Full local verification passed at `work/verification/2026-09-28T13-32-15-300Z/report.md`, and the local release checkpoint passed at `work/checkpoints/2026-09-28T13-33-01-949Z/report.md` with production preflight still blocked and the release decision still **NOT READY**. Evidence covered application hub live counts, retailer comparison timestamps and status feedback, My Skin feedback timestamps, Routine tab counts, billing activity totals, invited-access link status, restock alert timestamps, Support guidance status and reviewed-source links, profile timeline timestamps, routine feedback grouping, the production web build, the 29-route proxy journey, root static build and zero-hit public artifact vendor scan. This is local rendered/build/proxy evidence only; deployed keyboard, screen-reader, mobile, browser/device and complete WCAG validation remain required.

**Phase F68 — support ownership preflight checkpoint:** Production preflight now requires `SUPPORT_OWNER_NAME` and `SUPPORT_OWNER_EMAIL`, and rejects placeholder or malformed ownership values. This makes named support accountability a machine-checked launch input without creating staffing or external helpdesk delivery.

**Phase F69 — deployed accessibility evidence preflight checkpoint:** Production preflight now requires `ACCESSIBILITY_VALIDATION_REPORT_URL` and `ACCESSIBILITY_VALIDATED_AT`, with HTTPS and past-ISO timestamp validation. This records deployed accessibility evidence as a release input; it does not replace the actual browser/device/screen-reader audit.

**Phase F70 — production config template checkpoint:** `infra/portal/env.example` and the portal infrastructure README now document the support-ownership and deployed-accessibility evidence fields beside the existing secret, provider, backup and immutable-image settings. No live credential, provider account, support mailbox or deployment evidence was added to the repository.

**F68–F70 verification:** Infrastructure preflight tests passed, full local verification passed at `work/verification/2026-09-28T13-37-01-093Z/report.md`, and the local release checkpoint passed at `work/checkpoints/2026-09-28T13-37-48-072Z/report.md` with production preflight still blocked and the release decision still **NOT READY**. Evidence covered the new support-ownership and deployed-accessibility preflight checks, existing image/database/provider/billing configuration checks, the production web build, the 29-route proxy journey, root static build and zero-hit public artifact vendor scan. Production remains blocked until real environment values and external evidence are supplied outside source control.

**Phase F71 — deployment readiness packet checkpoint:** Added a secret-free release-readiness contract covering F71–F80. It gives each phase an owner, required evidence statement, and one of four explicit statuses: pass, pending, blocked, or not applicable. The packet keeps repository-local configuration and tests separate from live deployment evidence.

**Phase F72 — production configuration evidence checkpoint:** The readiness command consumes the existing production preflight result and reports only pass/fail state, warnings, and safe reasons. It never serializes environment values or credentials. A missing `infra/portal/.env` therefore produces a useful blocked packet without manufacturing configuration evidence.

**Phase F73 — support ownership and helpdesk readiness checkpoint:** The packet carries named ownership through the existing preflight contract and leaves monitored mailbox/helpdesk delivery as a separate pending live-evidence item. This preserves the distinction between identifying an owner and proving the support route works.

**Phase F74 — deployed accessibility evidence checkpoint:** The packet carries the HTTPS report URL and past-timestamp requirements through preflight, while requiring a separate `accessibility_deployed` evidence flag for the actual deployed keyboard, screen-reader, mobile/browser, contrast, and WCAG validation.

**Phase F75 — Supabase/Postgres and RLS validation checkpoint:** Database URL, Supabase keys, and verified TLS remain configuration checks. A separate `database_rls` evidence flag is required for target-project identity, migration, RLS isolation, and account-lifecycle validation.

**Phase F76 — backup, restore, and readiness checkpoint:** Worker/readiness configuration remains preflight-validated. A separate `backup_restore` evidence flag is required for an encrypted off-host restore drill and healthy deployed `/readyz` result.

**Phase F77 — Stripe sandbox and webhook checkpoint:** Disabled subscriptions are reported as not applicable. When enabled, the existing named Price ID, terms, secret, and webhook requirements remain blocking until configured; `stripe_sandbox` is required for signed sandbox delivery, reconciliation, cancellation, and entitlement evidence.

**Phase F78 — immutable image and startup checkpoint:** Image digest and production configuration failures remain blocking. A separate `container_startup` evidence flag is required for approved image startup, health/readiness probes, and edge routing.

**Phase F79 — AI/runtime qualification checkpoint:** The packet checks for a complete enabled local or hosted runtime configuration, then requires `ai_provider` evidence for installed models/providers, fallback behavior, spend controls, and hosted billing reconciliation.

**Phase F80 — staging release packet checkpoint:** The packet reports staging ready only when local gates are recorded and every required predecessor phase passes or is explicitly not applicable. No deployment, provider call, credential, staffing confirmation, or live evidence is created by this command.

**F71–F80 verification:** Focused preflight and readiness contract tests passed with 15 cases. `node infra/portal/release-readiness.mjs` reports the current workspace as **NOT READY** because production configuration and live evidence are not supplied. The runnable entry points are `pnpm infra:readiness` and `pnpm infra:readiness -- --require-ready` after dependencies are available.

**Phase F81 — release ownership checkpoint:** Added `infra/portal/FULL-SHIP-PLAN.md` with explicit release, support, data, platform, accessibility, billing and AI/runtime ownership responsibilities. The plan keeps credentials, customer records and provider payloads outside source control.

**Phase F82 — candidate freeze checkpoint:** The ship plan defines the exact local gate sequence, hosted verification requirement, exact-commit evidence, generated-artifact rejection and release-record handoff before staging or publication.

**Phase F83 — staging data and identity checkpoint:** The ship plan sequences separate staging data, reviewed migrations, RLS, two-connection concurrency, account lifecycle, catalog import and first-superadmin provisioning. Application startup migration remains disabled.

**Phase F84 — support and accessibility publish checkpoint:** The ship plan requires a successful support test ticket and deployed keyboard, screen-reader, mobile/browser, contrast, zoom/reflow and WCAG evidence before go/no-go.

**Phase F85 — operations and recovery checkpoint:** The ship plan requires immutable image startup, edge routing, health/readiness transition evidence, worker heartbeat, encrypted off-host restore proof, retention checks and notification delivery evidence.

**Phase F86 — optional billing and AI checkpoint:** The ship plan makes Stripe sandbox evidence mandatory when subscriptions are enabled and AI provider/model, fallback, spend and reconciliation evidence mandatory for an enabled runtime. Incomplete optional boundaries remain disabled.

**Phase F87 — immutable publish checkpoint:** The ship plan defines the publish order for reviewed migrations, secret injection, approved model sync, API/worker, web and edge startup, TLS and same-origin smoke validation. Floating image tags and automatic production migration remain prohibited.

**Phase F88 — rollback rehearsal checkpoint:** The ship plan defines fail-closed rollback triggers, previous immutable image redeployment, migration non-reversal, data restore coordination, optional-boundary disablement and post-rollback smoke checks.

**Phase F89 — launch monitoring checkpoint:** The ship plan defines 15-minute, one-hour, 24-hour and seven-day checks for readiness, support, privacy, audit, webhooks, accessibility, AI economics and billing where enabled.

**Phase F90 — release closeout checkpoint:** The ship plan requires final commit, image digests, monitoring record, known issues, incident review and rollback reference before a release is closed.

**F81–F90 verification:** The full ship-plan contract tests verify candidate freeze, staging, support/accessibility, operations/recovery, readiness, publish, rollback and post-launch monitoring controls. The current candidate remains **NOT READY** until the F71–F80 packet is complete and the external staging evidence is attached.

**Phase F91 — ship-packet schema checkpoint:** Added a JSON release-packet contract and placeholder example covering candidate identity, hosted CI, accountable owners, image digests, evidence references, rollback target and monitoring windows.

**Phase F92 — candidate identity checkpoint:** The ship-packet validator requires a 40-character commit SHA, branch, local checkpoint report, verification report and HTTPS hosted CI reference before publication.

**Phase F93 — evidence reference checkpoint:** The validator requires reviewed, non-placeholder evidence for support workflow, deployed accessibility, database/RLS, backup restore and container startup. Stripe sandbox and AI evidence become required when their readiness phases are enabled.

**Phase F94 — owner approval checkpoint:** Release, support, data, platform and accessibility owners are required in the packet. Billing and AI/runtime ownership remain additional launch responsibilities when those boundaries are enabled.

**Phase F95 — immutable image and rollback checkpoint:** The packet requires immutable Node/Ollama/Caddy digests and a named last-approved release with a rehearsed rollback reference. Mutable tags and automatic migration reversal are rejected by the ship plan.

**Phase F96 — monitoring handoff checkpoint:** The packet requires a launch monitor, incident route, launch-window timestamp and 15-minute, one-hour, 24-hour and seven-day checks.

**Phase F97 — prepublish validation checkpoint:** Added `pnpm infra:ship-packet -- path/to/ship-packet.json --require-ready`, which combines the current F71–F80 readiness result with the packet contract and fails closed when either is incomplete.

**Phase F98 — release archive checkpoint:** The ship plan now requires the exact candidate, checkpoint, verification, hosted CI, image digest and evidence references to be retained in the approved release record without copying secrets or customer data into Git.

**Phase F99 — post-publish closeout checkpoint:** The ship plan requires monitoring records, known issues, incident review and rollback reference before release closure.

**Phase F100 — publication gate checkpoint:** A publish packet is valid only when readiness is release-ready, all required evidence is reviewed, owners are named, immutable images are recorded, rollback is rehearsed and monitoring is staffed.

**F91–F100 verification:** Ship-packet, readiness, preflight and ship-plan contract tests passed with 22 cases. The placeholder packet is intentionally invalid until real release evidence is supplied. The current candidate remains **NOT READY** and no publication was attempted.

**Phase F101 — packet freshness checkpoint:** Ship packets now require a past `generated_at` timestamp and a future `expires_at` timestamp, preventing stale approval records from being reused indefinitely.

**Phase F102 — phase-bound evidence checkpoint:** Every required evidence item is unique and declares the phase it proves. Duplicate, missing and phase-mismatched evidence is rejected.

**Phase F103 — approval quorum checkpoint:** Release, support, data, platform and accessibility roles each require one explicit `go` decision with an approver, timestamp and decision reference.

**Phase F104 — deployment image coherence checkpoint:** When the deployment environment supplies immutable Node, Ollama and Caddy digests, the ship packet must contain the same values exactly.

**Phase F105 — evidence review checkpoint:** Required evidence references must be non-placeholder HTTPS or repository reports, with named reviewers and past review timestamps.

**Phase F106 — rollback verification checkpoint:** The packet now requires a last-approved release, rollback evidence reference and past rollback verification timestamp.

**Phase F107 — launch-window checkpoint:** The packet retains an explicit future launch-window start, incident route and launch monitor, separate from evidence review time.

**Phase F108 — monitoring cadence checkpoint:** The packet requires 15-minute, one-hour, 24-hour and seven-day checks before it can be valid.

**Phase F109 — publication record checkpoint:** The ship-packet command reports candidate identity, readiness phases, errors and warnings without serializing deployment secrets or customer data.

**Phase F110 — final approval integrity checkpoint:** Publication now requires both a release-ready F71–F80 readiness result and a valid F91–F110 ship packet. The placeholder example remains intentionally invalid.

**F101–F110 verification:** Ship-packet, readiness, preflight and ship-plan contract tests passed with 23 cases. Full local verification and all checkpoint gates remain required before any publish decision; production remains **NOT READY**.

**Phase F111 — draft packet generator checkpoint:** Added `infra/portal/create-ship-packet.mjs` and `pnpm infra:create-ship-packet` to generate a repository-grounded ship-packet draft without credentials or customer data.

**Phase F112 — candidate metadata discovery checkpoint:** The generator records the current branch, commit, latest local checkpoint report and latest verification report, while preserving explicit placeholders when evidence is unavailable.

**Phase F113 — secret-free image discovery checkpoint:** Only values matching approved immutable Node/Ollama/Caddy digest syntax are copied into the draft. Other environment values are never serialized.

**Phase F114 — conditional evidence template checkpoint:** The draft includes the common support, accessibility, database/RLS, backup and container evidence records, and adds Stripe or AI evidence templates only when those boundaries are enabled.

**Phase F115 — pending approval checkpoint:** Generated owner and approval records remain visibly pending, so draft generation cannot be mistaken for a release decision.

**Phase F116 — rollback and monitoring template checkpoint:** The draft includes rollback verification and 15-minute, one-hour, 24-hour and seven-day monitoring fields for human completion.

**Phase F117 — draft-to-validator handoff checkpoint:** A generated draft can be completed in the approved evidence workspace and passed to `infra:ship-packet -- --require-ready` without changing the validator’s fail-closed behavior.

**Phase F118 — repository metadata integrity checkpoint:** The generator uses the repository’s current commit and branch by default, while tests allow deterministic overrides for review and automation.

**Phase F119 — incomplete-input safety checkpoint:** Missing reports, unset image digests and absent provider boundaries remain placeholders or omissions; no fake evidence is manufactured.

**Phase F120 — candidate handoff checkpoint:** F111–F120 complete the repository-side packet handoff. Publication still requires real owners, staging evidence, approvals, rollback rehearsal and a release-ready F71–F80 result.

**F111–F120 verification:** Draft-generator, ship-packet, readiness, preflight and ship-plan contract tests passed with 26 cases. No deployment, provider call or publication was attempted.

**Phase F121 — demo release-state checkpoint:** The root static demo now identifies the current F120 candidate and keeps its release metrics aligned with the local ship-packet state: drafted locally, not approved for publication.

**Phase F122 — operations ship-packet checkpoint:** Added a dedicated Ship packet operations view with candidate identity, evidence-map, approval-quorum and publication-gate summaries. The view communicates what is captured locally and what still requires accountable owners or live evidence.

**Phase F123 — interactive sample-flow checkpoint:** Added a sample packet action that opens the release handoff flow without creating a real release record. The result is explicitly marked `Drafted, not approved` and uses sample records only.

**Phase F124 — static artifact checkpoint:** Rebuilt `dist/` from the updated root demo sources and added a contract test that protects the F120 release marker, Ship packet panel, interactive flow and sample-only disclosure.

**Phase F125 — demo accessibility and responsive checkpoint:** The Ship packet tab exposes selection state, the packet table has a caption and scoped headers, and the packet summary grid collapses for narrow viewports without changing the publication status.

**F121–F125 verification:** Demo, draft-generator, ship-packet, readiness, preflight and ship-plan contract tests passed with 29 cases. The static preview remains a local sample and does not represent deployed production readiness.

**Phase F126 — evidence review queue checkpoint:** The Ship packet panel now presents a small operator review queue with explicit passed, blocked and pending sample controls.

**Phase F127 — evidence filter checkpoint:** Added All, Passed and Needs action filters. Filtering changes only the sample table view and cannot change the packet’s `Draft · not ready` state.

**Phase F128 — review semantics checkpoint:** Evidence rows carry machine-readable status values, while filter buttons expose pressed state for keyboard and assistive-technology users.

**Phase F129 — responsive review checkpoint:** The review queue stacks cleanly on narrow screens and keeps filter controls usable without horizontal overflow.

**Phase F130 — review contract checkpoint:** Demo contract coverage now protects the review filters, action-needed evidence markers and filter interaction hook. No live packet mutation or approval action is exposed.

**F126–F130 verification:** Demo, draft-generator, ship-packet, readiness, preflight and ship-plan contract tests remain required before the next release checkpoint. The review queue is sample-only and publication remains fail-closed.

**Phase F131 — launch-watch checkpoint:** The Ship packet demo now includes the required 15-minute, one-hour, 24-hour and seven-day monitoring cadence from the publish runbook.

**Phase F132 — monitoring ownership checkpoint:** Each watch point is visibly unassigned until a real owner and incident reference are supplied; the sample cannot imply staffed operations.

**Phase F133 — rollback observation checkpoint:** The seven-day closeout preview connects monitoring to rollback review without exposing a live rollback action.

**Phase F134 — monitoring sample-flow checkpoint:** Added a non-mutating Launch monitoring sample flow that distinguishes a defined cadence from live alerts or subscriptions.

**Phase F135 — monitoring responsive contract checkpoint:** The monitoring cards use stable grid dimensions and collapse to two columns on smaller screens while preserving all four checkpoints.

**F131–F135 verification:** Demo, draft-generator, ship-packet, readiness, preflight and ship-plan contract tests remain required. No live alert, monitoring subscription, incident channel or rollback action was created.

**Phase F136 — launch-plan checkpoint:** Added a dedicated Launch plan operations view that connects monitoring, incident response, rollback, known issues and closeout.

**Phase F137 — incident ownership checkpoint:** The sample launch plan requires a reviewed incident channel, escalation path, and one accountable on-call lead before publication.

**Phase F138 — rollback rehearsal checkpoint:** The launch plan keeps the previous release, restore evidence and rehearsal status visible as separate controls.

**Phase F139 — launch-window checkpoint:** The handoff identifies the launch window and freeze conditions as required metadata rather than assuming a deployment time.

**Phase F140 — known-issues checkpoint:** Customer-impacting known issues are represented as a reviewed control before a publish decision can move forward.

**Phase F141 — closeout checkpoint:** The seven-day review requires an explicit closeout owner and a recorded post-launch decision.

**Phase F142 — hold-decision checkpoint:** The sample launch plan displays `Hold publication` while live configuration, owners, rollback evidence, and staffed monitoring are incomplete.

**Phase F143 — launch sample-flow checkpoint:** Added a non-mutating Launch plan sample flow that exposes the handoff without approving, deploying, or changing a release.

**Phase F144 — launch accessibility checkpoint:** The new operations tab, controls table, scoped headers, and decision callout preserve semantic status and keyboard navigation patterns.

**Phase F145 — launch responsive checkpoint:** Launch controls use stable cards and collapse to a two-column mobile layout without hiding required evidence categories.

**F136–F145 verification:** Demo, draft-generator, ship-packet, readiness, preflight and ship-plan contract tests remain required. No deployment, incident channel, monitoring subscription, rollback action, or publication was performed.

**Phase F146 — decision-record checkpoint:** Added a Release decision operations view that gathers candidate, approvals, rollback, and closeout state into one review surface.

**Phase F147 — candidate continuity checkpoint:** The decision record identifies the F160 local candidate and keeps exact-commit and verification evidence attached as the source of truth.

**Phase F148 — approval-quorum checkpoint:** The final view preserves the five-role approval requirement and marks incomplete quorum as a hold condition.

**Phase F149 — rollback-reference checkpoint:** The decision record requires a previous release, restore proof, and rehearsal reference before approval.

**Phase F150 — closeout-evidence checkpoint:** Seven-day ownership, known issues, and post-launch decision are represented as explicit closeout requirements.

**Phase F151 — publication-hold checkpoint:** The sample decision displays `Publication decision: hold` while live evidence or accountable owners are missing.

**Phase F152 — decision-record semantics checkpoint:** The record table distinguishes an open decision reference, incomplete approval quorum, and pending closeout record.

**Phase F153 — decision sample-flow checkpoint:** Added a non-mutating Release decision sample flow that cannot approve, deploy, notify, or close out a release.

**Phase F154 — brand continuity checkpoint:** Preserved the existing MGT Skin Care wordmark and `M` brand mark while extending the operations surface.

**Phase F155 — decision accessibility checkpoint:** Added semantic headings, scoped table headers, visible status language, and keyboard-compatible operations tab behavior.

**Phase F156 — decision responsive checkpoint:** The decision cards collapse to a two-column layout on smaller screens while preserving all four evidence categories.

**Phase F157 — closeout handoff checkpoint:** The release decision links launch monitoring, incident ownership, rollback rehearsal, and seven-day closeout without duplicating live operations.

**Phase F158 — release-state checkpoint:** Updated the demo’s visible build marker and local release labels to F160 without changing the established visual system.

**Phase F159 — demo contract checkpoint:** Contract coverage now protects the F160 marker, preserved brand mark, decision panel, hold state, sample flow, and responsive decision styling.

**Phase F160 — final local handoff checkpoint:** F146–F160 complete the local release-decision preview. Production remains blocked until real configuration, evidence, owners, approvals, and deployment validation are supplied.

**F146–F160 verification:** Demo, draft-generator, ship-packet, readiness, preflight and ship-plan contract tests remain required. No approval, deployment, notification, closeout record, or publication was performed.

**Phase F161 — publish-readiness checkpoint:** Added a Publish readiness operations view that packages the local candidate, live-evidence blockers, owner signoff, customer notice, and rollback authorization into one review surface.

**Phase F162 — original-logo consistency checkpoint:** The root demo now uses the shared original `mgt-mark.svg` asset and `brand-mark-image` treatment used by the full portal shell. Contract coverage protects the asset reference and `v2.10` logo badge so phase labels do not replace the logo.

**Phase F163 — candidate package checkpoint:** The publish view identifies the F175 local candidate as packaged for review while keeping release approval separate from local evidence.

**Phase F164 — live-evidence blocker checkpoint:** Live environment configuration, provider credentials, deployed accessibility evidence, and validation reports remain explicit missing inputs before publication can proceed.

**Phase F165 — owner-signoff checkpoint:** Release, support, platform, data and accessibility signoff remain incomplete and visibly block publication.

**Phase F166 — customer-notice checkpoint:** Customer messaging, support mailbox ownership, incident route and launch communication evidence are represented as required publish inputs.

**Phase F167 — rollback authorization checkpoint:** The publish checklist keeps previous release target, restore proof and decision owner as required authorization evidence.

**Phase F168 — disabled publish command checkpoint:** The publish panel displays `Publish command: disabled` and states that the sample cannot deploy, notify customers, rotate traffic or close the release.

**Phase F169 — publication checklist semantics checkpoint:** The publish table uses a caption, scoped headers and row-level status labels for deployment preflight, accessibility release note, support readiness and rollback authorization.

**Phase F170 — publish sample-flow checkpoint:** Added a non-mutating Publish readiness sample flow that returns `Blocked · no publish` and cannot deploy, notify, rotate traffic, mutate credentials or close out a release.

**Phase F171 — release-state checkpoint:** Updated the demo’s release labels from F160 to F175 while preserving the original `v2.10` logo badge and shared visual system.

**Phase F172 — responsive publish checkpoint:** Publish readiness cards collapse to two columns on smaller screens and keep the warning callout readable on mobile.

**Phase F173 — contract checkpoint:** Demo contract coverage now protects the F175 marker, publish tab, publish panel, disabled publish command, sample flow, responsive publish styling and original logo asset.

**Phase F174 — static demo artifact checkpoint:** The static builder now carries the original logo asset into `dist/`, and the root static preview rebuild remains the source of the demo artifact.

**Phase F175 — final local publish-package checkpoint:** F161–F175 complete the local publish-readiness package. Production remains blocked until real configuration, credentials, owners, deployed accessibility validation, support readiness, rollback proof and final approvals are supplied.

**F161–F175 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No deployment, traffic change, customer notification, credential action, approval, closeout or publication was performed.

**Phase F176 — staging-readiness checkpoint:** Added a Staging readiness operations view that separates a deployment rehearsal from production publication.

**Phase F177 — deployment URL checkpoint:** The staging gate requires a reviewed deployment URL, immutable image digests, startup logs and a `/readyz` check before any staging claim can be made.

**Phase F178 — data-restore checkpoint:** Database restore, RLS validation, retention review and rollback snapshot evidence remain explicit staging blockers.

**Phase F179 — assistive-validation checkpoint:** Keyboard, screen-reader, mobile, zoom/reflow and contrast evidence are required before staging promotion can proceed.

**Phase F180 — operator rehearsal checkpoint:** Support owner, incident channel, escalation path and on-call confirmation are represented as required staging evidence.

**Phase F181 — staging-promotion hold checkpoint:** The staging panel displays `Staging promotion: blocked` while live deployment evidence and operator coverage are absent.

**Phase F182 — no-traffic-change checkpoint:** The staging sample states that it cannot create a deployment, connect credentials, seed data, promote traffic or trigger rollback.

**Phase F183 — staging table semantics checkpoint:** The staging gate table uses a caption, scoped headers and row-level status labels for immutable deployment, data rehearsal, accessibility rehearsal and operator rehearsal.

**Phase F184 — staging sample-flow checkpoint:** Added a non-mutating Staging readiness sample flow that returns `Blocked · no staging`.

**Phase F185 — release-state checkpoint:** Updated the demo’s release labels from F175 to F190 while preserving the original logo asset, `v2.10` badge, routes and UX theme.

**Phase F186 — staging responsive checkpoint:** Staging cards collapse to two columns on smaller screens and keep the hold callout readable on mobile.

**Phase F187 — contract checkpoint:** Demo contract coverage now protects the F190 marker, staging tab, staging panel, blocked staging callout, sample flow and responsive staging styling.

**Phase F188 — evidence boundary checkpoint:** The staging package references only sample evidence and does not serialize secrets, provider credentials, deployment URLs or customer data.

**Phase F189 — publish-to-staging continuity checkpoint:** Publish readiness remains blocked, and staging readiness adds a separate rehearsal layer without weakening release-decision or publication holds.

**Phase F190 — final local staging-package checkpoint:** F176–F190 complete the local staging-readiness package. Production and staging remain blocked until real deployment, data, accessibility, support, rollback and owner evidence are supplied.

**F176–F190 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No staging environment, deployment URL, traffic change, credential connection, data seed, alert, rollback, approval or publication was created.

**Phase F191 — production-handoff checkpoint:** Added a Production handoff operations view that gathers DNS, edge, secrets, data, observability, support, accessibility and rollback evidence before go-live.

**Phase F192 — DNS and edge checkpoint:** Production hostname, TLS, Caddy routing, edge health proof and immutable deployment evidence remain required before cutover.

**Phase F193 — credential ownership checkpoint:** Database, AI, support, billing and webhook credentials remain outside source and require named owners before use.

**Phase F194 — data cutover checkpoint:** Restore evidence, RLS pass, retention signoff and rollback snapshot are required before production data can be trusted.

**Phase F195 — observability checkpoint:** Dashboard links, alert ownership, incident route and response coverage remain required go-live evidence.

**Phase F196 — support launch checkpoint:** Support mailbox, named support lead, escalation path and coverage window are represented as production blockers.

**Phase F197 — accessibility cutover checkpoint:** Deployed accessibility validation remains required before production traffic can move.

**Phase F198 — rollback owner checkpoint:** Previous release, restore proof, rollback owner and decision authority are required before cutover.

**Phase F199 — production cutover hold checkpoint:** The production panel displays `Production cutover: blocked` while live go-live evidence is incomplete.

**Phase F200 — no-customer-traffic checkpoint:** The production sample states that it cannot change DNS, connect secrets, deploy services, open enrollment or move customer traffic.

**Phase F201 — production table semantics checkpoint:** The handoff table uses a caption, scoped headers and row-level status labels for edge/deployment, secrets/data, support/observability and accessibility/rollback.

**Phase F202 — production sample-flow checkpoint:** Added a non-mutating Production handoff sample flow that returns `Blocked · no production`.

**Phase F203 — release-state checkpoint:** Updated the demo’s release labels from F190 to F205 while preserving the original logo asset, `v2.10` badge, routes and UX theme.

**Phase F204 — contract checkpoint:** Demo contract coverage now protects the F205 marker, production tab, production panel, blocked cutover callout, sample flow and responsive production styling.

**Phase F205 — final local production-handoff checkpoint:** F191–F205 complete the local production-handoff package. Production remains blocked until real DNS, edge, credentials, data, observability, support, accessibility, rollback and owner evidence are supplied.

**F191–F205 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No DNS change, credential connection, deployment, enrollment, customer traffic, alert, rollback, approval, closeout or publication was performed.

**Phase F206 — launch-exception checkpoint:** Added a Launch exception operations view that makes any proposed override explicit, scoped, owner-approved and reversible before a blocked launch can continue.

**Phase F207 — exception authority checkpoint:** Exceptions require named executive, release owner, risk owner and approval reference before they can be considered.

**Phase F208 — risk-acceptance checkpoint:** Customer impact, legal/privacy review, support burden and residual risk must be accepted by named owners before an override can proceed.

**Phase F209 — scope limitation checkpoint:** Exception scope must include audience, duration, feature boundary and customer-impact statement instead of broad approval.

**Phase F210 — expiry checkpoint:** Every exception requires an expiry time so a temporary launch exception cannot become an untracked permanent state.

**Phase F211 — mitigation checkpoint:** Support coverage, monitoring owner, incident path, kill switch and rollback target remain required before exception approval.

**Phase F212 — rollback proof checkpoint:** Previous release, restore proof, rollback owner and customer-safe fallback are required for any launch exception.

**Phase F213 — closeout checkpoint:** Post-launch review owner, due date, evidence capture and revert criteria are represented as exception closeout requirements.

**Phase F214 — no-override checkpoint:** The exception panel displays `Launch exception: denied` while authority, scope, risk, expiry and mitigation evidence are incomplete.

**Phase F215 — exception sample-flow checkpoint:** Added a non-mutating Launch exception sample flow that returns `Denied · no exception`.

**Phase F216 — release-state checkpoint:** Updated the demo’s release labels from F205 to F220 while preserving the original logo asset, `v2.10` badge, routes and UX theme.

**Phase F217 — exception table semantics checkpoint:** The exception table uses a caption, scoped headers and row-level status labels for authority, scope, mitigation and closeout.

**Phase F218 — exception responsive checkpoint:** Exception cards collapse to two columns on smaller screens and keep the warning callout readable on mobile.

**Phase F219 — contract checkpoint:** Demo contract coverage now protects the F220 marker, exception tab, exception panel, denied exception callout, sample flow and responsive exception styling.

**Phase F220 — final local exception-review checkpoint:** F206–F220 complete the local launch-exception review package. Production remains blocked unless real authority, scoped risk, expiry, mitigation, rollback and closeout evidence are supplied.

**F206–F220 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No launch block was overridden; no exception approval, customer-traffic change, deployment, DNS change, rollback, closeout or publication was performed.

**Phase F221 — post-launch-review checkpoint:** Added a Post-launch review operations view that keeps closeout separate from launch approval and requires live evidence before a release can be closed.

**Phase F222 — launch-evidence checkpoint:** Closeout now requires production traffic, launch window, deployment report and owner-reviewed launch evidence before any final decision.

**Phase F223 — monitoring closeout checkpoint:** The closeout table requires 15-minute, one-hour, 24-hour and seven-day monitoring checks with named owners.

**Phase F224 — support-impact checkpoint:** Ticket volume, response coverage, incident notes, known issues and customer messaging are represented as required closeout evidence.

**Phase F225 — data reconciliation checkpoint:** Data reconciliation, backup status, retention review and post-launch data integrity evidence remain required before closeout.

**Phase F226 — accessibility closeout checkpoint:** Deployed accessibility validation remains part of closeout, not only pre-launch review.

**Phase F227 — rollback decision checkpoint:** Closeout requires a retain, rollback, pause or follow-up decision with owner and due date.

**Phase F228 — customer-impact review checkpoint:** Customer impact and support burden must be reviewed before a release can be marked complete.

**Phase F229 — blocked closeout checkpoint:** The closeout panel displays `Closeout decision: blocked` while live monitoring, support, data, accessibility and rollback evidence are incomplete.

**Phase F230 — no-live-claim checkpoint:** The sample flow states that it cannot claim a live launch, resolve incidents, decide rollback or close a release.

**Phase F231 — closeout table semantics checkpoint:** The closeout table uses a caption, scoped headers and row-level status labels for monitoring, support, data/accessibility and final action.

**Phase F232 — closeout sample-flow checkpoint:** Added a non-mutating Post-launch review sample flow that returns `Blocked · no closeout`.

**Phase F233 — release-state checkpoint:** Updated the demo’s release labels from F220 to F235 while preserving the original logo asset, `v2.10` badge, routes and UX theme.

**Phase F234 — contract checkpoint:** Demo contract coverage now protects the F235 marker, closeout tab, closeout panel, blocked closeout callout, sample flow and responsive closeout styling.

**Phase F235 — final local closeout-review checkpoint:** F221–F235 complete the local post-launch review package. Closeout remains blocked until real launch, monitoring, support, data, accessibility, rollback and owner evidence are supplied.

**F221–F235 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No live launch was claimed; no incident, rollback, closeout, approval, traffic change, deployment or publication was performed.

**Phase F236 — evidence-archive checkpoint:** Added an Evidence archive operations view that keeps archive readiness separate from closeout and production approval.

**Phase F237 — retention-owner checkpoint:** Archive readiness now requires a named owner for archive location, retention period and access policy.

**Phase F238 — evidence-index checkpoint:** Release, ship packet, launch exception, closeout and verification references are grouped as archive evidence requirements.

**Phase F239 — integrity-proof checkpoint:** Immutable archive package, checksum and approval ledger requirements are visible before any archive can be considered durable.

**Phase F240 — audit-handoff checkpoint:** The archive table requires a named reviewer, unresolved blocker list and next audit due date.

**Phase F241 — no-archive-claim checkpoint:** The archive panel states `Archive package: blocked` until live records and retention ownership are reviewed.

**Phase F242 — retention-policy checkpoint:** Owner, location, access policy, duration and disposal review are represented as explicit retention requirements.

**Phase F243 — release-chain checkpoint:** The archive view links prior release gates without converting sample evidence into production evidence.

**Phase F244 — blocker-continuity checkpoint:** Missing live launch, monitoring, support, rollback and accessibility references continue to block final archive status.

**Phase F245 — audit-freeze checkpoint:** Audit freeze remains unavailable without immutable references, checksum and reviewed approval ledger.

**Phase F246 — archive table semantics checkpoint:** The archive table uses a caption, scoped headers and row-level status labels for evidence index, retention, integrity and audit handoff.

**Phase F247 — archive sample-flow checkpoint:** Added a non-mutating Evidence archive sample flow that returns `Blocked · no archive`.

**Phase F248 — archive owner checkpoint:** The sample flow makes retention ownership a required human assignment before archive completion.

**Phase F249 — disposal-review checkpoint:** Archive readiness includes a disposal review date so retention has a lifecycle end, not only a storage location.

**Phase F250 — audit-blocker checkpoint:** Unresolved blockers remain part of the audit handoff and cannot be hidden by the demo.

**Phase F251 — no-live-freeze checkpoint:** The sample flow states that no live evidence was frozen and no immutable archive was created.

**Phase F252 — archive responsive-layout checkpoint:** Archive grid and callout styling follow the existing operations console responsive behavior.

**Phase F253 — release-state checkpoint:** Updated the demo’s release labels from F235 to F255 while preserving the original logo asset, `v2.10` badge, routes and UX theme.

**Phase F254 — contract checkpoint:** Demo contract coverage now protects the F255 marker, archive tab, archive panel, blocked archive callout, sample flow and responsive archive styling.

**Phase F255 — final local archive-review checkpoint:** F236–F255 complete the local evidence-archive package. Archive remains blocked until real launch, closeout, retention, integrity and audit evidence are supplied.

**F236–F255 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No archive was completed; no evidence was frozen; no owner was assigned; no audit handoff, approval, traffic change, deployment or publication was performed.

**Phase F256 — audit-remediation checkpoint:** Added an Audit remediation operations view that turns archive and production blockers into accountable follow-up work without closing them.

**Phase F257 — owner-assignment checkpoint:** Remediation readiness now requires a named owner, due date, severity and accepted action plan.

**Phase F258 — finding-register checkpoint:** The remediation table captures live evidence, archive, accessibility and closure review findings as separate rows.

**Phase F259 — retest-evidence checkpoint:** Fix verification, regression proof, deployed accessibility evidence and rollback checks are required before closure.

**Phase F260 — residual-risk checkpoint:** Reviewer closure now requires a residual-risk note instead of silently treating pending gaps as fixed.

**Phase F261 — no-fix-claim checkpoint:** The remediation panel displays `Remediation closure: blocked` while owners and retest evidence are incomplete.

**Phase F262 — due-date checkpoint:** Remediation follow-up requires due dates so blocked findings do not become open-ended.

**Phase F263 — severity checkpoint:** Findings require severity assignment before owner acceptance or prioritization can be trusted.

**Phase F264 — accessibility-retest checkpoint:** Deployed keyboard, screen-reader, mobile, zoom and contrast retesting remain explicit remediation evidence.

**Phase F265 — rollback-retest checkpoint:** Rollback and recovery checks remain required where remediation touches launch or production evidence.

**Phase F266 — reviewer-closure checkpoint:** No finding can close without reviewer signoff, closure notes and next audit timing.

**Phase F267 — remediation sample-flow checkpoint:** Added a non-mutating Audit remediation sample flow that returns `Blocked · no closure`.

**Phase F268 — owner-required checkpoint:** The sample flow states that no owner was assigned by the demo.

**Phase F269 — no-retest-acceptance checkpoint:** The sample flow states that no retest evidence was accepted by the demo.

**Phase F270 — no-audit-close checkpoint:** The sample flow states that no audit item was closed by the demo.

**Phase F271 — blocker-continuity checkpoint:** The remediation view keeps live evidence, archive and accessibility gaps visible instead of collapsing them into a generic issue.

**Phase F272 — remediation responsive-layout checkpoint:** Remediation grid and callout styling follow the existing operations console responsive behavior.

**Phase F273 — release-state checkpoint:** Updated the demo’s release labels from F255 to F275 while preserving the original logo asset, `v2.10` badge, routes and UX theme.

**Phase F274 — contract checkpoint:** Demo contract coverage now protects the F275 marker, remediation tab, remediation panel, blocked closure callout, sample flow and responsive remediation styling.

**Phase F275 — final local remediation-review checkpoint:** F256–F275 complete the local audit-remediation package. Remediation remains blocked until owners, due dates, retest evidence, reviewer signoff and residual-risk notes are supplied.

**F256–F275 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No finding was fixed; no owner was assigned; no retest evidence was accepted; no audit item, approval, traffic change, deployment or publication was performed.

**Phase F276 — governance-review checkpoint:** Added a Governance review operations view that keeps final decision authority separate from remediation and release preparation.

**Phase F277 — decision-quorum checkpoint:** Governance readiness now requires executive, release, platform, data, support, accessibility and legal/privacy reviewers.

**Phase F278 — risk-disposition checkpoint:** Accepted residual risk, blocker exceptions, customer impact and fallback path must be recorded before any governance decision.

**Phase F279 — remediation-evidence checkpoint:** Owner closure, retest proof, audit notes and unresolved blocker lists are required before governance can proceed.

**Phase F280 — final-decision checkpoint:** Governance must record go, hold, rollback or follow-up with a next review date.

**Phase F281 — no-approval-claim checkpoint:** The governance panel displays `Governance decision: blocked` while quorum, risk disposition and live readiness are incomplete.

**Phase F282 — legal-privacy checkpoint:** Legal/privacy review remains an explicit decision role before launch or risk acceptance.

**Phase F283 — support-governance checkpoint:** Support readiness and incident ownership remain part of the decision quorum.

**Phase F284 — data-governance checkpoint:** Data, retention, restore and RLS evidence remain required review inputs.

**Phase F285 — accessibility-governance checkpoint:** Deployed accessibility evidence remains a required governance input.

**Phase F286 — customer-impact checkpoint:** Customer-impact review must be captured before final go/hold/rollback disposition.

**Phase F287 — fallback-path checkpoint:** Governance review requires a customer-safe fallback path before accepting residual risk.

**Phase F288 — governance sample-flow checkpoint:** Added a non-mutating Governance review sample flow that returns `Blocked · no decision`.

**Phase F289 — quorum-required checkpoint:** The sample flow states that no decision quorum was met by the demo.

**Phase F290 — no-risk-acceptance checkpoint:** The sample flow states that no risk was accepted by the demo.

**Phase F291 — no-launch-approval checkpoint:** The sample flow states that no launch was approved by the demo.

**Phase F292 — decision-continuity checkpoint:** The governance view keeps go, hold, rollback and follow-up as explicit outcomes instead of implying approval.

**Phase F293 — governance responsive-layout checkpoint:** Governance grid and callout styling follow the existing operations console responsive behavior.

**Phase F294 — contract checkpoint:** Demo contract coverage now protects the F295 marker, governance tab, governance panel, blocked decision callout, sample flow and responsive governance styling.

**Phase F295 — final local governance-review checkpoint:** F276–F295 complete the local governance-review package. Governance remains blocked until quorum, risk disposition, remediation evidence, live readiness and final decision evidence are supplied.

**F276–F295 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No risk was accepted; no quorum was met; no launch was approved; no release decision, approval, traffic change, deployment or publication was performed.

**Phase F296 — release-council checkpoint:** Added a Release council operations view that keeps council outcome capture separate from governance preparation and release approval.

**Phase F297 — attendance checkpoint:** Council readiness now requires release, engineering, support, data, accessibility, legal/privacy and executive roles.

**Phase F298 — delegate checkpoint:** Delegate and observer attendance must be recorded so quorum is auditable.

**Phase F299 — conflict-note checkpoint:** Council attendance includes conflict notes before an outcome can be trusted.

**Phase F300 — agenda-evidence checkpoint:** Governance, remediation, live readiness, launch plan and customer-impact packets are required council evidence.

**Phase F301 — decision-options checkpoint:** Go, hold, rollback, exception and defer remain explicit council outcomes.

**Phase F302 — vote-capture checkpoint:** Role-level votes are required before a council decision can be recorded.

**Phase F303 — minutes checkpoint:** Council minutes must be attached before an outcome can be archived.

**Phase F304 — action-owner checkpoint:** Follow-up action owners and due dates are required after council review.

**Phase F305 — next-council checkpoint:** A next council review date is required when any outcome is hold, exception or defer.

**Phase F306 — no-outcome-claim checkpoint:** The council panel displays `Council outcome: blocked` while attendance, evidence, votes, minutes and follow-up owners are incomplete.

**Phase F307 — release-council sample-flow checkpoint:** Added a non-mutating Release council sample flow that returns `Blocked · no outcome`.

**Phase F308 — no-attendance-quorum checkpoint:** The sample flow states that no attendance quorum was met by the demo.

**Phase F309 — no-vote-capture checkpoint:** The sample flow states that no vote was captured by the demo.

**Phase F310 — no-minutes-approval checkpoint:** The sample flow states that no minutes were approved by the demo.

**Phase F311 — no-release-outcome checkpoint:** The sample flow states that no release outcome was recorded by the demo.

**Phase F312 — follow-up-continuity checkpoint:** The council view keeps follow-up owners, due dates and next review visible instead of implying closure.

**Phase F313 — council responsive-layout checkpoint:** Council grid and callout styling follow the existing operations console responsive behavior.

**Phase F314 — contract checkpoint:** Demo contract coverage now protects the F315 marker, council tab, council panel, blocked outcome callout, sample flow and responsive council styling.

**Phase F315 — final local release-council checkpoint:** F296–F315 complete the local release-council package. Council outcome remains blocked until required attendance, reviewed evidence, votes, minutes, action owners and next review evidence are supplied.

**F296–F315 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No quorum was met; no vote was captured; no minutes were approved; no release outcome, approval, traffic change, deployment or publication was performed.

**Phase F316 — executive-signoff checkpoint:** Added an Executive signoff operations view that keeps final authorization separate from council readiness and release execution.

**Phase F317 — sponsor-authority checkpoint:** Executive signoff now requires a named sponsor, authority scope and signed decision reference.

**Phase F318 — budget-owner checkpoint:** Business readiness requires a budget owner before final authorization can be recorded.

**Phase F319 — support-capacity checkpoint:** Support coverage remains an explicit executive-signoff requirement.

**Phase F320 — legal-privacy acknowledgement checkpoint:** Legal/privacy acknowledgement remains required before executive authorization.

**Phase F321 — customer-message checkpoint:** Customer messaging approval remains a signoff input before publication.

**Phase F322 — publication-window checkpoint:** A reviewed publication window is required before executive authorization.

**Phase F323 — rollback-authority checkpoint:** Rollback owner and rollback authority remain required before signoff.

**Phase F324 — hold-criteria checkpoint:** Executive signoff requires hold criteria so the release can stop safely.

**Phase F325 — escalation-path checkpoint:** Escalation path is captured as part of release controls before authorization.

**Phase F326 — authorization-record checkpoint:** Go, hold, exception or defer must be recorded with signer and timestamp.

**Phase F327 — no-authorization-claim checkpoint:** The signoff panel displays `Executive signoff: blocked` while sponsor, business readiness, rollback and publication controls are incomplete.

**Phase F328 — executive sample-flow checkpoint:** Added a non-mutating Executive signoff sample flow that returns `Blocked · no signoff`.

**Phase F329 — no-sponsor-assignment checkpoint:** The sample flow states that no sponsor was assigned by the demo.

**Phase F330 — no-business-acceptance checkpoint:** The sample flow states that no business readiness was accepted by the demo.

**Phase F331 — no-rollback-grant checkpoint:** The sample flow states that no rollback authority was granted by the demo.

**Phase F332 — no-executive-authorization checkpoint:** The sample flow states that no executive authorization was recorded by the demo.

**Phase F333 — executive responsive-layout checkpoint:** Executive grid and callout styling follow the existing operations console responsive behavior.

**Phase F334 — contract checkpoint:** Demo contract coverage now protects the F335 marker, executive tab, executive panel, blocked signoff callout, sample flow and responsive executive styling.

**Phase F335 — final local executive-signoff checkpoint:** F316–F335 complete the local executive-signoff package. Executive authorization remains blocked until sponsor authority, business readiness, rollback ownership, publication controls and signed decision evidence are supplied.

**F316–F335 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No sponsor was assigned; no business readiness was accepted; no rollback authority was granted; no executive authorization, traffic change, deployment or publication was performed.

**Phase F336 — publication-authorization checkpoint:** Added a Publication authorization operations view that keeps publish authorization separate from executive signoff and actual release execution.

**Phase F337 — publish-owner checkpoint:** Publication authorization now requires a named publish owner, command approver and operator.

**Phase F338 — command-path checkpoint:** The publish command path and dry-run evidence must be recorded before authorization.

**Phase F339 — execution-log checkpoint:** Publication authorization requires an execution log target before any command can run.

**Phase F340 — release-window checkpoint:** Start/end time, timezone and release window controls are required before authorization.

**Phase F341 — freeze-rule checkpoint:** Freeze rules remain explicit so publication can be stopped before customer traffic changes.

**Phase F342 — hold-criteria checkpoint:** Hold criteria remain required before a publication command can be authorized.

**Phase F343 — customer-message checkpoint:** Customer-message timing remains part of publication authorization.

**Phase F344 — rollback-target checkpoint:** Previous release target and rollback owner remain required before authorization.

**Phase F345 — first-hour-watch checkpoint:** First-hour monitoring owner and incident route are required before publication.

**Phase F346 — audit-capture checkpoint:** Authorization reference, operator, timestamp, evidence archive and closeout target are required before completion.

**Phase F347 — no-publication-claim checkpoint:** The publication panel displays `Publication authorization: blocked` while owner, timing, rollback/watch and audit capture are incomplete.

**Phase F348 — publication sample-flow checkpoint:** Added a non-mutating Publication authorization sample flow that returns `Blocked · no authorization`.

**Phase F349 — no-owner-assignment checkpoint:** The sample flow states that no publish owner was assigned by the demo.

**Phase F350 — no-command-enablement checkpoint:** The sample flow states that no command was enabled by the demo.

**Phase F351 — no-timing-approval checkpoint:** The sample flow states that no publication timing was approved by the demo.

**Phase F352 — no-publication-execution checkpoint:** The sample flow states that no publication was executed by the demo.

**Phase F353 — publication responsive-layout checkpoint:** Publication grid and callout styling follow the existing operations console responsive behavior.

**Phase F354 — contract checkpoint:** Demo contract coverage now protects the F355 marker, publication tab, publication panel, blocked authorization callout, sample flow and responsive publication styling.

**Phase F355 — final local publication-authorization checkpoint:** F336–F355 complete the local publication-authorization package. Publication authorization remains blocked until publish owner, command path, release window, rollback/watch, audit capture and closeout evidence are supplied.

**F336–F355 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No publish owner was assigned; no command was enabled; no timing was approved; no publication, traffic change, deployment or release publish was performed.

**Phase F356 — production-finalization checkpoint:** Added a Production finalization operations view that joins pre-production proof, cutover rehearsal, post-production watch and final closeout before any publishable state can be claimed.

**Phase F357 — preflight-evidence checkpoint:** Finalization now requires live environment preflight evidence before release completion.

**Phase F358 — credential-ownership checkpoint:** Live credential ownership remains a named finalization blocker.

**Phase F359 — backup-restore checkpoint:** Backup restore evidence remains required before production finalization.

**Phase F360 — data-reconciliation checkpoint:** Data/RLS reconciliation evidence remains required before the release can be considered publishable.

**Phase F361 — deployed-accessibility checkpoint:** Deployed accessibility validation remains required before production finalization.

**Phase F362 — cutover-rehearsal checkpoint:** Operator dry run and publish-command review remain explicit finalization inputs.

**Phase F363 — rollback-drill checkpoint:** Rollback drill evidence remains required before any finalization claim.

**Phase F364 — freeze-window checkpoint:** Freeze-window confirmation remains part of finalization readiness.

**Phase F365 — customer-notice checkpoint:** Customer notice timing remains required before cutover completion.

**Phase F366 — first-hour-watch checkpoint:** First-hour monitoring remains required before post-production closeout.

**Phase F367 — support-route checkpoint:** Support queue ownership and incident routing remain required after production.

**Phase F368 — analytics-validation checkpoint:** Analytics and customer-impact validation remain required before closeout.

**Phase F369 — evidence-archive checkpoint:** Archive reference and checksum remain required before final closeout.

**Phase F370 — signoff-ledger checkpoint:** Finalization requires a signoff ledger, operator record and timestamp before completion.

**Phase F371 — open-action checkpoint:** Open action owners and next audit timing remain required before finalization.

**Phase F372 — no-finalization-claim checkpoint:** The finalization panel displays `Production finalization: blocked` while live preflight, cutover rehearsal and post-production closeout are incomplete.

**Phase F373 — finalization sample-flow checkpoint:** Added a non-mutating Production finalization sample flow that returns `Blocked · no finalization`.

**Phase F374 — finalization responsive-layout checkpoint:** Finalization grid and callout styling follow the existing operations console responsive behavior.

**Phase F375 — final local production-finalization checkpoint:** F356–F375 complete the local production-finalization package. Production finalization remains blocked until live pre-production evidence, cutover rehearsal, post-production watch, support route, archive reference and closeout ledger are supplied.

**F356–F375 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No live preflight was supplied; no credential owner was recorded; no cutover was rehearsed; no first-hour watch, support closeout, deployment, traffic change, publication or release publish was performed.

**Phase F376 — operational-acceptance checkpoint:** Added an Operational acceptance operations view that keeps owner acceptance, service readiness, risk acceptance and post-release closeout separate from production finalization.

**Phase F377 — business-owner checkpoint:** Operational acceptance now requires a named business owner before production operation can be accepted.

**Phase F378 — platform-owner checkpoint:** Platform ownership remains a named acceptance requirement.

**Phase F379 — support-lead checkpoint:** Support lead acceptance and queue ownership remain required before operation acceptance.

**Phase F380 — privacy-data-review checkpoint:** Privacy/data reviewer acceptance remains required before production operation can be accepted.

**Phase F381 — accessibility-review checkpoint:** Accessibility reviewer acceptance remains required before operational acceptance.

**Phase F382 — slo-baseline checkpoint:** Live SLO baseline evidence remains required before service readiness can be accepted.

**Phase F383 — alert-threshold checkpoint:** Alert thresholds and monitoring routes remain required before operational acceptance.

**Phase F384 — on-call-coverage checkpoint:** On-call coverage and escalation proof remain required before operation acceptance.

**Phase F385 — incident-route checkpoint:** Incident route and response ownership remain explicit acceptance blockers.

**Phase F386 — residual-risk checkpoint:** Residual-risk record and accepted risk owner remain required before acceptance.

**Phase F387 — rollback-acceptance checkpoint:** Rollback acceptance remains required before operational ownership can be accepted.

**Phase F388 — customer-message-approval checkpoint:** Customer-message approval remains required before operational acceptance.

**Phase F389 — exception-expiry checkpoint:** Exception expiry and follow-up owner remain required before acceptance.

**Phase F390 — twenty-four-hour-review checkpoint:** A 24-hour production review remains required before closeout.

**Phase F391 — seven-day-review checkpoint:** A seven-day production review remains required before release acceptance can close.

**Phase F392 — customer-impact-summary checkpoint:** Customer-impact summary remains required before post-release closeout.

**Phase F393 — audit-ready-archive checkpoint:** Audit-ready evidence archive remains required before operational acceptance.

**Phase F394 — acceptance sample-flow checkpoint:** Added a non-mutating Operational acceptance sample flow that returns `Blocked · no acceptance`.

**Phase F395 — final local operational-acceptance checkpoint:** F376–F395 complete the local operational-acceptance package. Operational acceptance remains blocked until owner acceptance, live SLO baseline, alerting, on-call coverage, residual-risk acceptance, rollback acceptance, customer-message approval, 24-hour review, seven-day review, customer-impact summary and audit-ready archive are supplied.

**F376–F395 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No owner accepted operation; no live SLO baseline was supplied; no support route, residual-risk acceptance, rollback acceptance, post-release review, operational acceptance, deployment, traffic change, publication or release publish was performed.

**Phase F396 — release-certification checkpoint:** Added a Release certification operations view that keeps final evidence completeness, approval ledger, exception disposition, audit archive and release record together before any ship-ready claim can be made.

**Phase F397 — live-evidence-bundle checkpoint:** Certification now requires a complete live evidence bundle before ship-ready status can be claimed.

**Phase F398 — production-preflight-reference checkpoint:** Production preflight evidence remains a certification requirement.

**Phase F399 — accessibility-proof checkpoint:** Deployed accessibility proof remains required before certification.

**Phase F400 — data-reconciliation-proof checkpoint:** Data/RLS reconciliation proof remains required before certification.

**Phase F401 — backup-restore-proof checkpoint:** Backup restore proof remains required before certification.

**Phase F402 — approval-ledger checkpoint:** Executive, council, publication, operational and support acceptance references remain required.

**Phase F403 — exception-disposition checkpoint:** Open exceptions require expiry, owner and disposition before certification.

**Phase F404 — residual-risk-owner checkpoint:** Residual-risk ownership remains required before certification.

**Phase F405 — rollback-acceptance checkpoint:** Rollback acceptance remains required before certification.

**Phase F406 — customer-impact-closeout checkpoint:** Customer-impact closeout remains required before certification.

**Phase F407 — release-manifest checkpoint:** Release manifest and candidate identity remain required before certification.

**Phase F408 — archive-checksum checkpoint:** Immutable archive checksum remains required before certification.

**Phase F409 — certifier-record checkpoint:** Named certifier, timestamp and final certification record remain required.

**Phase F410 — audit-handoff checkpoint:** Final audit handoff remains required before ship-ready status.

**Phase F411 — no-ship-ready-claim checkpoint:** The certification panel displays `Release certification: blocked` while live evidence, approvals, exception disposition, archive integrity and certifier record are incomplete.

**Phase F412 — certification sample-flow checkpoint:** Added a non-mutating Release certification sample flow that returns `Blocked · no certification`.

**Phase F413 — no-certifier-creation checkpoint:** The sample flow states that no ship-ready record was created by the demo.

**Phase F414 — certification responsive-layout checkpoint:** Certification grid and callout styling follow the existing operations console responsive behavior.

**Phase F415 — final local release-certification checkpoint:** F396–F415 complete the local release-certification package. Release certification remains blocked until live evidence bundle, approval ledger, exception disposition, residual-risk owner, rollback acceptance, customer-impact closeout, release manifest, archive checksum, named certifier and audit handoff are supplied.

**F396–F415 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No live evidence bundle was supplied; no approval ledger was completed; no exception disposition was certified; no certifier record, ship-ready claim, deployment, traffic change, publication or release publish was performed.

**Phase F416 — ship-authorization checkpoint:** Added a Ship authorization operations view that keeps go-live command authority separate from certification and actual release execution.

**Phase F417 — ship-owner checkpoint:** Ship authorization now requires a named ship owner before any command can be enabled.

**Phase F418 — command-approver checkpoint:** Command approver and operator remain required before ship authorization.

**Phase F419 — dry-run-evidence checkpoint:** Dry-run evidence remains required before command enablement.

**Phase F420 — execution-log checkpoint:** Execution log target remains required before ship authorization.

**Phase F421 — release-window checkpoint:** Approved release window remains required before ship authorization.

**Phase F422 — freeze-clearance checkpoint:** Freeze clearance remains required before command enablement.

**Phase F423 — customer-communication checkpoint:** Customer communication timing remains required before go-live authorization.

**Phase F424 — rollback-command checkpoint:** Rollback command and owner remain required before release command enablement.

**Phase F425 — first-hour-owner checkpoint:** First-hour watch owner remains required before ship authorization.

**Phase F426 — incident-route checkpoint:** Incident route remains required before command enablement.

**Phase F427 — rollback-trigger checkpoint:** Rollback trigger and decision owner remain required before ship authorization.

**Phase F428 — customer-impact-watch checkpoint:** Customer-impact watch remains required before ship authorization.

**Phase F429 — support-handoff checkpoint:** Support handoff remains required before command enablement.

**Phase F430 — command-log-archive checkpoint:** Command log archive target remains required before ship closeout.

**Phase F431 — closeout-timestamp checkpoint:** Closeout timestamp and evidence capture remain required before completion.

**Phase F432 — no-command-enable checkpoint:** The ship panel displays `Ship authorization: blocked` while command authority, go-live controls, rollback command and post-ship watch are incomplete.

**Phase F433 — ship sample-flow checkpoint:** Added a non-mutating Ship authorization sample flow that returns `Blocked · no ship authorization`.

**Phase F434 — ship responsive-layout checkpoint:** Ship authorization grid and callout styling follow the existing operations console responsive behavior.

**Phase F435 — final local ship-authorization checkpoint:** F416–F435 complete the local ship-authorization package. Ship authorization remains blocked until ship owner, command approver, dry-run proof, execution log, release window, freeze clearance, customer communications, rollback command, first-hour watch, incident route, customer-impact watch, support handoff, command archive and closeout evidence are supplied.

**F416–F435 verification:** Demo contract, syntax, static build, full local verification and checkpoint gates remain required. No ship owner was assigned; no command was enabled; no release window was approved; no shipment, deployment, traffic change, publication or release publish was performed.

**Phase F436 — Path B release-contract preparation:** Added a repository-local compliance contract that verifies the one-offer Premium catalog, monthly and annual Price-ID preflight, durable AI-disclosure capture/revocation before reviewed analysis, customer/operator consent controls, deferred partner/payout APIs, removal of the retired direct-checkout handlers, and the additive consent/RLS/append-only migration. The single-price checkout and webhook implementation was removed from the active portal runtime; the current two-price Premium billing module remains the only subscription path.

**F436 local verification:** The source contract includes regression cases for a removed disclosure guard and a restored retired price variable. API compilation, all 29 API tests, 32 infrastructure-contract tests, and web type checking passed locally. The refreshed local API returned `/healthz` and the existing `/membership` and `/account` routes returned HTTP 200. This is preparation for F436–F464 provisioning, not deployment, secret injection, a database migration, a provider call, or a production approval.

**Phase F437 — staging-target evidence contract:** Added a required `staging_evidence` ledger that binds an isolated HTTPS staging target, candidate commit, deployment reference, and immutable Node, Ollama, and Caddy image digests before evidence can be considered complete.

**Phase F438 — secret-injection evidence boundary:** The ledger now requires a platform-owned, non-secret proof of injection. Placeholder text and credential-like values, including database URLs with passwords and Stripe signing values, cause validation to fail.

**Phase F439 — artifact and service-health evidence:** The ledger requires an immutable artifact record and a health/readiness result for the exact candidate. It rejects mutable image values, mismatched candidate commits, non-HTTPS origins, invalid capture timestamps, and missing staged rollback references.

**Phase F440 — release-owned staging evidence ledger:** The final ship packet is now version `1.1` and fails closed unless all four F437–F440 rows have an accountable matching owner, action, expected and actual result, checksum, immutable reference, resolved blocker state, and rollback evidence. The generator and example create only visibly pending placeholders; no sample record is treated as staging evidence.

**F437–F440 local verification:** The new contract has rejection coverage for incomplete records, mismatched commit/image provenance, unresolved blockers, and credential-like text. All 36 infrastructure-contract tests passed locally. These phases prepare the staging handoff only; no deployment target, secret manager, database, provider, support route, or live evidence record was created.

**Phase F441 — staging-target isolation model:** Split the staging target into its own versioned contract. It requires an isolated HTTPS origin, candidate commit, immutable image digests, deployment reference, isolation reference, and non-secret injection reference before a staging package can be complete.

**Phase F442 — safe health/readiness probe:** Added `pnpm infra:staging-probe`, a read-only probe for an approved staging origin. It records only endpoint, HTTP status, bounded service status, timestamp, and duration for `/healthz` and `/readyz`; raw response bodies and credentials are never written to the probe artifact.

**Phase F443 — candidate attestation:** Added a versioned attestation that cross-checks the candidate commit, staging origin, immutable image digests, successful preflight report, and successful health/readiness probe. A mismatch, placeholder, mutable image, invalid checksum, or credential-like value blocks the ledger.

**Phase F444 — evidence-pipeline integration:** Ship-packet staging evidence now requires the target, probe, attestation, and existing F437–F440 owner/checksum/rollback records to agree. The draft generator and sample remain pending; no generated file or local mock can establish staging readiness.

**F441–F444 local verification:** Deterministic probe mocks verify successful and failed health/readiness results without network calls or response-body retention. Target, attestation, evidence-ledger, ship-packet, and generator tests reject inconsistent provenance and secret-like text. These controls do not select a host, deploy an image, inject a secret, or validate a live origin.

**Phase F445 — staging artifact manifest:** Added a versioned manifest for the six local artifacts that substantiate staging: deployment, isolation, secret injection, preflight, health/readiness probe, and shared rollback evidence. Each entry records a content SHA-256 checksum and byte count for the exact candidate.

**Phase F446 — safe artifact compilation:** Added `pnpm infra:staging-artifacts`, which derives a standalone staging ledger plus its manifest from a completed packet or ledger. It inspects only regular, bounded UTF-8 `.json`, `.log`, `.md`, and `.txt` files under `work/` or `infra/`, rejects traversal, links, binary files, placeholders, and credential-like text, and does not create a readiness or approval decision.

**Phase F447 — artifact provenance binding:** Ship-packet version `1.2` and staging-ledger version `1.2` require the manifest candidate and references to match the target and attestation. The preflight and probe checksums must match their attestation entries, and all F437–F440 records must identify one shared locally hashed rollback artifact.

**Phase F448 — redacted integrity review:** Added `pnpm infra:staging-review`, which validates the ledger and re-hashes every manifest entry without retaining source content. Its report contains only candidate identity, pass/fail checks, error counts, verified artifact IDs, and redacted errors; it exits unsuccessfully on any mismatch.

**F445–F448 local verification:** Temporary local fixtures prove manifest construction, checksum and byte-count verification, post-manifest file mutation detection, credential-like artifact rejection, and pass/fail redacted review behavior. These controls have not created a staging host, generated deployment evidence, injected a secret, contacted an external system, or approved a release.

**Phase F449 — canonical ledger review hash:** The staging review now includes a deterministic SHA-256 checksum over the canonicalized ledger, so a review cannot be reused after evidence values or their structure change. The review validator compares that checksum and candidate identity back to the exact ledger.

**Phase F450 — review freshness policy:** Review validation now accepts only a past review within an explicit 1–1440 minute freshness window, defaulting to 60 minutes. A stale, future, malformed, failed, incomplete, or non-zero-error review blocks handoff preparation.

**Phase F451 — local promotion handoff binding:** Added `pnpm infra:staging-handoff`, which independently reads and hashes the local ledger and review files, validates the ledger, review binding, candidate, and HTTPS staging identity, and records the two file checksums without copying their content.

**Phase F452 — human promotion separation:** The handoff output can only be `blocked` or `pending_human_promotion_approval`. It explicitly requires release and platform human approvals and cannot represent an approved, deployed, or traffic-changing state.

**F449–F452 local verification:** Temporary fixtures prove canonical review validation, fresh-review acceptance, stale-review blocking, ledger-checksum mismatch blocking, local file binding, and rejection of an invented approved handoff state. No staging target, deployment, credential, data migration, provider request, or human approval was created.

**Phase F453 — checksum-bound approval records:** Added versioned release and platform approval records. A valid record names a human approver, decision-record reference, past approval time, exact handoff checksum, and a future execution window; placeholder and credential-like values are rejected.

**Phase F454 — dual-control approval binding:** The authorization builder requires exactly one release and one platform approval, each bound to the same handoff. Missing, stale, malformed, duplicate, or checksum-mismatched approvals block the result.

**Phase F455 — shared bounded execution window:** Both approvals must independently record the exact same future window, with a maximum duration of four hours. This creates a reviewable scheduling boundary without initiating any deployment activity.

**Phase F456 — pending-only operator authorization:** Added `pnpm infra:staging-authorization`, which hashes the local handoff and approval files, validates all prior evidence, and can only output `blocked` or `pending_operator_execution`. The result contains no deployment, traffic, publish, or operator command.

**F453–F456 local verification:** Temporary local fixtures prove valid dual approval preparation, approval freshness enforcement, shared-window mismatch blocking, checksum binding, and rejection of an invented approved authorization. No external approval, staging deployment, credential injection, data change, traffic movement, or publication was performed.

**Phase F457 — non-secret execution receipt:** Added a versioned operator receipt template and validator. A recorded receipt names an operator, exact authorization checksum, past execution time, and a bounded local operation record without embedding a command, configuration value, or credential.

**Phase F458 — execution-window enforcement:** Receipt validation requires the recorded time to fall inside the exact shared authorization window. Out-of-window, malformed, future, or authorization-mismatched receipts fail closed.

**Phase F459 — post-operation probe binding:** The receipt binds a separately captured local `/healthz` and `/readyz` probe artifact. The verifier re-hashes the probe, validates its safe schema and staging origin, and requires it not to predate the recorded receipt time.

**Phase F460 — external-release-gate dossier:** Added `pnpm infra:staging-execution-review`, which independently reads the authorization, receipt, operation record, and post-operation probe. It can only output `blocked` or `awaiting_external_release_gate`, with the external production gate permanently pending and no executable release action.

**F457–F460 local verification:** Temporary local fixtures prove a valid evidence-only receipt and probe chain, out-of-window receipt blocking, and rejection of an invented published state. No real-world operation, host call, deployment, credential injection, traffic movement, or release approval was performed.

**Phase F461 — production target contract:** Added a separate production-gate contract requiring a production-only HTTPS origin, exact candidate commit continuity, immutable Node/Ollama/Caddy image digests, and a staging-dossier source reference. Staging origins are rejected.

**Phase F462 — production evidence matrix:** Added eight required production evidence rows covering target identity, candidate continuity, production preflight, readiness, customer smoke, data/RLS/backup, support/accessibility, and rollback/monitoring.

**Phase F463 — named production go/no-go record:** Added five required owner approvals for release, platform, data, support, and accessibility plus a named decision record. A `go` decision is rejected unless every evidence row and owner approval is `go`/`pass`.

**Phase F464 — fail-closed production gate review:** Added `pnpm infra:production-gate`, which reports only `blocked`, `held`, `pending_human_go_no_go`, or `go_recorded`. It does not deploy, publish, change traffic, or convert local evidence into live readiness.

**F461–F464 local verification:** Production-gate fixtures prove a complete matrix evaluation and rejection of staging origins, incomplete evidence, credential-like text, and fabricated readiness. No production origin, live evidence, human approval, deployment, traffic movement, or publication was performed.

**Phase F465 — production evidence artifact boundary:** Added `pnpm infra:production-evidence`, which can bind a completed production gate only to locally inspectable, bounded UTF-8 evidence files under `work/` or `infra/`. It refuses remote-only, placeholder, traversal, binary, oversized, or credential-like artifacts.

**Phase F466 — complete evidence matrix binding:** The manifest captures the staging dossier, each of the eight production evidence records and rollback records, five owner decision records, and the named go/no-go decision. Every production evidence-file checksum must agree with the checksum recorded in its gate row.

**Phase F467 — canonical production-gate integrity:** The manifest records a deterministic SHA-256 checksum of the complete production-gate document alongside the candidate and origin, preventing an artifact manifest from being reused after evidence, ownership, decision, candidate, or target changes.

**Phase F468 — re-verifiable production evidence:** The verifier re-hashes every bound artifact and fails when a file changes, disappears, becomes unsafe, or no longer matches its byte count. It records integrity only; it cannot validate an external host, make a go/no-go decision, deploy, publish, or move traffic.

**F465–F468 local verification:** Production-evidence fixtures prove a complete 23-artifact production manifest and reject modified, credential-like, and gate-detached artifacts. This is local evidence-integrity preparation only. No production origin, live evidence, human approval, deployment, traffic movement, or publication was performed.

**Phase F469 — release export manifest:** Added `pnpm infra:release-export`, which binds the accepted release documentation and optional local archive to the exact candidate commit. It records bounded file checksums and byte counts, rejects traversal, unsupported files, binary text, credential-like values, and oversized artifacts, and can remain `blocked` when a requested export input is missing or unsafe.

**Phase F470 — destination binding:** The export manifest records the observed GitHub remotes and candidate branch/commit as `pending_push`, and records a Google Drive file name with no invented folder, file ID, or URL as `pending_upload`. It does not claim that either destination has received the export.

**Phase F471 — shared export checksum:** The manifest derives one canonical bundle checksum across its candidate, entries, and destination declarations. Any destination receipt must therefore be tied to the same export contents instead of an independently assembled archive.

**Phase F472 — post-export verification:** The verifier re-hashes every local export entry and requires observed Drive metadata before an upload can be marked complete. A `pushed` GitHub destination must bind the exact candidate commit; an `uploaded` Drive destination must include the connector-observed file ID and HTTPS URL.

**F469–F472 local verification:** Export fixtures prove deterministic manifest creation, mutation detection, traversal and credential-like input rejection, and fail-closed destination completion rules. The export workflow prepares GitHub and Google Drive handoff metadata only; it does not fabricate an upload, publish a release, deploy, or change traffic.

**Phase F473 — GitHub push receipt contract:** Added a receipt review that accepts a GitHub confirmation only when the observed repository, branch, commit, and timestamp bind to the export manifest’s exact candidate.

**Phase F474 — Google Drive upload receipt contract:** The review accepts a Drive confirmation only with connector-observed file ID, HTTPS URL, archive checksum, byte count, and a past observation time. Missing browser or connector evidence remains pending.

**Phase F475 — dual-destination checksum binding:** GitHub and Drive receipts both bind to the same export bundle checksum, preventing a repository revision and Drive archive from silently diverging.

**Phase F476 — export completion review:** Added `pnpm infra:release-receipt`, which reports only `blocked`, `awaiting_receipts`, or `export_complete`. It cannot invent a push, upload, publication, deployment, or traffic change.

**F473–F476 local verification:** Receipt fixtures prove pending-only behavior, exact candidate and checksum binding, Drive metadata requirements, and rejection of fabricated completion. No external destination receipt was invented or recorded.

**Phase F477 — receipt freshness policy:** Closeout now requires each destination receipt to fall within an explicit 1–10080 minute freshness window.

**Phase F478 — archive revalidation:** The closeout contract revalidates the export manifest and receipt review before accepting the archive checksum, byte count, candidate, and bundle checksum chain.

**Phase F479 — pending-only release closeout:** Added a closeout dossier that reports `blocked`, `pending_receipts`, `stale_receipts`, or `release_closeout_ready`; it contains no publish, deploy, or traffic action.

**Phase F480 — closeout verifier:** Added `pnpm infra:release-closeout`, which fails closed when the receipt review is incomplete, stale, mismatched, or fabricated.

**F477–F480 local verification:** Closeout fixtures prove missing-receipt handling, fresh dual-destination acceptance, stale receipt blocking, and rejection of an invented ready state. No external release, publication, deployment, or traffic movement was performed.

**Exit evidence:** approved positioning and claims, consent-compliant measurement plan, attribution rules, partner terms where relevant, campaign cap and stop rule, baseline report, and a post-test decision grounded in observed data.

### Phase E — data, AI economics and service qualification (Critical for production)

1. Validate the authoritative Supabase/Postgres project, migrations, TLS, RLS, identity lifecycle, two-connection concurrency, retention and backup restoration.
2. Verify Ollama model inventory and hardware capacity; record latency, failure, schema-validity and fallback rates by task. Confirm provider-reported hosted usage and actual charges against reservations; configure provider-side spend limits.
3. Audit each telemetry field and log destination for minimization, retention and access. Keep customer prompt/skin-profile text out of aggregate operator reporting. Record consent version and purpose for any new collection.
4. Run staging evaluation for the reviewed task set, including source-grounding accuracy, prohibited health claims, refusals/handoff, output schema, adverse-event handling, retry behavior, model mismatch, uncertain billing and duplicate events.
5. Keep every key server-side. `OPENAI_API_KEY`, OpenClaw credentials (if any), Stripe secrets, Supabase service-role key, webhook tokens and signing secrets must never enter browser bundles, screenshots, logs or Git history. A ChatGPT subscription is not an API credential.

### Phase F — release gate and documentation synchronization (Critical)

1. Keep local verification, staging verification and production readiness as separate claims. Attach timestamped evidence to the exact commit.
2. Complete environment preflight, database/RLS and restore evidence, OpenClaw and provider qualification, approved catalog health, support delivery, billing sandbox (only if approved), browser/accessibility checks, immutable-image startup, `/readyz`, rollback and incident procedures.
3. Record remaining blockers and the release decision in `infra/portal/RELEASE-CHECKPOINT.md`; production stays **NOT READY** until all critical blockers close or a named owner approves a documented launch exception.
4. Update both canonical Markdown documents and the corresponding Google Docs from the same accepted source text. Preserve the original historical blueprint as historical. Verify Drive readback and repository diff after each update.
5. Commit the documentation with the code/evidence revision it describes; push only to the approved project branch. A future code change should receive its own implementation review and checkpoint.

## 4. Priority and dependency summary

| Priority | Work | Can start locally | Blocking dependency |
|---|---|---|---|
| Critical | Lock assistant roles, safety boundaries, evaluation cases and OpenClaw qualification checklist | Yes | OpenClaw runtime testing before enabling; SME review for product/ingredient content |
| Critical | Preserve current external-referral and payment boundary; specify subscription confirmation behavior | Yes | Separate commercial approval, Stripe sandbox, legal terms, webhook and database validation before any charge |
| Critical | Production data/identity/RLS/backup readiness | Prepare runbooks locally | Approved Supabase target and authorized staging access |
| High | Onboarding and support handoff behavior | Yes | Human support owner and any chosen helpdesk/email delivery provider |
| High | Consent-aware measurement and GTM experiment definitions | Yes | Approved claims, event purpose/retention, partner agreements for attributable revenue |
| Medium | Paid acquisition tests | Planning only | Funnel baseline, campaign cap, attribution, margin/fee evidence and explicit budget approval |
| Medium | Affiliate attribution or sponsored ranking | Contract/template preparation only | Written partner terms, disclosures, privacy review and product-ranking safeguards |

## 5. Release evidence checklist

- Exact commit, clean source diff and successful repository release checkpoint.
- Human-reviewed golden cases and per-task quality report, including evidence for source grounding and escalation/handoff.
- OpenClaw staging qualification report; production stays disabled until explicit enablement and rollback are recorded.
- Staging database/RLS/concurrency and backup-restore report.
- Provider inventory, model/version evidence, latency/error/fallback report and provider-billing reconciliation.
- Approved catalog coverage and content review.
- If subscriptions are approved: sandbox checkout, verified event, duplicate/replay, cancellation, failed payment, receipt/portal, ownership and operator audit evidence.
- Support delivery/handoff evidence and accessibility/browser journey report.
- Campaign measurement dictionary, baseline, cap/stop rule and post-test economics; no unverified profitability claim.
- Updated local Markdown and Google Docs readback, with unresolved conflicts labeled.

## 6. Current unresolved decisions

1. Whether the product remains referral-only for the next release or later adds a separately approved MGT subscription offer.
2. Whether OpenClaw will run as a constrained assistant and which target runtime/network/tool policy will be approved.
3. Which approved product/catalog and educational sources will ground customer answers.
4. Which human support owner and, if needed, transactional or marketing delivery service will be used.
5. Which partner agreements, permitted attribution terms and campaign budget cap are approved.
6. Which Supabase, hosting, backup and provider accounts will be used for staging and production.

Until these decisions and dependencies are evidenced, the plan remains planning material and the production release remains **NOT READY**.

## 7. Improved next build order

1. **Critical — policy sign-off and answer quality:** have an SME and privacy owner review the 18 engineering candidate cases in `apps/api/test/assistant-policy-cases.json`, add approved product and ingredient cases from the real catalog, and record acceptance criteria for false positives and unsupported claims. Keep deterministic handoffs before model routing and expand the matrix only with approved evidence.
2. **High — experience and accessibility:** complete full keyboard, screen-reader, mobile, contrast, and WCAG checks across onboarding and Support. Focus movement for guidance, error, and handoff is locally verified. Add a direct onboarding entry only if user testing supports it; keep the logo and page hierarchy intact.
3. **High — support operations:** define ticket ownership, escalation reason, response state and safe operator visibility. Configure external delivery only after a provider and owner are chosen; record delivery outcome rather than implying a message was sent.
4. **Critical — approved knowledge and runtime:** complete catalog/SME source coverage; run the existing gateway and optional OpenClaw path in staging with model inventory, privacy, timeout, schema, tool isolation, latency and rollback evidence. Keep `OPENCLAW_ENABLED=false` until the qualification decision.
5. **High — measurement:** instrument consent-aware assistant entry, helpful next-step selection and handoff completion through the analytics registry without storing message content. Establish a baseline before paid marketing tests.
6. **Blocked until business decision — live payments and campaigns:** retain retailer payment/receipt boundaries. The consumer Premium subscription implementation is repository-ready, but enabling enrollment still requires the approved two Prices, a connected sandbox/live account, signed-event evidence, terms and a support owner. Cap paid or affiliate experiments only after agreements and contribution metrics are available.
