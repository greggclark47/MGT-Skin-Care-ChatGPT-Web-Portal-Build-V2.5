# MGT Skin Care v2 — AI, identity, and backup stack review

**Prepared:** 2026-10-26  
**Status:** Architecture proposal for Gregg Clark review; not a live configuration change  
**Decision requested:** approve the provider boundaries, Ollama model evaluation set, Google Cloud fallback option, OAuth separation, and backup objectives below.

## Executive recommendation

Keep the existing in-process AI gateway and deterministic domain engines. Run Ollama as the default inference service for routine, product explanation, style, and intent tasks. Retain current `llama3.2:3b` and `deepseek-r1:8b` as comparison baselines; evaluate Qwen 3.5 4B as a small multimodal candidate, Qwen 3.5 9B as a stronger local candidate, and `gpt-oss:20b` as a reasoning candidate only on hardware with measured headroom. Do not silently change routes based on model names or token prices.

Keep an optional, separately approved hosted route for outages or cases that fail a quality threshold. Preferred first hosted open-weight option is Google Gemini Enterprise Agent Platform / Model Garden MaaS because it can provide managed inference for selected open-weight models under the MGT Google Cloud project and service identity. The model catalog and regional availability must be checked in that project before selection. Keep the existing OpenAI adapter as a separately gated premium-quality candidate, not an automatic destination for every failed local call.

Customer profile and data remain in the account-scoped Postgres/Supabase store. Retrieval, candidate selection, entitlements, and routine mutations stay deterministic and server-owned. The model receives only a task-specific, minimized context. A cloud fallback is blocked unless the customer-facing notice and consent cover that processing and the account’s AI/cloud preference allows it.

Use Google Cloud for production application operations, secret delivery, database recovery if Cloud SQL is the selected database, and encrypted off-host backup artifacts. Use the approved Google Drive folder for readable, non-secret release documents and backup receipts. Drive is not the database’s point-in-time recovery mechanism and should not be the only copy of customer records.

## Current implementation findings

- The gateway is an in-process library called by the API and workers; it already has provider adapters, fixed task types, schemas, citations/grounding checks, entitlements, cost fields, and routing logs.
- The local model map currently uses `llama3.2:3b` for the fast route, `deepseek-r1:8b` for reasoning fallback, `llava:latest` for the configured vision task, and `nomic-embed-text` for embeddings. `latest` is a mutable model tag and should not be used as a production release identity.
- The production task registry also contains OpenAI routes. Hosted OpenAI is environment-gated, but model assignments and costs need a fresh review against the live model and pricing docs before enabling it.
- `infra/portal/compose.production.yaml` declares Ollama under the `local-ai` profile with a 12 GB memory cap and 4 CPU allocation. Production model service is therefore optional in the current deployment contract.
- The API must receive `OLLAMA_BASE_URL=http://ollama:11434` on the Compose network. Do not rely on the adapter fallback `http://127.0.0.1:11434` in a separate API container.
- The account contract exposes preferred name, locale, time zone, measurement system, service interests and synchronization time. Skin profile and appearance/style descriptors are stored separately and should be joined only for tasks that need them.
- Google sign-in already uses a Supabase-backed server-side PKCE flow. It is identity-only. The test Drive image adapter is explicitly non-production; it must not be repurposed for production image storage or customer backup.
- Current qualification evidence is synthetic and is not a live model comparison. `docs/production/AI-MODEL-QUALIFICATION-2026-10-25.md` notes that configured local tags and hosted credentials were unavailable at that check; the test harness does not prove model quality.

## Target service map

```text
Web portal / Android
  └─ first-party session cookie / CSRF boundary
      └─ MGT API (Cloud Run or approved private container host)
          ├─ deterministic skin/style/product/routine engines
          ├─ account context builder + profile version + consent gate
          ├─ approved catalog / knowledge retrieval (Postgres + vector index)
          ├─ AI gateway (fixed task registry, schema, grounding, budget, audit)
          │   ├─ primary: private Ollama endpoint on private network
          │   ├─ optional open-weight cloud: Google Model Garden MaaS
          │   └─ optional premium-quality API: OpenAI Responses API
          ├─ Postgres/Supabase Auth and account data
          ├─ Stripe billing events → verified webhook → durable entitlement state
          └─ Cloud Logging / Monitoring / alerting

Google Cloud recovery plane:
  Secret Manager + user-managed service identities
  Cloud SQL backup/PITR (if Cloud SQL selected) + scheduled encrypted logical exports
  private GCS backup bucket with soft-delete/versioning, lifecycle, separate IAM
  Google Drive release-evidence folder for redacted manifests, checksums, runbooks,
  and restore receipts; never store application secrets or raw customer prompts there
```

