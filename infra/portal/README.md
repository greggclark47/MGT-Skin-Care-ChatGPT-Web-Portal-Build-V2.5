# Backend and subscription infrastructure — September 7, 2026

## Implemented
- Existing customer tabs use /api/hub: profile/matching, routine simplification, saved retailer destinations, reminders, knowledge, coach, session/account, and support.
- Administration pages now call the same verified-session API. A typed user ID no longer supplies identity. Roles must be provisioned in the accounts record by an operator. No public role-grant endpoint exists.
- Consumer and vendor subscription placements share /membership but have separate Stripe Price IDs, customer records, checkout attempts, and status records.
- Product checkout, payouts, refunds and vendor transfers remain blocked. Buying a vendor subscription does not establish a commercial partnership or publish a listing.
- Subscription pricing and paid feature entitlements remain TBD. No existing tab is paywalled, and no paid benefits are promised yet.

## Stripe setup
1. Use a Stripe sandbox/test account first. Create separate recurring consumer and vendor Prices after prices and benefits are approved.
2. Set STRIPE_CONSUMER_PRICE_ID and STRIPE_VENDOR_PRICE_ID. Set STRIPE_SECRET_KEY server-side only.
3. Configure the Stripe customer portal for payment methods, invoices and cancellation. Set business identity and terms URL in Stripe.
4. Register /webhooks/subscriptions on the API (the included edge configuration forwards it). Subscribe to checkout.session.completed and customer.subscription.created, updated and deleted. Store its signing secret in STRIPE_SUBSCRIPTION_WEBHOOK_SECRET.
5. Finalize company legal_name, support_email and policies_published in settings/company, then set SUBSCRIPTION_TERMS_APPROVED=true and SUBSCRIPTIONS_ENABLED=true.
6. Test checkout, decline, renewal failure, cancellation, portal access and replayed events in the sandbox before configuring live credentials. Browser return URLs never activate access.

Current local tests use a mocked Stripe client with real signature verification. No Stripe account has been provisioned, prices created, payments collected, or live webhooks validated.

## Deployment scaffold
Copy infra/portal/env.example to infra/portal/.env and fill service values outside source control. DATABASE_URL credentials must be URI-encoded if using reserved characters. Run Docker Compose from infra/portal after assigning a domain with DNS pointing at the host. Only the TLS edge publishes host ports. Database storage and TLS certificates use named volumes. API uses PostgreSQL in production and refuses demo mode or HTTP public origins. Web-to-API forwarding is set at build time.

Dockerfiles and Compose are prepared but have not been container-built or deployed here. Pin image digests and review network/secret management in the deployment environment. The portal applies its own checked-in migrations from `infra/portal/migrations` and records them in `portal_schema_migrations`; the older phase SQL migrations remain separate and must not be mixed into this adapter. The generic hub_records adapter now uses short, record-scoped advisory locks for concurrent changes instead of a single global database lock.

## Local-first AI setup
The portal uses one shared gateway. Ollama is the default runtime for high-frequency tasks, DeepSeek runs as the local reasoning fallback through Ollama, OpenClaw can be enabled as an Ollama-compatible orchestration endpoint, and GPT-5.6 Sol is the opt-in escalation for explicitly entitled premium work. LangChain Core bounds and serializes the retrieved context; it does not create an additional model call. Routing telemetry and daily AI spend caps are persisted through the same Supabase/Postgres store as the portal, rather than resetting on an API restart.

The Compose file includes Ollama with a persistent model volume. After starting the stack, pull only the models needed by the current feature set:

```text
docker compose up -d postgres ollama
docker compose exec ollama ollama pull llama3.2:3b
docker compose exec ollama ollama pull deepseek-r1:8b
docker compose exec ollama ollama pull nomic-embed-text
docker compose exec ollama ollama pull llava:latest
docker compose up -d api web edge
```

Keep `OPENCLAW_ENABLED=false` until the OpenClaw-compatible endpoint has been installed and tested. Hosted OpenAI escalation is optional; keep its key unset to run the portal entirely on the local stack. Supabase remains the identity and production data system of record: provide its Auth URL/key and a production PostgreSQL connection in the server environment only.

