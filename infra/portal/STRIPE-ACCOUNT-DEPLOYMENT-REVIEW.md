# Stripe account and membership deployment review

Status: **review-gated.** The portal and application contain the account and subscription surfaces, but payments stay closed until this package passes for staging and production separately. This document never holds a Stripe secret, bank detail, customer data, or tax record.

## What is already built

| Segment | Customer experience | Operating boundary |
| --- | --- | --- |
| Account setup | Email or Google sign-in, profile preferences, consent, data export and deletion controls | A verified account is required for saved account data; the mobile app opens these controls in the secure portal. |
| Plan management | Free, Guided, and Studio comparison; period-end downgrades; annual prepaid upgrades apply provider proration | Team47 schedules plan changes; only confirmed signed Stripe events grant paid access. |
| Payment support | Stripe-hosted Checkout and customer portal for payment method, invoice history, and cancellation | No card number or security code is accepted or retained by Team47. |
| Reconciliation | Idempotent, signature-verified webhook receipts; plan/status re-read from Stripe | Browser completion is never treated as payment confirmation. |
| Vendor and retailer support | Retail purchases stay with the retailer; Team47 customer care helps identify the right handoff | Consumer memberships are separate from vendor invoices, retail checkout and payouts. |

## Required Stripe account configuration

Use an MFA-protected Stripe Dashboard owned by the authorized business. Complete the account’s legal-business, bank-payout, tax and support settings privately. Do not put that information in this repository, Drive, chat, Terraform state, or release evidence.

Create one Team47 Studio subscription product and four active recurring USD prices:

| Customer tier | Cycle | Repository variable |
| --- | --- | --- |
| Guided | Monthly | `STRIPE_PREMIUM_MONTHLY_PRICE_ID` |
| Guided | Annual | `STRIPE_PREMIUM_ANNUAL_PRICE_ID` |
| Studio | Monthly | `STRIPE_STUDIO_MONTHLY_PRICE_ID` |
| Studio | Annual | `STRIPE_STUDIO_ANNUAL_PRICE_ID` |

All four prices must use the same product identifier (`STRIPE_PREMIUM_PRODUCT_ID` is the legacy internal variable name) and must remain distinct. The system checks this against Stripe before it offers enrollment.

Configure a Stripe Customer Portal with payment-method updates, invoice history, and cancellation enabled. Leave subscription updates disabled: the Team47 Account flow owns change timing so monthly changes wait for the end of the paid period and eligible annual upgrades use provider proration. This matches the product promise and avoids competing plan-change paths.

Configure one signed event destination per environment at the exact URL:

```text
https://<same-portal-origin>/webhooks/subscriptions
```

Subscribe it to `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `invoice.paid`, and `invoice.payment_failed`. The application validates the Stripe signature on the raw request body and re-reads the subscription before it updates account access.

## Secure configuration and release candidate

1. Copy `stripe-subscription-review.template.json` outside the repository or to an ignored environment folder. Replace placeholders with non-secret IDs and **Secret Manager references only**.
2. Store the Stripe API key and the event-destination signing secret as separate explicit-version Secret Manager entries. Map those references only to the API runtime; do not give the web or mobile app access to either value.
3. Put the reviewed non-secret IDs in the API runtime configuration, set `SUBSCRIPTIONS_ENABLED=true`, `SUBSCRIPTION_TERMS_APPROVED=true`, and set `STRIPE_LIVE_MODE=false` for staging. Bind only `STRIPE_SECRET_KEY` and `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` to the API runtime.
4. Run the local review gate. It emits a redacted report with identifier fingerprints rather than full IDs:

```powershell
node infra/portal/stripe-subscription-readiness.mjs <private-review-config.json> <redacted-report.json>
pnpm infra:preflight
pnpm test:application
```

5. In Stripe test mode, verify account sign-in, Free/Guided/Studio comparison, a Checkout session, duplicate submission handling, customer-portal payment method/invoice/cancellation pages, each webhook event, scheduled downgrade, annual upgrade credit, and a declined payment. Record results as redacted evidence.
6. Build digest-pinned images and prepare the Terraform plan with `deploy_application=true`. This is the deployment boundary: do **not** apply or enable `SUBSCRIPTIONS_ENABLED` in production until the report, test evidence, terms approval, pricing approval, rollback owner, and production review are signed off.
7. For production, repeat the package with `environment=production`, `stripe_live_mode=true`, `live_mode_reviewed=true`, production-only price IDs and production-only secret references. Run a controlled live validation after deployment before opening public enrollment.

## Review hold

This repository remains deliberately fail-closed. The current production environment should retain `SUBSCRIPTIONS_ENABLED=false` and no Stripe secret bindings until the owner approves the candidate. A completed review configuration is release evidence—not authorization to deploy.

Stripe’s guidance supports using a server-created Checkout Session for existing customers and confirms that fulfillment should follow asynchronous events rather than the browser redirect. Its customer portal supports payment-method and invoice-history configuration. See [Stripe Checkout for existing customers](https://docs.stripe.com/payments/existing-customers) and [Customer Portal configuration](https://docs.stripe.com/api/customer_portal/configurations/create).