## Model and API recommendation

| Route | Candidate | Best fit to evaluate | Operational tradeoff | Decision |
|---|---|---|---|---|
| Local fast default | Current `llama3.2:3b`; compare `qwen3.5:4b` | Intent classification, short product explanations, constrained language, style summaries | Low resource demand; quality and schema adherence must be measured on MGT cases | Keep current path until same-case local evaluation chooses otherwise |
| Local stronger general / image candidate | `qwen3.5:9b` | Profile-grounded responses; optional visual attribute extraction after a separate photo-consent gate | Ollama currently lists a 6.6–7.6 GB artifact; runtime, KV cache, context length and parallel requests need additional memory | Test only after recording host RAM/VRAM and concurrency capacity |
| Local deeper reasoning | Current `deepseek-r1:8b`; compare `gpt-oss:20b` | Conflicts, multi-constraint product explanation, complex operator drafts | Reasoning can be slower and overproduce; must be capped, grounded, and never directly mutate records | Evaluate against hard cases; do not make it the universal primary |
| Local embeddings | Current `nomic-embed-text`; compare current Ollama embedding candidates | Approved product/ingredient/provider catalog retrieval | Embeddings need versioned model/index and a rebuild path | Keep separate from generative model; re-embed/reindex as a controlled migration |
| Hosted open-weight fallback | Google Model Garden MaaS; select an available Qwen, Llama, DeepSeek, or gpt-oss service only after project review | Temporary inference capacity without managing GPU nodes; model portability via gateway | Cloud processing and location, terms, limits, availability, and prices vary by model | Optional, off by default; require account consent policy, budget, and regional review |
| Hosted high-quality route | Existing OpenAI adapter; evaluate GPT-6 Luna / GPT-6.1 Sol / GPT-6 Astra on the same test set | Hard cases where quality or structured tool support measurably improves outcomes | Provider charges, data transfer, rate limits and model availability; model/pricing can change | Explicit allowlist and caps only; no automatic user-data escalation on local failure |

OpenAI’s current API model page lists Luna as its cost-sensitive, high-volume model, Sol as the balanced model, and Astra for the most demanding reasoning/coding work; current prices must be re-read before activation. Google’s current Agent Platform documentation lists open weights including DeepSeek, Llama and Qwen, and describes serverless MaaS as an option. Ollama exposes local chat and schema-constrained output; its docs state Ollama Cloud currently does not support structured outputs, so any cloud route must be validated independently rather than assumed equivalent.

### Recommended initial evaluation set

1. Keep the existing synthetic qualification cases and add minimum cases for ingredient exclusions, sensitivity, contradictory profile answers, insufficient catalog evidence, unsafe medical claims, pregnancy/medication disclosures, image consent, prompt injection, cross-account leakage attempts, localization, and provider timeout.
2. Run each model on identical cases, prompt version, retrieved record IDs, token ceilings and safety filters. Include at least 3 repeats for nondeterminism and a concurrency pass for latency.
3. Record schema/citation validity, task rubric score, unsafe/unsupported claim rate, abstention behavior, p50/p95 latency, input/output tokens, cost per successful response, and local GPU/CPU/RAM utilization. Do not store raw customer prompts or photos in the evaluation report.
4. Require zero critical safety failures; a product owner and domain reviewer sign off on task quality. Define task-specific minimums and a rollback model before changing the task registry.
5. A local timeout or outage returns the deterministic/local-safe fallback unless cloud AI use is approved for the account and task. Do not retry sensitive content through a different vendor without that authorization.

## Account/profile synchronization contract

### Authoritative record and context projection

- System of record: Postgres/Supabase, one account subject per authenticated identity, row-level access controls enabled for every customer row. Session identity comes from the verified server-side session, never a browser-supplied `user_id`.
- Profile write: validate allowed fields and enums, acquire account profile write lock, update one profile revision and `updated_at`, append an audit event without copying sensitive values, and return the authoritative revision.
- Context construction: the API loads only the signed-in account’s current profile revision plus the task’s required fields. It creates an ephemeral projection and passes a `profile_revision` and `consent_revision` reference to the gateway for traceability.
- Recommendation flow: deterministic engine scores against approved products, ingredient flags, budget and exclusions. The LLM may explain selected candidates, but cannot create products, change the score, override an exclusion, commit a routine, change a subscription, or modify a profile.
- Output persistence: save the structured output with task/prompt/model/version, citations, profile revision and expiry policy. Do not save hidden reasoning. Regenerate or mark stale when the profile revision, approved catalog version or safety policy version changes.
- Account switch: discard prior account context and cached outputs before loading the next account. Enforce actor/account ownership server-side on each request and on background jobs.