## Tab coverage and remaining external setup
| Area | Backend | Remaining |
|---|---|---|
| Applications | Navigation | None for navigation |
| Skin Match / My Skin / Routine | Persistent profile and rules matching | Approved product and ingredient data |
| Shop / Saved | Allowlisted retailer links; saved destinations | Negotiated vendor agreements |
| Replenishment | Persistent reminders, durable in-app notifications and optional HTTPS webhook delivery | Configure a delivery channel and test it with real recipients |
| Coach | Reviewed-library local-first gateway with Ollama, DeepSeek fallback, LangChain context pipeline and Supabase-backed telemetry | Ollama models, reviewed content, optional hosted escalation validation |
| Learn | Approved knowledge records | Editorial publishing |
| Account | Supabase OTP and secure cookie session | Auth provider and email delivery |
| Support | Requests and admin replies | External helpdesk delivery and staffing |
| Plans & Billing | Stripe checkout, portal and signed status webhooks | Both plan prices, benefits, terms and Stripe setup |
| Admin | Session roles, knowledge/rule drafting and approval, support replies | Operator role provisioning; full product management UI remains incomplete |
| Company / policies / partners | Existing informational routes | Final legal content and agreements |

## Operations worker and backup verification
Compose now runs a separate worker every 60 seconds. It expires sessions and stale rate limits, retains AI-routing logs, notifications, billing activity and run records according to the environment settings, creates one durable replenishment notification per due reminder, and delivers it in-app by default. Set `NOTIFICATION_DELIVERY=webhook` only after configuring an HTTPS endpoint and token; failed deliveries are leased and retried up to three times without duplicate delivery.

The worker does not create database dumps itself: automatic unencrypted database dumps on the app host are not an acceptable production backup design. Use an encrypted, off-host PostgreSQL backup service with a tested restoration procedure. A superadmin or compliance operator records each verified backup through `POST /api/hub/admin/backup/verified` with its completion time, storage identifier and checksum. The worker exposes that proof on readiness and marks it stale after `BACKUP_MAX_AGE_HOURS` (26 by default). This makes a missing backup visible without placing storage credentials in the portal.

Run `pnpm --filter @mgt/api test:operations` for the worker regression smoke. Request and webhook reconciliation dashboards, deletion execution, a live notification provider and a real restore drill still require environment-specific implementation and validation. No claim of complete production readiness is made.

Validation: API compilation, web build, existing referral suite and new billing suite. Remaining: real Stripe sandbox lifecycle, production PostgreSQL, container startup, browser interactions and deployment.

## Trial and billing-cycle update
New eligible consumer and vendor subscriptions use a 14-day free trial with payment_method_collection=always. The first paid billing period begins at trial end. No upfront subscription payment is collected. Trial eligibility is once per signed-in account and subscription audience, based on stored history and Stripe subscription history.

Configure monthly and annual recurring Price IDs using STRIPE_CONSUMER_MONTHLY_PRICE_ID, STRIPE_CONSUMER_ANNUAL_PRICE_ID, STRIPE_VENDOR_MONTHLY_PRICE_ID and STRIPE_VENDOR_ANNUAL_PRICE_ID. The older CONSUMER_PRICE_ID and VENDOR_PRICE_ID remain monthly fallbacks. Monthly Prices must recur every month and annual Prices every year, interval_count=1. Prices remain TBD; no prices were created.

The app creates a restricted Stripe billing-portal configuration: cancellations at period end, payment methods and invoices enabled, paid subscription price changes limited to that audience's configured Prices with Stripe confirmation and prorated invoicing. Trial-cycle changes use a separate authenticated endpoint, leaving trial_end untouched and creating no prorations. Trial subscriptions cannot change Prices through the billing portal because that could end a trial early. During a trial, cancellation ends access at trial end without starting the paid cycle. In a paid period, access remains until the end of that period. Payment failures can still suspend access according to subscription status.

Configure Stripe trial reminder emails and cancellation/renewal notices, publish matching terms, and use Stripe test clocks to validate trial-to-paid transitions, monthly and annual renewals, declines and end-of-period cancellation before launch. These transitions have mocked regression coverage here, not a live Stripe sandbox verification.
