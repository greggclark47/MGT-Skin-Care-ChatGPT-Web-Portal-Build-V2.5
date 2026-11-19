# Stripe Dashboard onboarding checklist

Status: **operator action required; application integration is ready for staged verification.**

This checklist is the safe handoff between the Team47Studio codebase and the authorized Stripe Dashboard owner. Record only completion dates, non-secret Stripe object IDs in the private review configuration, and redacted evidence references. Never record API keys, webhook signing secrets, bank information, tax IDs, customer information, or Dashboard screenshots containing those values.

## 1. Secure the business account

- [ ] Sign in to the Team47 Studio Stripe account with the authorized business owner.
- [ ] Enable multi-factor authentication for every Dashboard user and confirm least-privilege roles.
- [ ] Complete Stripe's private business, payout, tax, support, and public-statement settings.
- [ ] Confirm the live-account activation status privately. Do not enable live enrollment yet.

## 2. Create the subscription catalog in test mode

Create a single Team47 Studio membership product with four recurring USD prices. Keep the exact approved amounts and tax treatment in Stripe and the private commercial approval record.

| Tier | Billing cycle | Required private configuration key |
| --- | --- | --- |
| Guided | Monthly | `STRIPE_PREMIUM_MONTHLY_PRICE_ID` |
| Guided | Annual prepaid | `STRIPE_PREMIUM_ANNUAL_PRICE_ID` |
| Studio | Monthly | `STRIPE_STUDIO_MONTHLY_PRICE_ID` |
| Studio | Annual prepaid | `STRIPE_STUDIO_ANNUAL_PRICE_ID` |

- [ ] All four prices are active, recurring, USD, and distinct.
- [ ] All four prices belong to the same membership product.
- [ ] Annual pricing and immediate-upgrade credit policy have commercial approval.
- [ ] Record only the product and price IDs in the private review configuration; no keys or customer data.

## 3. Configure Stripe-hosted customer journeys

- [ ] Configure Customer Portal: payment-method updates, invoice history, and cancellation enabled.
- [ ] Keep Customer Portal subscription updates disabled. Team47Studio controls period-end downgrades and eligible annual upgrade credits.
- [ ] Create one test-mode event destination for `https://<staging-origin>/webhooks/subscriptions`.
- [ ] Subscribe to the eight required events listed in `STRIPE-ACCOUNT-DEPLOYMENT-REVIEW.md`.
- [ ] Put the event signing secret in Secret Manager as a server-only, explicit-version secret. Put the Stripe test secret key in a separate server-only secret.

## 4. Verify staging before requesting live mode

- [ ] Set only staging API runtime values: test-mode price IDs, server-only secret references, `SUBSCRIPTIONS_ENABLED=true`, `SUBSCRIPTION_TERMS_APPROVED=true`, and `STRIPE_LIVE_MODE=false`.
- [ ] Use the private copy of `stripe-subscription-review.template.json` and run the redacted readiness report.
- [ ] Test account sign-in, Free/Guided/Studio selection, hosted Checkout, customer portal, duplicate submission, declined payment, each signed event, period-end downgrade, and annual upgrade credit.
- [ ] Store redacted test evidence and rollback owner approval outside public source control.
- [ ] Return staging subscriptions to disabled until the release package is approved.

## 5. Production release gate

Only after a signed production decision:

- [ ] Create the matching live-mode product/prices and event destination on the production portal origin.
- [ ] Store live secrets only in production Secret Manager; use production-only price IDs and references.
- [ ] Produce a passing production readiness report with `stripe_live_mode=true` and `live_mode_reviewed=true`.
- [ ] Deploy with subscriptions closed, execute one controlled live validation, verify webhook reconciliation, then authorize public enrollment.

## Customer and partner boundaries

- Stripe is used only for Team47 Studio membership billing.
- Team47 Studio does not accept or retain card numbers or security codes.
- Retailer purchases, shipping, refunds, and vendor payouts remain on the external vendor's systems.
- Customer profile data and client images are not sent to retailers or Stripe for the purpose of subscriptions.

## Completion record

When the Dashboard work is complete, provide the release operator with: environment, portal origin, product ID, four price IDs, Secret Manager reference names/versions, event-destination verification date, redacted test-evidence location, terms/pricing approval reference, and rollback owner. Do not share secret values.