### Data fields by task

| Task | Allowed minimum context | Must not be sent by default |
|---|---|---|
| Skin match / routine explanation | Skin type, concerns, sensitivity, ingredient avoidances, routine level, goal, budget; approved product IDs and ingredient evidence | Email, full name, precise birth date, payment details, raw support history, retailer browsing trail, photos |
| Anti-aging education | User-selected question, relevant exclusions/sensitivity if requested, approved knowledge excerpts and citation IDs | Diagnosis claims, prescription decisions, unsupported treatment efficacy, unrequested profile history |
| Style / color / wardrobe | Explicitly selected color/comfort/style descriptors, occasion, chosen palette; only fields needed for the chosen tool | Identity/ethnicity inference, skin-health inference, attractiveness judgement, retailer account data, photos unless separately consented and enabled |
| Support draft | User’s current message and a minimized account service state where useful | Payment card data, full profile, image content, full conversation archive unless needed and explicitly disclosed |
| Operator analysis | Redacted incident facts and aggregate metrics; synthetic IDs | Customer-identifying data, raw secrets, photos, unredacted prompts |
| Vision / photo attributes | No input until separate opt-in analysis permission, documented purpose, retention, deletion and provider route exist | Automatic photo upload, facial identity/ethnicity/health or condition inference |

The model receives a purpose-built JSON object, not a full database row or account dump. Use separate consent scopes for (1) account sign-in, (2) hosted text inference, (3) image processing, (4) optional cloud image storage, and (5) marketing communications. Revocation blocks future processing and triggers the defined deletion/retention workflow; it does not silently erase legally required transaction records.

## OAuth and identity configuration

### Customer sign-in (existing direction)

1. Create separate Google OAuth clients for staging and production under the approved MGT Google Cloud projects. Record approved origins and callback URLs in a configuration register.
2. In Google Auth Platform, register exact authorized JavaScript origins and exact callback URI. Google requires an exact redirect URI match; no broad wildcard callbacks.
3. Configure the Google provider in the corresponding Supabase Auth project. Use the existing server-side PKCE flow; allow only the approved portal origin and exact callback.
4. Request identity scopes only: `openid`, `email`, `profile`. Do not attach Drive scopes to ordinary sign-in. Do not expose client secret or service-role key in browser/mobile variables.
5. Use short-lived, secure, HttpOnly, SameSite cookies; rotate session after sign-in and account linking; one-time state, PKCE verifier, bounded callback age, replay protection, exact redirect allow-list, logout/revocation and account-switch isolation.
6. Test first with synthetic users across new account, existing account, account linking, conflict/merge decision, expired code, replay, provider error, logout, revocation, and separate-account isolation.

### MGT service-to-Google access

Use Cloud Run user-managed service identities and IAM for service-to-service Google Cloud operations (GCS, Secret Manager, logging) instead of service-account JSON keys. Separate identities by service and environment; no default broad Editor role. For Cloud Run service-to-service calls use authenticated ID tokens with the receiving service URL as audience.

If Google Drive API access is needed for explicit release-document distribution, use a separate service OAuth client and narrowly scoped folder integration. Do not make this OAuth token the customer login token. For production customer images, use an approved object-storage design with account ownership, short-lived signed requests, consent, quotas, deletion and restore; the repository’s Drive photo connector is test-only and remains disabled in production.

## Google Cloud and backup configuration for review

### Environment and service layout

- Projects: `mgt-skin-care-staging` and `mgt-skin-care-production`, separate billing alerts, IAM bindings, OAuth clients, databases, secrets, storage buckets and monitoring.
- Runtime: Cloud Run web/API/worker where CPU-based services fit; use separate services and user-managed identities. If Ollama GPU inference is required, operate a private GPU VM or managed model endpoint behind private ingress; do not expose port 11434 to the public internet. The currently shown Compose Ollama cap is CPU-only in the file and must not be assumed to be a GPU production service.
- Network: HTTPS edge, private service networking to database/model endpoint where supported, egress allowlist to selected model endpoints, no public DB; authenticated service-to-service calls; rate limits and request/body bounds.
- Secrets: Google Secret Manager, separate staging/production and per-service secret access. Pin secret versions to deployment revisions, rotate on schedule and incident, audit access. Use ADC/service identity on Cloud Run; never set service-account key files or `GOOGLE_APPLICATION_CREDENTIALS` as a substitute on Cloud Run.
- Artifacts: immutable container digests, model tag and manifest digest, approved prompt/schema versions, migration identifier, catalog revision, evaluation report and deployment/rollback receipt.

