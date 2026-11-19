# End-to-end production readiness review — 2026-10-31

## Scope and result

This is a source-and-local-build review of the MGT Skin Care web portal, API,
Android client, AI gateway, retail/billing boundaries, image handling, data
controls, and operations handoff. It is **not** a production deployment,
external-service validation, or approval to collect customer data.

The current working tree passed the complete local verifier on 2026-10-31:

- **1,360 / 1,360 assertions passed**
- Evidence: `work/verification/2026-10-31T21-47-50-237Z/report.md`
- The verifier covers builds, portal rendering and recovery flows, API/domain
  contracts, persistence/release regressions, credential scanning, accessibility
  source contracts, production-web compilation, proxy journeys, static build,
  and generated-public-artifact vendor scanning.

The source is ready to proceed through a controlled production handoff. It is
not ready to launch because no real production environment, accounts, approvals,
or live evidence have been supplied. The current production preflight correctly
fails closed with 58 missing configuration inputs rather than guessing values.

## Code-only work completed in this review

The portal's supported product-commerce model is external referral: the retailer
is the merchant of record and owns checkout, fulfillment, shipping, tax, and
returns. During the review, an older standalone API surface was found that could
otherwise create a direct Stripe PaymentIntent if a separate process were started
with a Stripe secret. Its cart and checkout routes now return
`retail_checkout_unavailable` in a production process and make no payment call.
They remain available for local verification only.

Focused evidence: `apps/api/test/retail-checkout-production-admission.cjs` passed
after the API build. This change prevents an accidental direct-charge path while
shipping, tax, fulfillment, returns, fraud, and merchant-of-record operations are
not implemented.

No other code-only launch blocker was found in the reviewed supported surfaces.
Further changes to live-provider behavior, direct commerce, photo cloud storage,
or AI routing require a product decision and external validation; implementing
them speculatively would weaken the existing release controls.

## Reviewed capability status

| Area | Current source status | What remains before production use |
| --- | --- | --- |
| Web portal | Built and locally verified: onboarding, profile, routine, account, support, privacy, AI disclosure, retail referrals, anti-aging, style, wardrobe, and admin/operator paths. | Deploy to a real HTTPS origin; run browser, accessibility, authenticated-session, and customer-journey tests against it. |
| API and data | API builds and its storage, access-control, deletion/export, webhook, operations, and integrity contracts are locally tested. Production admission fails closed. | Provision the real Supabase/Postgres target; apply/rehearse migrations; validate RLS, account lifecycle, backup/restore, and reconciliation against the target. |
| Android | Expo/EAS production configuration is guarded; no secret-shaped public variable is accepted. Android links to the signed-in portal for account/privacy controls. | Supply five approved public URLs, create a signed AAB through the MGT Expo account, complete device/staging tests, Play Console setup, store assets, Data safety declaration, and accountable approval. |
| AI | Existing local-first routing and safety/budget/telemetry controls are in source. The prior stack decision is preserved; no model route was silently changed in this review. | Qualify the exact installed Ollama models and any hosted fallback with the synthetic suite, capacity/load testing, consent and spend evidence, then record an approved routing decision. |
| Retail and subscriptions | Retail portal is referral-only. Subscription enrollment remains intentionally closed until Stripe product/prices, terms, signing, reconciliation, and sandbox evidence are complete. | Keep both direct retail checkout and subscriptions disabled, or provide the commercial, tax, fulfillment, Stripe, and legal inputs needed for their separate release tracks. |
| Images | Browser-device library and a deliberately isolated, non-production Google Drive test adapter exist. Images are optional and the test adapter is hard-disabled in production. | Approve a production image-storage architecture and conduct authorization, retention, deletion, restore, consent-withdrawal, content-safety, and cross-device tests. Native Android image picking is not yet a production capability. |
| Backup and operations | Source has worker/readiness, backup-attestation, alert, retention, incident, and recovery-evidence controls. | Configure a monitored alert route, execute an encrypted off-host restore drill, and retain candidate-bound evidence with named owners. |

## Exact external inputs and approvals

Supply these outside source control and through the approved secret manager. Do
not paste private keys, tokens, database URLs with credentials, OAuth refresh
tokens, webhook signing secrets, or service-role credentials into this repository,
the demo, a ticket, or this document.

### 1. Release ownership, hosting, and domain

1. Confirm the accountable release and support owners required by the existing
   admission controls.
2. Select the production hosting project/account and regional data location.
3. Provide the canonical production hostname, HTTPS origin, DNS/TLS completion,
   edge routing design, and immutable Node/API/web/Ollama/Caddy image digests.
4. Build and archive the exact release candidate from a clean, committed source
   state. The present working tree is intentionally not treated as a candidate.

### 2. Supabase, Postgres, and Google sign-in

1. Create or designate the production Supabase project and Postgres database.
2. Configure server-only references for the database, Supabase anonymous key,
   and service-role key; keep the service-role key out of the web and Android
   applications.
3. Decide whether Google sign-in is enabled, configure only exact approved
   redirects, and test a synthetic account through sign-in, sign-out, recovery,
   conflict handling, export, and deletion.
