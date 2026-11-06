# Team 47 Studio Phase 4–5 implementation and activation guide

## Implemented in the application

- Existing Stripe-hosted Checkout remains the consumer subscription entry point. The application never receives raw card data.
- The Stripe Customer Portal remains the self-service location for plan changes, payment methods, invoices, and cancellation at the end of the billing cycle.
- Signed Stripe subscription webhooks reconcile Checkout, subscription changes, paid invoices, and failed subscription invoices before access changes.
- API usage billing records approved Stripe meter events with a stable idempotency identifier. Duplicate retries cannot double-count a locally accepted event.
- B2B billing requires a locally approved business-to-Stripe-customer link. Invoice creation is draft-only with `auto_advance=false`; the application cannot finalize, email, or charge from this workflow.
- Customer care, social, marketing, and retailer agents create drafts only. Every draft has a human review state; approval does not publish, email, scrape, contact a retailer, or write to an external lead system.
- The requested GTM model remains recorded as `gpt-4o`, but that agent is blocked because the model is deprecated. Activation requires an explicit supported replacement decision.

## Stripe activation steps requiring the corporation owner

1. Create or complete the Stripe account using the Georgia corporation's exact legal name, EIN, registered business address, authorized representative, business bank account, and support details. Do not place these values in Git, Google Drive build archives, application logs, or this repository.
2. Complete Stripe identity, business, bank, statement descriptor, tax, refund, dispute, and support verification in the Stripe Dashboard.
3. Create the approved Guided and Studio products and monthly/annual prices. Annual prices must equal ten monthly payments to provide two months free.
4. Configure the Customer Portal to permit payment-method updates, invoice history, plan movement, and cancellation at period end.
5. Create a Stripe Billing Meter for the approved developer API unit. Record its exact event name in `STRIPE_API_METER_EVENT_NAME`.
6. Decide whether B2B invoices use Stripe Tax, which entity issues invoices, payment terms, supported currencies, and who may finalize/send drafts.
7. Configure the production webhook endpoint `/webhooks/subscriptions` for Checkout, subscription, invoice-paid, and invoice-payment-failed events. Store the signing secret in Google Secret Manager.
8. Run Stripe test-mode scenarios for new subscription, trial, monthly/annual movement, renewal, payment failure, recovery, cancellation, duplicate event delivery, meter retry, and draft invoice review.
9. After legal, tax, support, accessibility, security, and test evidence is approved, set the production flags and secret references. Never copy literal production secrets into an environment file retained in Git or Drive.

## Production configuration

```text
SUBSCRIPTIONS_ENABLED=true
SUBSCRIPTION_TERMS_APPROVED=true
STRIPE_LIVE_MODE=true
STRIPE_SECRET_KEY=<Google Secret Manager reference>
STRIPE_SUBSCRIPTION_WEBHOOK_SECRET=<Google Secret Manager reference>
STRIPE_USAGE_BILLING_ENABLED=true
STRIPE_API_METER_EVENT_NAME=<approved Stripe meter event name>
STRIPE_B2B_INVOICING_ENABLED=true
```

Product and Price IDs remain required as documented in `infra/portal/env.example`.

## Agent activation steps requiring external approval

1. Approve a supported OpenAI replacement for the deprecated `gpt-4o` GTM assignment, with a current model ID, pricing record, data-use review, evaluation set, and rollback plan.
2. Qualify the pinned Qwen, DeepSeek, and OpenClaw artifacts against Team 47 Studio safety, privacy, schema, latency, and cost tests before production activation.
3. Approve Google Drive folders and least-privilege read access for reviewed GTM inputs. The current workflow accepts source references but does not automatically read arbitrary Drive content.
4. Configure Gmail only for draft creation first. Sending requires separate campaign approval, consent/suppression checks, unsubscribe handling, sender authentication, rate limits, and a delivery audit record.
5. Obtain each social network's developer access and approve per-network publishing policy. Start with draft export; do not enable automatic posting or replies until moderation, rollback, and account-compromise controls pass.
6. Use licensed, authorized retailer lead sources only. Do not scrape sites or contact a lead automatically. Import minimum necessary business contact data for human review, document the source and lawful basis, and honor suppression requests.
7. Approve the Google Sheet/Drive export destination and schema. Export only reviewed business-lead fields; exclude customer profiles, photos, health-adjacent data, payment data, and private prompts.

## Release evidence required

- Stripe business verification and bank confirmation (kept in the restricted system of record, not source control)
- Approved price catalog and annual-value check
- Webhook signature and duplicate-delivery test evidence
- Usage meter definition and unit contract
- B2B invoice/tax owner approval
- Agent model qualification results and exact model digests
- Human-review and no-side-effect regression results
- Gmail/social/lead-source permissions and privacy review
- Incident, rollback, monitoring, retention, and deletion evidence