### Database and backup design

1. Decide the authoritative database vendor before provisioning. If existing Supabase/Postgres remains the system of record, confirm plan, region, PITR entitlement and restore semantics in that project. If Cloud SQL becomes the system of record, do not maintain a second writable authority; migrate once under a controlled cutover.
2. Enable provider-managed encrypted daily backups and PITR at a documented retention. Run scheduled encrypted logical exports to a private GCS bucket in an approved region/project with least privilege, uniform bucket-level access, public access prevention, soft delete/versioning, lifecycle, and independent IAM.
3. Create separate backup writer and restore-reader identities. The app runtime must not delete backups or alter retention. Keep KMS key management and break-glass admin access separate from workload runtime.
4. Set operational targets for review: proposed RPO ≤ 15 minutes for database writes and ≤ 24 hours for export freshness; proposed RTO ≤ 4 hours for core account/service recovery. These are planning targets only; owner approval and rehearsal determine actual promises.
5. Verify a machine-readable backup receipt (resource, timestamp, source revision, size, checksum, encryption key reference, retention end, upload result) and an isolated restore receipt. Keep identifiers and checksums in Drive; do not upload plaintext dumps, user photos, secrets or API request logs.
6. Restore to a separate project/instance, apply schema migrations and test account isolation, profile version, image metadata without image disclosure, subscriptions/entitlements reconciliation, OAuth/session revocation, and application smoke flows. Record measured RPO/RTO. Never point production to a restored database until Gregg approves the cutover.
7. Use Google Drive `00 - Production Evidence` for review documents and a restricted release-evidence subfolder for redacted manifests, runbooks, checksums and signed/verified receipts. Drive has human-friendly access and version history; GCS/database recovery controls remain the actual technical restore path. Do not irreversibly lock retention until legal retention and deletion obligations are decided.

Supabase’s documented database backups do not include objects stored through its Storage API. Any separate object storage therefore needs its own versioning, deletion and restore plan. Cloud SQL PITR restores to a new instance; rehearse its connection cutover and secret rotation in advance.

## Proposed environment overlay (illustrative, not secrets)

```dotenv
# Shared product runtime: values are per-stage, non-secret configuration
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL_PRIMARY=qwen3.5:4b
OLLAMA_MODEL_REASONING=deepseek-r1:8b
OLLAMA_MODEL_EMBEDDING=nomic-embed-text
OLLAMA_NUM_PARALLEL=1
OLLAMA_MAX_LOADED_MODELS=1
OLLAMA_KEEP_ALIVE=10m

# Hosted providers remain disabled until account consent, project setup and evaluation pass
VERTEX_OPEN_MODEL_ENABLED=false
VERTEX_PROJECT_ID=REPLACE_WITH_STAGE_PROJECT
VERTEX_LOCATION=REPLACE_WITH_APPROVED_REGION
VERTEX_MODEL_ID=REPLACE_WITH_ENABLED_MODEL_ID
HOSTED_OPENAI_ENABLED=false

# Identity / storage
SUPABASE_GOOGLE_OAUTH_ENABLED=true
PUBLIC_ORIGIN=https://REPLACE_WITH_STAGE_OR_PRODUCTION_HOST
CUSTOMER_GOOGLE_SCOPES=openid,email,profile
CLIENT_IMAGE_DRIVE_TEST_ENABLED=false

# Recovery admission
BACKUP_MAX_AGE_HOURS=26
BACKUP_RESTORE_MAX_AGE_DAYS=90
BACKUP_ATTESTATION_ENABLED=false
```

`OLLAMA_MODEL_PRIMARY=qwen3.5:4b` is a proposed evaluation target, not a proven winner. If the current production host has only the declared 12 GB memory cap and 4 CPU allocation, start with one loaded 4B model and measured context/concurrency limits. Test 9B only after increasing capacity and measuring peak resident memory, KV cache growth, p95 latency, and OOM behavior. A 20B model is outside the present stated memory budget. Use exact Ollama model tags plus recorded model-manifest digests in release evidence; remove mutable `:latest` references from release paths.

For a Google hosted open-weight route, the application needs a dedicated provider adapter that obtains credentials from service identity, chooses an approved regional endpoint/model ID, applies per-call spend/usage caps, sends only consented minimized context, and validates response identity/schema/grounding. The current generic adapter must not be assumed to be a complete Vertex authentication implementation.

## Failover and safety rules

