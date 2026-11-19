# Commercial sponsorship control review — 2026-11-03

## Scope and status

This review covers the optional Free-plan sponsorship capability in the MGT Skin
Care portal. It documents repository behavior and local verification only. It
does **not** approve merchant placement, enable the feature in production,
create an advertiser relationship, bill an advertiser, settle revenue, or
authorize a deployment.

The source remains fail-closed unless both the Omni Retail and sponsored-content
review controls are enabled in an approved production configuration. No customer
record, image, complexion field, health information, location, contact detail,
payment data, individual click history, purchase history, cart, or merchant-site
activity is used to select sponsorship.

## Implemented controls

1. Sponsorship is limited to Free-plan placements and carries a visible sponsor
   disclosure. The merchant remains the merchant of record for checkout, payment,
   delivery, returns, and merchant support.
2. Campaign copy is bounded and rejects medical, diagnosis, treatment, cure,
   prevention, guarantee, personalization, and acne claims. Destinations must be
   HTTPS, merchant-domain URLs without credentials, query strings, or fragments.
3. An approved campaign is bound internally to the exact merchant authorization
   reference current at the time of campaign review. The reference is never
   returned by the public sponsor or operator-safe projections.
4. Every placement and outbound action rechecks the current merchant record. A
   merchant pause, placement-mode change, malformed partner record, or changed
   authorization reference makes the campaign unavailable immediately. Changing
   an authorization reference requires recording the campaign again under the
   replacement reference.
5. The only sponsorship event stored is a daily aggregate outbound count per
   campaign and placement. It cannot identify a customer or establish that a
   purchase occurred, and it is removed by the bounded aggregate-metrics
   retention policy.
6. Merchant aggregate conversion reports are bound to the exact current merchant
   authorization reference at acceptance. A replaced authorization cannot reuse a
   prior report reference, and the authorization reference is excluded from safe
   operator summaries.
7. Campaign selection is deterministic: eligible campaigns are sorted and
   rotated once per UTC day. It is explainable non-personal rules, not an ad
   network, behavioral targeting system, or AI ranking of a customer.
8. Operator-safe campaign status exposes only whether the authorization remains
   current and whether a campaign is presently eligible to display. It does not
   expose authorization references.

## Intentionally not implemented

- Advertiser billing, invoicing, settlement, revenue recognition, and cost-cover
  claims.
- Direct retail checkout, cart, payment, fulfillment, shipping, tax, returns,
  affiliate attribution, customer purchase tracking, or merchant-site tracking.
- Production activation without external commercial, privacy, accessibility,
  disclosure, support, and merchant-authorization evidence.

## Required before any production activation

1. Record a current written merchant feature authorization and retain its
   controlled reference outside public responses.
2. Have a qualified operator review the exact campaign copy, placement, start/end
   dates, merchant-domain destination, disclosure, and current authorization.
3. Record the production release evidence required by the repository:
   `MGT_SPONSORED_CONTENT_ENABLED`, `MGT_SPONSORED_CONTENT_REVIEWED`,
   `MGT_SPONSORED_CONTENT_APPROVAL_REFERENCE`, and
   `MGT_SPONSORED_CONTENT_APPROVED_AT`, alongside approved Omni Retail controls.
4. Obtain the named commercial, privacy, accessibility, disclosure, and support
   approvals; preserve candidate-bound release evidence.
5. Validate the configured production environment and deployed flows. A local
   test result is not a release approval.

## Local evidence

- Complete verifier: `work/verification/2026-11-03T21-54-45-858Z/report.md`
- Result: 19 gates passed; 1,648 reported assertions passed.
- Focused API regression: `apps/api/test/sponsored-content.cjs` covers feature
  gating, campaign review, exact current-authorization matching, authorization
  replacement, withdrawal, aggregate-only metrics, and suppression of internal
  references from safe responses.
- Static demo checkpoint: `index.html` v4.410; its contract is checked by
  `infra/portal/demo-contract.test.mjs`.