4. Apply the reviewed migration sequence outside automatic application startup;
   validate database identity, schema lineage, RLS isolation, and lifecycle
   behavior against the target.

### 3. Published customer notices and support

1. Publish distinct HTTPS Privacy Notice, Terms of Use, and AI Disclosure pages
   at the final public URLs.
2. Obtain accountable approval for the three published notices and retain the
   candidate-bound approval artifact.
3. Create the monitored support route, response target, escalation process, and
   accessible customer-contact path.
4. Run and archive deployed keyboard, screen-reader, mobile-browser, contrast,
   and WCAG evidence.

### 4. Operations, monitoring, and recovery

1. Provide monitoring dashboard and incident-runbook URLs, alert owner, and
   authenticated webhook delivery settings.
2. Configure worker interval/readiness thresholds and the production health-file
   location.
3. Configure encrypted off-host backups and retention. Execute an isolated
   restore drill, a failed-restore procedure, and a rollback rehearsal.
4. Record candidate-bound backup, restore, rollback, health, and alert evidence.

### 5. AI provider qualification

1. Preserve the existing local-first policy until an accountable routing decision
   is approved. Do not change model names merely because a model is installed.
2. Provide the private Ollama endpoint, exact immutable model identities, host
   capacity/concurrency limits, and model availability evidence.
3. Run the synthetic qualification suite with no customer data, review quality,
   safety, latency, failure behavior, and costs, and approve the route order.
4. If hosted OpenAI is enabled, provide the server-only key reference, billing
   owner, budget caps, and evidence that consent and fallback behavior work.

### 6. Commerce and subscriptions

1. For the current referral-only launch, confirm that MGT does not take product
   payment or fulfillment and keep direct product checkout unavailable.
2. If Premium subscriptions will launch, supply approved product and monthly/
   annual Stripe price IDs from the correct Stripe mode, webhook signing secret,
   legal approval, cancellation/refund policy, sandbox events, and reconciliation
   evidence. Otherwise keep `SUBSCRIPTIONS_ENABLED=false`.
3. A future direct retail checkout requires an explicit merchant-of-record,
   catalog/inventory, shipping, tax, returns, fulfillment, fraud, chargeback,
   customer-service, and compliance implementation. It is not part of the
   current release path.

### 7. Customer images and Google Cloud/Drive

1. Choose and approve the production image-storage provider, data region, legal
   basis, retention schedule, deletion workflow, recovery objective, and access
   model. The existing Google Drive integration is test-only.
2. Provision a least-privilege, server-side service identity and a private
   production storage location. Do not reuse a customer Google sign-in grant or
   the isolated test OAuth credential for production storage.
3. Complete synthetic-image tests for upload, download, authorization, quota,
   preview, deletion, account export, account deletion, restore, and consent
   withdrawal before allowing real customer images.

### 8. Android / Google Play release

1. Supply `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_PORTAL_URL`,
   `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`, and
   `EXPO_PUBLIC_AI_DISCLOSURE_URL` as final HTTPS URLs. The local Android gate
   currently rejects all five because no production values exist.
2. Configure Expo/EAS project ownership, Android signing, application IDs,
   release build access, and Play Console ownership.
3. Build a signed AAB, perform internal-track device testing, complete store
   listing materials and the final Data safety declaration, then obtain privacy/
   release-owner approval before submission.

## Recommended handoff order

1. Lock a clean candidate commit and produce current checkpoint/verification
   evidence.
2. Complete hosting, domain, and secret-manager setup; run the production
   preflight using private configuration only.
3. Stand up staging with production-shaped isolation, apply migrations, and run
   authenticated portal/API, database/RLS, accessibility, backup/restore, and
   monitoring tests.
4. Qualify AI and decide whether subscription billing and production image storage
   are in or out of the first launch.
5. Generate the candidate-bound prerequisite, environment, evidence, staging,
   and release-approval records already enforced by the repository.
6. Build the Android AAB only after the final public URLs and portal account/
   privacy paths are live in staging.
7. Seek the recorded launch approvals, then deploy through the existing release
   workflow. Do not treat a local green build as a deployment authorization.

## Current blockers, precisely

The latest `pnpm infra:preflight` run reports 58 missing production settings.
They group into ownership; origin/domain/policy URLs; database and Supabase;
edge token; immutable images; worker/backup/operations thresholds; support,
accessibility, monitoring, and alert delivery; AI provider declarations;
subscription declaration; and anti-aging feature declarations/retention. This is
expected with no production secret-manager context. It does not indicate a local
test failure or permission to substitute test values.

The latest Android production-config check is blocked only by the five final
public HTTPS URLs listed above. It also reports that the standalone mobile
package dependencies are not installed locally; that does not replace a real
EAS/Play build or device validation.

## What should not be done yet

- Do not deploy this dirty working tree or present its local evidence as a
  production release candidate.
- Do not enable subscriptions, direct retail checkout, production image storage,
  image analysis, provider booking, or live AI model changes without their
  specific approvals and live evidence.
- Do not add production secrets to GitHub, Google Drive archives, the static
  demo, Android public configuration, or any generated review packet.
- Do not treat the test Google Drive folder as a customer-image backup service.
