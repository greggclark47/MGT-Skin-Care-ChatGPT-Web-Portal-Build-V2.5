# Team 47 Studio production activation packet

Prepared: 2026-11-06

Domain: `team47studio.com`
Status: local implementation complete; paid-account, DNS, billing, identity, and production-data decisions remain owner controlled.

## Executive decision

The application is prepared for a local-first AI route on the workstation's RTX 5080:

1. DeepSeek R1 8B through local Ollama.
2. Qwen 3.5 4B through local Ollama.
3. Optional OpenClaw-compatible local route.
4. Optional, metered Ollama Cloud Pro fallback using `deepseek-v4.1-flash`.
5. Optional ChatGPT/OpenAI final fallback.

Ollama Cloud and OpenAI are disabled unless an entitled account request reaches the fallback, the matching feature toggle is enabled, and a distinct server-side secret is present. Images remain local-only. The router reserves budget before a hosted request and rejects an unpriced or unverifiable hosted response.

No subscription was purchased, no cloud credit was consumed, no DNS record was changed, and no cloud resource was created during this preparation.

## Current local readiness

| Item | State | Evidence or next action |
|---|---|---|
| Ollama local service | Ready | Installed locally; DeepSeek, Qwen, and embedding models are present. |
| RTX 5080 local inference | Ready | Local model path previously tested. |
| Ollama Cloud adapter | Ready but disabled | Native `/api/chat` adapter, bearer authentication, pricing, budget, entitlement, and telemetry gates implemented. |
| Ollama Cloud Pro account | Owner action | Choose monthly or annual billing, sign in, and create an API key. |
| Google Cloud AI module | Prepared, not applied | `infra/gcp/phase3-ai` supports private local-model infrastructure plus optional Ollama Cloud Secret Manager injection. |
| Google Cloud CLI | Not installed | Approval is needed before installing and authenticating it. |
| Terraform | Not installed | Approval is needed before installation; no infrastructure plan or apply has run. |
| Docker Desktop | Not installed | Needed for local image builds unless Cloud Build is selected instead. |
| Cloudflare connector | Installed | DNS access and change approval are still required. |
| Supabase production region | Not confirmed | Confirm before selecting the final GCP region. |

## Approval 1 — Ollama Cloud Pro

