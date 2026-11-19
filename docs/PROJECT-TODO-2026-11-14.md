# Team47Studio project tracker

Updated: 2026-11-16 EST
Release posture: **development candidate verified; production expansion remains review-gated.**

Latest local readiness snapshot: 2026-11-16 17:14 EST. The secret-free checker correctly remains blocked without the private production configuration, immutable release-image declarations, target Supabase evidence, backup/restore evidence, deployed accessibility evidence, and named approvals. The final local suite passed 18 executed gates, one generated-artifact scan, and 1,704 reported assertions. Subscriptions remain disabled pending the separate Stripe review package; Free access, Guided-only 14-day trial behavior, and Studio paid enrollment are implemented but not activated.

## Completed in the current candidate

- [x] Three-tier membership model shared across portal and mobile: Free, Guided, and Studio.
- [x] Account setup, account profile, consent, export, deletion request, image-management, and customer-care entry points.
- [x] Free entry path; Guided and Studio plan comparison; monthly/annual selection; end-of-period changes; annual-upgrade credit flow.
- [x] Stripe-hosted Checkout and Customer Portal integration boundaries, signed webhook reconciliation, duplicate-event controls, and asynchronous Checkout-event handling.
- [x] Review-gated Stripe activation package with explicit Secret Manager references only.
- [x] Web production build, mobile type/contract checks, subscription/billing regressions, full application regression, and credential scan.
- [x] Reconciled transfer-packet, API, web, mobile, terms, and demo subscription language around Free permanent access, a Guided-only 14-day trial, Studio paid enrollment, and annual two-month savings.
- [x] Corrected the preproduction policy helper so it distinguishes implemented membership workflows from still-required Stripe activation evidence.

## Development work remaining

- [ ] Load an approved production product catalog and independently approve ingredient/claim rules.
- [ ] Complete the approved editorial knowledge set and its publication workflow.
- [ ] Complete real-device Android/iOS acceptance evidence after signing credentials and store accounts are available.
- [ ] Connect an approved external customer-support delivery channel and test staffed handoffs.
- [ ] Complete approved retail-partner data-sharing, attribution, settlement, and support-acceptance contracts.
- [ ] Qualify approved AI provider/model routing, data retention, spend controls, and latency/error budgets using the target environment.

## Production evidence and activation work

- [ ] Run Supabase migrations against the approved target; independently validate RLS, OAuth, recovery, deletion, replay rejection, and two-account isolation.
- [ ] Complete encrypted off-host backup and isolated restore drill with accepted RPO/RTO evidence; keep `/readyz` fail-closed until then.
- [ ] Complete a deployed WCAG 2.2 AA desktop/mobile audit for the release candidate.
- [ ] Complete Stripe Dashboard business verification, tax/refund/dispute/support settings, and approved Guided/Studio monthly and annual prices.
- [ ] Configure Stripe Customer Portal and signed event destination; store only the two production secret values in Google Secret Manager.
- [ ] Execute the Stripe test-mode matrix, then controlled live-mode validation, and attach reconciliation evidence.
- [ ] Complete Android signed build, internal testing, Data Safety, content-rating, store screenshots, and policy evidence.
- [ ] Name and record required support, incident, accessibility, commerce, data, mobile, and final-release approvers.
- [ ] Obtain reviewed release authorization before any production subscription enablement, DNS/TLS alteration, or traffic change.

## Explicit holds

- **Do not enable** `SUBSCRIPTIONS_ENABLED`, Stripe live mode, or public enrollment until the Stripe review package and production evidence are accepted.
- **Do not change** Cloudflare DNS/TLS, public traffic, secret values, or Supabase data solely from this checklist.
- **Do not treat** local tests, documentation, or a review record as a live-provider validation or release authorization.

## Next safe sequence

1. Produce an approved product/catalog and policy input packet.
2. Complete staging Supabase migration/RLS and backup/restore evidence.
3. Complete Stripe test-mode configuration with the review-gate report and test matrix.
4. Build signed mobile candidates and collect real-device/accessibility evidence.
5. Review the candidate-bound evidence bundle and decide whether to authorize staging deployment.
