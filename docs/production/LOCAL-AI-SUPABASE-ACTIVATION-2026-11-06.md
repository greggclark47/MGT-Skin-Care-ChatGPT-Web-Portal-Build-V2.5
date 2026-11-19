# Local AI and Supabase activation report

Date: 2026-11-06
Product: Team 47 Studio
Status: local AI connected and tested; hosted fallback, OpenClaw runtime, and live Supabase project activation await external authorization.

## Implemented state

The local Ollama API is running on `http://127.0.0.1:11434`. It remains loopback-only and must not be exposed directly to the internet. The observed host has an NVIDIA GeForce RTX 5080, driver 617.42, 16,303 MiB VRAM, and 14,517 MiB free at the final inventory check.

The application route for ordinary bounded text tasks is now fixed as:

1. `deepseek-r1:8b` through local Ollama.
2. `qwen3.5:4b` through local Ollama.
3. OpenClaw-compatible local orchestration route using `qwen3.5:4b`, only when the separate OpenClaw runtime is enabled.
4. `gpt-5` through the OpenAI Responses API, only when hosted processing, entitlement, credentials, and budget controls are approved.

Hosted fallback remains disabled by default. A free or anonymous request cannot reach it. Customer photos remain local-only and do not use this hosted fallback chain.

### Installed model evidence

| Model | Size | Format | Manifest digest | Result |
|---|---:|---|---|---|
| `deepseek-r1:8b` | 5.23 GB | 8.2B Q4_K_M | `6995872bfe4c521a67b32da386cd21d5c6e819b6e0d62f79f64ec83be99f5763` | Downloaded, response completed, 100% GPU |
| `qwen3.5:4b` | 3.32 GB | 4.2B Q4_K_M | `d8b0f5e9760cd1682034f292d7ef72ec46f432149be0df7574bf2d6e92e38c04` | Already installed, exact response completed, 100% GPU |
| `nomic-embed-text` | 0.27 GB | 137M F16 | `0a109f422b47e3a30ba2b10eca18548e944e8a23073ee3f3e947efcf3c45e59f` | Already installed; retained for embeddings |

The RTX 5080 held DeepSeek and Qwen simultaneously at an 8,192-token runtime context. Measured loaded sizes were about 6.3 GB and 3.4 GB. The local profile therefore uses one parallel request and at most two loaded models. Production qualification must still test peak context, concurrent users, thermals, and out-of-memory recovery.

### Live and contract tests

- Qwen returned `QWEN_OK`; cold response time was 23.39 seconds; Ollama reported 100% GPU execution.
- DeepSeek returned `2 + 2 equals 4.`; warm response time was 3.25 seconds; Ollama reported 100% GPU execution.
- DeepSeek used 416 output tokens for a simple prompt because its reasoning trace consumes the output budget. Two smaller 64/256-token probes ended before final answer text. The route now allows 1,600 output tokens and a 30-second task timeout.
- AI gateway routing, compliance fallback, citation rejection, entitlement denial, budget denial, circuit breaker, pricing provenance, GPT-5 deprecation metadata, OpenAI Responses transport, and local OpenClaw-compatible transport all passed.
- All four Supabase Google OAuth tests passed: scoped PKCE start, server-side code exchange without retaining provider tokens, account-switch isolation, and rejection of invalid/expired/replayed/provider-failed callbacks.

## Files added or changed

- `infra/portal/env.local-rtx5080.example` is the no-secret local profile.
- `infra/portal/env.example` now declares the same model order and safe concurrency.
- `packages/ai-gateway/src/task-registry.ts` contains the enforced task route.
- `packages/ai-gateway/src/adapters/index.ts` records current GPT-5 pricing, deprecation, and removal date.
- AI gateway smoke tests now cover the route order and OpenAI/OpenClaw transport contracts.

## Authorization and external input required

### A. OpenClaw runtime

Observed state: Ollama 0.40.11 supports `ollama launch openclaw`, but the OpenClaw application is not installed and Windows has no system-wide Node/npm runtime. The Node runtime bundled inside Codex is not an approved system dependency and must not be used as the product runtime.

Owner authorization is required to:

1. Install an approved Node.js LTS release system-wide.
2. Review and approve the exact OpenClaw package version, license, source, checksum, and installer behavior.
3. Let Ollama install/configure OpenClaw against `qwen3.5:4b`.
4. Approve an OpenClaw tool allowlist. Initial production policy should deny shell execution, unrestricted browsing, social posting, email sending, payment actions, database writes, account changes, and customer-image access.
5. Approve a sandbox, outbound-domain allowlist, human-review queue, audit events, prompt-injection tests, and rollback method.