Current Ollama pricing lists Pro at **$20 per month** or **$200 per year**, including monthly usage credits. Local model execution remains the primary route and does not consume cloud credits. Source: [Ollama pricing](https://www.ollama.com/pricing).

Recommended first decision: use the monthly plan for qualification, set a conservative spend alert, and move to annual only after the first billing cycle confirms quality, privacy, and volume.

Owner steps:

1. Open [Ollama pricing](https://www.ollama.com/pricing) and select Pro monthly or Pro annual.
2. Complete the purchase using the Team 47 Studio business identity and approved payment method.
3. On the local workstation run `ollama signin` and complete the browser sign-in. Do not share the session token.
4. Open [Ollama API keys](https://ollama.com/settings/keys) and create a production server key.
5. Do not paste the key into chat, GitHub, source code, Google Drive, or a tracked `.env` file.
6. For local qualification, place it only in an untracked local environment file as `OLLAMA_CLOUD_API_KEY`.
7. For staging/production, add the value directly to Google Secret Manager under the prepared secret ID `team47-ollama-cloud-api-key`.
8. Set `OLLAMA_CLOUD_ENABLED=true`, `OLLAMA_CLOUD_BASE_URL=https://ollama.com`, and `OLLAMA_CLOUD_MODEL=deepseek-v4.1-flash` only in the server/API runtime.
9. Run one synthetic, non-customer prompt through `deepseek-v4.1-flash:cloud`; verify the model ID, token usage, cost telemetry, and fallback order.
10. Keep customer images excluded from the hosted route.

Published model pricing used by the application is $0.30 per million input tokens and $1.20 per million output tokens. The router conservatively charges ordinary input at the uncached rate. Source: [DeepSeek V4.1 Flash on Ollama](https://ollama.com/library/deepseek-v4.1-flash).

## Approval 2 — Google Workspace

Recommended edition: **Google Workspace Business Standard**. As of 2026-11-06, the standard US rate is $16.80 per user/month on Flexible or $14 per user/month with an annual commitment. Standard provides 2 TB pooled storage per user and the Shared Drive administration needed by this design. The annual plan is less expensive but remains payable for the commitment term. Sources: [Google Workspace business editions](https://knowledge.workspace.google.com/admin/getting-started/editions/business-editions), [billing plan comparison](https://knowledge.workspace.google.com/admin/billing/compare-flexible-and-annual-fixed-term-payment-plans).

Recommended first decision: Business Standard on Flexible billing while the owner count and operating model are finalized.

Owner steps:

1. Create the Workspace tenant for `team47studio.com`.
2. Use a named, owner-controlled recovery identity for the first super administrator.
3. Create a second break-glass super administrator and store its recovery codes offline.
4. Add the Google verification TXT value to Cloudflare DNS exactly as Google supplies it.
5. Complete domain verification before changing mail routing.
6. Create least-privilege groups such as `gcp-admins@team47studio.com`, `billing@team47studio.com`, `security@team47studio.com`, `support@team47studio.com`, and `dmarc@team47studio.com`.
7. Enforce two-step verification, recovery methods, and admin session controls.
8. Publish the Google MX records only after the mailboxes and recovery paths are verified.
9. Publish one SPF record containing only Google and explicitly approved outbound providers.
10. Generate a 2048-bit DKIM key in the Admin console, publish its TXT record, then activate signing.
11. Start DMARC with monitoring, for example `p=none`, using an approved report mailbox. Review alignment reports before moving to `quarantine`, then `reject`.
12. Create a Shared Drive named `Team 47 Studio Operations` with human managers and least-privilege service-account membership.

Google recommends SPF, DKIM, and DMARC for authenticated mail. Source: [Gmail sender guidelines](https://support.google.com/mail/answer/81126).

## Approval 3 — Google Cloud organization and projects

Create the Google Cloud organization only after Workspace domain verification so billing, IAM groups, Shared Drives, and production projects live in one organizational boundary.

Recommended project IDs, with an owner-selected globally unique suffix:

- `team47studio-nonprod-<suffix>`
- `team47studio-prod-<suffix>`

Recommended region if the Supabase database is confirmed in AWS `us-east-1`: **Google Cloud `us-east4` (Northern Virginia)**. It is close to East Coast users and supports Cloud Run and L4 GPU workloads, although GPU quota can require approval. If Supabase is in another region, select the closest compatible Google region before provisioning. Sources: [Cloud Run locations](https://docs.cloud.google.com/run/docs/locations), [Supabase regions](https://supabase.com/docs/guides/platform/regions).

Owner steps:

1. Link or create the approved Google Cloud billing account.
2. Create non-production and production projects; never reuse one project for both.
3. Assign project roles to Workspace groups, not individual personal accounts, except the break-glass path.
4. Create budgets and billing alerts before enabling billable services.
5. Confirm the GCP region, Supabase region, data-residency requirement, and GPU quota strategy.
6. Enable Cloud Run, Cloud Run Jobs, Artifact Registry, Secret Manager, Drive API, Cloud Scheduler, Compute Engine, IAM, Service Usage, and load-balancing APIs.
7. Use separate service accounts for web, API, jobs, deployment, and Drive indexing.
8. Add secret values directly to Secret Manager. Terraform creates only containers and IAM bindings, never plaintext values.

## Cloud Run and load-balancer implementation sequence

1. Install and authenticate Google Cloud CLI after approval.
2. Install Terraform 1.7 or later and initialize the prepared modules.
3. Install Docker Desktop, or explicitly choose Google Cloud Build to avoid local Docker.
4. Confirm every HTTP container listens on `0.0.0.0:$PORT`.
5. Keep the container filesystem stateless; persist records in Supabase, Cloud Storage, or the approved Drive design.
6. Convert scheduled/background workers that can terminate to Cloud Run Jobs. Keep request services free of unbounded background work.
7. Build immutable images and publish digest-pinned references to Artifact Registry.
8. Run `terraform plan` in non-production and obtain owner approval before `terraform apply`.
9. Deploy web and API with load-balancer-only ingress and explicit service identities.
10. Create serverless network endpoint groups in the same region as their Cloud Run services.
11. Create the global static IP, HTTPS load balancer, URL map, managed certificate, and HTTP-to-HTTPS redirect.
12. Route `/api/*` to the API backend and all other application paths to the web backend.
13. Publish Cloudflare DNS-only A records to the Google global IP only after the load-balancer address is final.
14. Verify direct `run.app` access is denied or restricted, while the load-balancer route succeeds.

Cloud Run requires the ingress container to listen on `0.0.0.0` at the injected `PORT` and provides a nonpersistent in-memory filesystem. Source: [Cloud Run container contract](https://docs.cloud.google.com/run/docs/container-contract). Google documents serverless NEGs, global static IPs, managed certificates, and load-balancer-only ingress for this architecture: [global external Application Load Balancer with Cloud Run](https://docs.cloud.google.com/load-balancing/docs/https/setup-global-ext-https-serverless).

### Cloudflare DNS-only decision

The requested architecture uses Google Cloud's load balancer as the security and TLS edge. Therefore the web A records should be DNS-only in Cloudflare. This exposes the Google load-balancer IP and does not use Cloudflare proxy caching, WAF, or DDoS proxy features. MX and TXT records are also DNS-only. Source: [Cloudflare proxy status](https://developers.cloudflare.com/dns/proxy-status/).

## Shared Drive, Drive API, and customer-image decision

Internal marketing and GTM assets can use a Workspace Shared Drive with a service account added as a least-privilege member. Customer profile and journal images should not be placed in the same Shared Drive.

Before production image storage is activated, approve one design:

1. **Recommended:** private Google Cloud Storage buckets for customer images, encrypted and accessed through short-lived signed URLs; Shared Drive remains for internal operations.
2. Existing Drive-backed customer-image design, only after legal/privacy approval, per-user isolation tests, deletion tests, access logging, and retention enforcement pass.

The final policy must define purpose, consent, facial-image sensitivity, human access, AI processing destinations, deletion, export, incident handling, and the approved retention period. The current 24-month product statement must not become the production default until counsel and the owner approve it.

## Verification packet required before traffic

The production release gate must include:

- Workspace domain, admin, 2SV, recovery, MX, SPF, DKIM, and DMARC evidence.
- Billing account, budgets, project IDs, IAM group membership, and service-account review.
- Secret Manager references with no plaintext values in reports.
- Immutable image digests and Artifact Registry provenance.
- Staging regression, accessibility, security, rate-limit, restore, and incident-response results.
- SSL, redirects, HSTS/security headers, API routing, direct-origin blocking, and webhook-signature tests.
- AI route order, hosted entitlement, budget enforcement, model identity, and no-image-to-hosted evidence.
- Supabase OAuth callback, allowed-origin, RLS, account deletion, and session-revocation tests.
- Approved customer-image storage, privacy, retention, deletion, and Drive-indexing decision.
- Signed go/no-go approval before production DNS is changed.

## Decisions required from the owner

| Decision | Recommended option | Alternatives |
|---|---|---|
| Ollama plan | Pro monthly for qualification | Pro annual; hold cloud fallback |
| Workspace | Business Standard Flexible | Standard annual; Business Plus if Vault/advanced controls are required |
| Workspace primary admin | Named Team 47 Studio owner identity | Must be supplied by owner |
| GCP projects | `team47studio-nonprod-<suffix>` and `team47studio-prod-<suffix>` | Owner may supply compliant IDs |
| Region | `us-east4` if Supabase is `us-east-1` | Match the confirmed Supabase/data-residency region |
| DMARC reports | `dmarc@team47studio.com` | Approved third-party processor |
| Outbound email | Google Workspace only at launch | List every additional provider before SPF/DKIM/DMARC work |
| Shared Drive managers | Two named human managers | Owner supplies identities |
| Production GPU | Keep local RTX 5080 for development; use GCP L4 only after benchmark/quota approval | Ollama Cloud-only burst; another approved host |
| Customer images | Private Cloud Storage | Existing isolated Drive design after approval |
| Retention | Obtain legal/privacy approval before activation | Do not assume 24 months automatically |

## Stop conditions

Do not proceed with a paid plan, billing link, DNS mutation, production project creation, secret insertion, customer-data transfer, GPU VM provisioning, or production traffic enablement without the matching owner approval and account access. Never send secret values through chat or commit them to GitHub.
