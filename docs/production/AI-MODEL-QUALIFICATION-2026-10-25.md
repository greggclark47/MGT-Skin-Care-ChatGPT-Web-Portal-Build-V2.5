# AI model qualification packet — 2026-10-25

## Decision

**No routing change authorized or made.** The gateway remains local-first. This packet prepares a same-input comparison of the current Ollama baselines with GPT-6 Luna, GPT-6.1 Sol, and GPT-6 Astra; it does not declare a winning model or production readiness.

## Executed evidence

- `pnpm test:ai-qualification`: 5/5 local harness tests passed. They cover provider availability, safety/grounding rubric rejection, equal-case comparison with injected fake transports, token-cost arithmetic, incomplete-matrix gating, and pre-call spend-cap enforcement. The fake transport is a test double, not measured model quality.
- `pnpm --filter @mgt/ai-gateway smoke`: gateway and pricing checks passed. Candidate price entries are sourced to the current official standard text rate; production task routing is unchanged.
- `pnpm ai:qualification-preflight`: 0 live calls. The current shell has no `OPENAI_API_KEY`; local Ollama is present, but the configured `llama3.2:3b` and `deepseek-r1:8b` are not installed. Other installed local models are not substituted silently.
- `pnpm test:verification`: the complete local regression gate passed after this change; evidence is in `work/verification/2026-10-25T15-30-45-245Z/report.md`. The new qualification tests were included in its HTTP/persistence/release-contract phase.
- No prompts, generated text, credentials, or customer data were sent to OpenAI during this work.

## Comparison contract

The harness `infra/portal/ai-model-qualification.mjs` uses four synthetic, consent-free cases representing product explanation, anti-aging explanation, style/color matching, and operator review. Every candidate receives the same case prompts. It records task-rubric pass, gateway safety/schema/grounding validation, provider-model identity, reported input/output tokens, elapsed latency, and estimated USD cost from reported usage. It computes p50/p95 latency and estimated cost per successful case. It does not persist response text or API credentials. Failed provider calls keep their pre-call spend reservation because billable work may have occurred.

These four cases are a **smoke comparison**, not a statistically credible release evaluation. Before any routing change, expand the reviewed case set across sensitive-skin, ingredient exclusions, catalog gaps, unsupported claims, ambiguous styles, accessibility, prompt injection, and provider outage. Require zero unsafe outputs, measure task-specific quality against SME review, account for local compute/support and actual hosted invoices, and verify latency under realistic concurrent load. Human review remains required even if the automated matrix is complete.

## Safe live execution

1. Inject a project-scoped OpenAI key through the approved secret manager into the qualification shell; do not commit or print it. Confirm the three model IDs are enabled for that API project.
2. Provision the two exact local baseline model tags **only after** capacity and licensing review; the harness does not download models.
3. Run `pnpm ai:qualification-preflight` and confirm all five rows available.
4. Run `node infra/portal/ai-model-qualification.mjs --live --max-usd=0.50` in an approved test environment. The run is bounded to one call per model/case with no retry and a conservative pre-call spend reservation. Review the JSON in the terminal without storing raw prompts/responses.
5. Compare with actual API billing and local hardware utilization, then carry the reviewed expanded evaluation through staging. Change the task registry only after a separate owner decision and regression review.

The current adapter uses the OpenAI Responses API with `store:false`, reasoning effort, and no temperature for hosted requests. [Official OpenAI model guidance](https://developers.openai.com/api/docs/models) describes Astra for demanding work, Sol for balanced complex work, and Luna for scoped high-volume tasks. The [deployment checklist](https://developers.openai.com/api/docs/guides/deployment-checklist) calls for representative evaluation of task success, latency, token use, and cost per success; [pricing](https://developers.openai.com/api/docs/pricing) is subject to revalidation before billing decisions.