- Route using fixed task type, entitlement, account consent, task quality threshold, approved provider/model allowlist, token/time budget, and data classification.
- For a recoverable timeout or schema failure, one retry may be made on the same provider only when the operation is idempotent. A cross-provider retry is a separate data egress and must pass consent/region checks.
- Do not let model output become database writes, routine changes, purchase actions, retailer navigation or account changes without deterministic validation and explicit user action.
- Prefer retrieval from reviewed ingredient/product/provider records. Require cited record IDs and reject fabricated or out-of-set citations. Empty retrieval means abstain or show deterministic education.
- Use a circuit breaker, per-account/day quotas, global rate and spend caps, maximum prompt/output tokens, concurrency backpressure, timeout, health/readiness separation, and alerting for fallback spikes or elevated safety/schema failures.
- Logs contain model/provider ID, task type, prompt/schema/policy versions, profile revision reference, latency, token counts, cost and validation result. Exclude raw prompt/response, OAuth tokens, photos, emails and full profile payloads.
- Preserve local deterministic experience when Ollama or hosted APIs are unavailable. If a feature requires inference and no safe fallback is available, state it is unavailable rather than inventing output.

## Owner decisions and implementation gates

| Decision / evidence | Owner action | Exit condition |
|---|---|---|
| Hardware and deployment target | Confirm private GPU/CPU host or Google managed endpoint, region, monthly cap and network boundary | Capacity sheet, project/account IDs, budget alert and private connectivity documented |
| Model choice | Approve local candidate matrix and hosted fallback policy | Expanded same-input scorecard, zero critical safety errors, written task-level pass thresholds |
| Cloud data policy | Decide which tasks may transmit minimized profile data to which provider/region | Consent copy, privacy notice, contract/data-processing review and opt-out behavior approved |
| OAuth | Approve staging/production Google and Supabase projects, redirect URIs, scopes and account-link policy | Synthetic auth test evidence; no Drive scopes on login; account isolation demonstrated |
| Database / backup | Select one authoritative DB; approve RPO/RTO/retention and recovery owner | Backup freshness receipt and successful isolated restore inside approved objectives |
| Drive/GCS | Approve restricted evidence folder, GCS region/key/IAM/lifecycle and Drive retention conventions | Upload/readback verified; secrets and customer data absent; deletion/retention checked |
| Production rollout | Approve immutable image/model versions, traffic gate, monitoring and rollback | Staging acceptance, alert test, restore test, owner release sign-off |

## Implementation sequence

1. Inventory actual host GPU/CPU/RAM, current production Compose launch mode, private-network path, database provider/region/plan and current OAuth clients. Record observed state only.
2. Update the qualification harness with model manifests and the expanded synthetic cases; acquire approval for bounded live provider charges before making hosted calls.
3. Benchmark `llama3.2:3b`, `qwen3.5:4b`, `qwen3.5:9b` (capacity permitting), `deepseek-r1:8b`, and `gpt-oss:20b` (capacity permitting). Compare Google MaaS and OpenAI only where available and separately approved.
4. Implement provider capability contracts for structured JSON, vision, token accounting, streaming, timeout and tool calls. Do not assume every compatible endpoint implements the same schema or safety behavior.
5. Implement a profile context projection with `profile_revision`, task-specific allowlists, consent lookup, redaction and stale-output invalidation. Add hosted-route deny-by-default.
6. Provision isolated staging services, OAuth, database, Secret Manager, private GCS, monitoring and budget controls. Keep production credentials and resources separate.
7. Demonstrate backup restore, OAuth/account-link lifecycle, two-account data isolation, deletion/export, image consent boundary, model outage fallback, accessibility, rate limits, and incident rollback.
8. Have Gregg review the evidence pack and explicitly approve any pricing, provider, data-region, retention, customer-photo, and production-traffic decisions before production activation.

## Primary references checked 2026-10-26

- [Ollama chat API](https://docs.ollama.com/api/chat)
- [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
- [Ollama Qwen 3.5 library](https://ollama.com/library/qwen3.5)
- [Ollama gpt-oss library](https://ollama.com/library/gpt-oss)
- [OpenAI API models](https://developers.openai.com/api/docs/models)
- [Google Gemini Enterprise Agent Platform model catalog](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models)
- [Google Model as a Service for open models](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/open-models/use-maas)
- [Google OAuth 2.0 for web server applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Supabase Sign in with Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Google Cloud SQL point-in-time recovery](https://docs.cloud.google.com/sql/docs/postgres/backup-recovery/pitr)
- [Google Cloud Secret Manager best practices](https://docs.cloud.google.com/secret-manager/docs/best-practices)
- [Google Cloud Storage Bucket Lock](https://docs.cloud.google.com/storage/docs/bucket-lock)
- [Cloud Run service identity](https://docs.cloud.google.com/run/docs/securing/service-identity)