Until these are complete, `OPENCLAW_ENABLED=false`. The application can still use DeepSeek and Qwen directly.

### B. OpenAI GPT-5 final fallback

Observed state: no `OPENAI_API_KEY` is configured, so no paid call was made. GPT-5 is deprecated and OpenAI lists removal on 2026-12-11. Its currently published rates are $1.25 per million input tokens and $10.00 per million output tokens. The product configuration records this as a temporary route and keeps it disabled.

Owner authorization is required to:

1. Approve temporary use of deprecated `gpt-5` and approve migration to a supported model before 2026-12-11.
2. Provide an OpenAI API project with billing and model access. A ChatGPT subscription is not an API credential.
3. Create a restricted project API key and store it in Google Secret Manager. Do not send it in chat, commit it to Git, or upload it to Drive.
4. Approve monthly and per-account spend caps, alert thresholds, allowed tasks, region/data-processing terms, retention posture, and customer hosted-AI consent.
5. Inject the secret into the API service only and then set `HOSTED_OPENAI_ENABLED=true`.
6. Run bounded staging qualification and outage/fallback tests before customer traffic.

### C. Supabase Auth and Google sign-in

Observed state: the secure server-side PKCE implementation is complete, but no `SUPABASE_URL`, anon/publishable key, service-role key, or live Google OAuth client is configured. A live connection cannot be made without those project-owned values.

Owner or account administrator action is required to:

1. Create or identify separate Supabase staging and production projects and select the approved region.
2. Create separate Google OAuth web clients for staging and production.
3. In Google Auth Platform, add `https://team47studio.com` as the production JavaScript origin and add the Supabase project callback shown by Supabase, normally `https://PROJECT_REF.supabase.co/auth/v1/callback`, as the authorized redirect URI.
4. In Supabase Auth URL Configuration, set the production Site URL to `https://team47studio.com` and allow the exact application callback `https://team47studio.com/api/hub/auth/google/callback`. Add only the exact staging and local callbacks that are actually used.
5. Enable the Google provider in Supabase with the Google client ID and client secret. Keep the Google secret in Supabase; do not place it in this repository.
6. Store `SUPABASE_URL` and the browser-safe publishable/anon key in the approved configuration boundary. Store `SUPABASE_SERVICE_ROLE_KEY` only in the API secret boundary; never expose it to web/mobile clients.
7. Enable Row Level Security on every customer table, review policies with two-account isolation tests, and approve account-link/merge behavior, deletion, export, audit, retention, and incident recovery.
8. Inject the approved values and set `SUPABASE_GOOGLE_OAUTH_ENABLED=true` in staging first. Run synthetic new-account, existing-account, account-switch, replay, logout, deletion, and recovery tests before production.

The requested plan is appropriate: use Supabase Free only for development/private early testing, then move the organization to Pro before public customer launch or any dependency on non-pausing availability, paid backup/recovery features, or production support. Supabase documents that Free projects can be paused, while paid-plan projects in the paid organization are not paused. Upgrade earlier if measured usage reaches the internal 70% warning threshold for any applicable quota.

### D. Local-host operations

Owner authorization is still required before treating this Windows workstation as an always-on production service:

1. Approve automatic Ollama startup under a restricted Windows account.
2. Approve power, patching, restart, monitoring, physical access, disk encryption, and backup policy.
3. Keep port 11434 bound to loopback or a private authenticated service boundary; do not open it in the public firewall.
4. Approve a production topology. A personal workstation is suitable for development and qualification, not a resilient public production dependency without redundancy and operations coverage.

## Activation sequence after values are supplied

1. Install and review OpenClaw prerequisites, then configure it with Qwen and run tool-denial tests.
2. Create Supabase staging plus staging Google OAuth client; inject secrets outside source control; activate staging sign-in.
3. Run staging OAuth/account-isolation tests against the real provider.
4. Create the restricted OpenAI project key and spend controls; run synthetic GPT-5 staging qualification only.
5. Record the supported-model migration decision before the GPT-5 removal date.
6. Run the full verification suite, security scan, backup/readback, restore rehearsal, and owner approval gate.
7. Promote immutable application and model manifests to production.

## Primary references

- OpenAI GPT-5 model and pricing: https://developers.openai.com/api/docs/models/gpt-5
- OpenAI deprecations: https://developers.openai.com/api/docs/deprecations
- Ollama Qwen 3.5: https://ollama.com/library/qwen3.5
- Ollama DeepSeek R1 tags: https://registry.ollama.com/library/deepseek-r1/tags
- OpenClaw local models: https://docs.openclaw.ai/gateway/local-models
- Supabase Google sign-in: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase billing plans: https://supabase.com/docs/guides/platform/billing-on-supabase
