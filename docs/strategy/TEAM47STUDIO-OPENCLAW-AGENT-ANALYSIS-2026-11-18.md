# Team 47 Studio OpenClaw, open-weight model, and agent operations analysis

**Version:** 1.0  
**Assessment date:** 2026-11-18  
**Owner and final approver:** Gregg Clark  
**Decision posture:** Proceed with a bounded, local-first evaluation; do not activate OpenClaw or outbound autonomy in production.

## 1. Executive decision

Team 47 Studio should **not** replace its current portal/API control plane with OpenClaw, and it should not expose a default OpenClaw installation to customer accounts, retailer communication, publishing, payments, or production secrets.

The recommended architecture is:

1. Keep the existing deterministic Team 47 Studio API and its draft → submit → independent review → integrity-bound export workflow as the system of record.
2. Continue to use deterministic code for identity, consent, entitlement, prices, account actions, payments, partner stage, campaign gates, and final publication decisions.
3. Use qualified open-weight models for bounded language tasks: Qwen for fast customer-facing explanations and drafting; DeepSeek or another qualified reasoning model for analysis and strategy; deterministic validators for policy and state transitions.
4. Run OpenClaw only as an **isolated shadow worker**, with all sandboxing enabled, network denied by default, host execution denied, messaging channels disabled, secrets hidden, and no external side effects.
5. Compare OpenClaw shadow results against the existing implementation and a small LangGraph proof of concept. Promote only the route that measurably improves completed-task quality or operator time without weakening safety, provenance, recovery, or cost.
6. At current planning volume, favor metered hosted inference for production bursts and the owned RTX 5080 for development/shadow evaluation. Do not reserve an always-on cloud GPU until measured utilization makes it economic.

The present repository is closer to a safe pilot than the earlier planning documents imply, but it is not production-ready for agent autonomy. The current production tracker still requires a staffed external support channel, approved retailer data-sharing and settlement contracts, qualified model routing, target-environment evidence, and named release approvals.

## 2. What was reviewed

### Local repository evidence

- `apps/api/src/portal/agent-operations.ts`: five bounded commercial agents, review states, independent approval, SHA-256 export integrity, and explicit denial of automatic send, publish, scraping, or external action.
- `apps/api/test/commercial-agents.cjs`: executable proof that self-approval, malformed sources, premature export, and corrupted records fail closed.
- `packages/ai-gateway/src/task-registry.ts`: task-specific routing across local Ollama, optional OpenClaw, Ollama Cloud, and controlled hosted fallbacks.
- `packages/ai-gateway/src/runtime.ts` and `packages/ai-gateway/src/adapters/http-adapters.ts`: disabled-by-default OpenClaw-compatible endpoint with production URL admission controls.
- `infra/local-ai/README.md`: loopback-only local Ollama posture and prohibition on public exposure or customer-image use before privacy acceptance.
- `infra/gcp/phase3-ai` and `infra/gcp/platform`: private broker, immutable model/container declarations, budget and monitoring foundations.
- `docs/PROJECT-TODO-2026-11-14.md`: current implemented capabilities, open production evidence, and explicit activation holds.
- `docs/d09-v3.6/06-growth/*`: social calendar, advertising concepts, lifecycle messages, and performance gates.
- `docs/d09-v3.6/05-handoff/HANDOFF-PACKET-v1.2.md`: partner onboarding and acceptance boundaries.

Local machine checks confirmed that the Ollama command and an OpenClaw profile directory are present. The current execution boundary could not reach the loopback Ollama service, so the installed model inventory and live runtime behavior were **not** independently verified in this assessment. Presence is not production evidence.

### Google Drive evidence

- [Co-Branded Marketing and AI Outreach Playbook](https://docs.google.com/document/d/1xzh-ZTFNZZJh_laMpqvou06Q0PJFaTgyVCyD2K8Xuf4/edit): approved inputs, prohibited data, draft/review/approval sequence, claims boundaries, and measurement approach.
- [Retail Partnership Outreach Packet](https://docs.google.com/document/d/1v-915wYgotcykCe-cTzlZVWQrAYWKQ38yvcWQ_Rx1ME/edit): partner permission, outreach, follow-up, seven-step onboarding, data separation, and launch approval.
- [Economics and GTM Model v1.2](https://docs.google.com/spreadsheets/d/1gL5uiSubwFl1S2K7qObIpIs2s2NEM2x-JOapmoffU78/edit): explicit assumptions, fixed cost scenarios, token volume, unit economics, and approval gates.
- [Cost and Scalability Analysis v2.0](https://drive.google.com/file/d/13eCk_Xml-f6Ubm8TASKMAhJtu7vgU962/view): local stack, cloud toggle, MAU scenarios, cost risks, and partner-revenue track.
- [Months 2–3 Growth Plan](https://docs.google.com/document/d/1H1zOrbGoJYDywMeRUXBCvggybvSALBzEo6PQXpIlM78/edit): step-up rules, CAC/CTR/trial gates, campaign variants, claims language, and monthly measurement.
- [Retail and Co-Marketing Kit folder](https://drive.google.com/drive/folders/149I-FlhsNmV8fThrp59pL48Eo9ihQh8g) and [Deployment Packet folder](https://drive.google.com/drive/folders/15pYj5sktZfQEPjpQRshLMlDOnlHsO856): authoritative working packets and source context.

Drive is appropriate for approved source documents, campaign evidence, operator packets, and redacted exports. It should **not** become the live customer profile database, secret store, agent memory, or unredacted conversation archive.

### Current primary external sources

- [OpenClaw official repository](https://github.com/openclaw/openclaw) and [documentation](https://docs.openclaw.ai/).
- [OpenClaw trust boundary](https://docs.openclaw.ai/start/why-openclaw/the-trust-boundary), [policy-as-code](https://docs.openclaw.ai/start/why-openclaw/policy-as-code), [secrets](https://docs.openclaw.ai/start/why-openclaw/secrets), and [provenance](https://docs.openclaw.ai/start/why-openclaw/provenance).
- [Ollama OpenClaw integration](https://github.com/ollama/ollama/blob/main/docs/integrations/openclaw.mdx) and [Qwen 3.5 registry](https://registry.ollama.com/library/qwen3.5).
- [LangGraph workflow design](https://docs.langchain.com/oss/javascript/langgraph/thinking-in-langgraph).
- [Microsoft Agent Framework overview](https://learn.microsoft.com/en-us/agent-framework/overview).
- [Mistral Small 4 announcement](https://mistral.ai/news/mistral-small-4/) and [Meta Llama model downloads](https://ai.meta.com/resources/models-and-libraries/llama-downloads/).
- [Ollama pricing](https://www.ollama.com/pricing), [Google Cloud Run pricing](https://cloud.google.com/run/pricing), and [Supabase pricing](https://supabase.com/pricing).

## 3. Integrity corrections to earlier material

Several earlier statements were planning shorthand and should not be repeated as production facts:

| Earlier shorthand | Corrected interpretation |
|---|---|
| “OpenClaw model” | OpenClaw is an agent/runtime framework. Qwen, DeepSeek, Mistral, Llama, and similar systems are models. They require separate qualification. |
| “$0 AI” | Local weights can avoid per-token API fees, but hardware, electricity, maintenance, monitoring, evaluation, support, and human review are not zero. |
| “Single RTX 5080 supports low thousands of MAU” | This is an unverified capacity hypothesis. Throughput, context length, concurrent sessions, quantization, uptime, and queue tolerance must be load-tested. |
| “OpenClaw installed” | A profile directory is present; configuration quality, current version, model inventory, sandbox posture, and live behavior were not proven. |
| “95% deterministic/cacheable” | A useful design target, not measured production traffic. Instrument real requests before using it for capacity planning. |
| “Strong impressions and solid ROI” | A goal. ROI must be demonstrated through incremental experiments, holdouts, attribution rules, spend gates, and measured contribution—not promised by an agent. |
| “Full customer support” | The portal supports bounded guidance and handoff preparation. A staffed external support delivery channel remains an open production prerequisite. |

## 4. OpenClaw assessment

### Strengths

- Broad channel, model, tool, memory, audit, and self-hosting support.
- Official Ollama integration and local/open-weight model compatibility.
- Policy controls, tool allow/deny rules, exact command approvals, sandbox backends, secret references, provenance labels, and memory deletion mechanisms.
- Useful for long-running internal research, source collection, campaign variant preparation, and multi-step operator work.
- MIT-licensed code and a large active ecosystem reduce direct software-license cost.

### Material risks

OpenClaw’s current trust-boundary documentation states that sandboxing is off by default and that its out-of-box posture assumes one trusted operator, with execution on the gateway host without prompts. That default is incompatible with customer-account and outbound-commerce workflows.

Additional risks:

- Prompt injection can cross from websites, email, partner documents, or retrieved content into tool calls.
- Channel connectors and browser sessions create high-impact send, publish, and authenticated-session risks.
- Long-term memory may preserve incorrect, stale, personal, or unapproved business facts unless provenance, purpose, and deletion are enforced.
- A small local model may produce fluent but unreliable tool calls, especially across long contexts.
- Agent loops can multiply tokens, latency, and cost beyond a single-call estimate.
- Plugins and community skills expand the software supply chain and permission surface.
- Account support, payment status, partner permission, and campaign publication require deterministic authorization that a model must not infer.

### Required OpenClaw profile

Before any Team 47 Studio shadow run:

- Run in a dedicated non-admin container/VM, not the owner workstation session.
- `sandbox.mode = all`, per-agent scope, no host escape, read-only allowlisted sources, ephemeral output volume.
- Network denied by default; allow only the approved model endpoint and specific read-only source hosts.
- Messaging, browser login profiles, shell host execution, file deletion, account APIs, payment APIs, CRM writes, and publishing tools disabled.
- Secrets supplied through approved secret references/egress boundaries; never placed in prompts, config committed to Git, logs, or Drive documents.
- Tool policy uses an explicit allowlist and deny-wins behavior.
- Memory ingestion accepts only approved sources with provenance, retention, correction, and deletion handling.
- Security audit and sandbox explanation captured as evidence on every version/config change.
- All output returns to the existing Team 47 Studio review state machine; OpenClaw cannot approve or deliver its own work.

## 5. Framework comparison

Score: 1 weak, 5 strong for this project’s current requirements.

| Option | Explicit control | Node/TypeScript fit | Local models | Human gates/recovery | Operational risk | Decision |
|---|---:|---:|---:|---:|---:|---|
| Existing Team 47 Studio state machine | 5 | 5 | 5 | 4 | 2 | **Production control plane.** Extend before replacing. |
| LangGraph JS | 5 | 5 | 5 | 5 | 3 | Best alternative for future durable, branching workflows; prototype only where current state machine becomes difficult to maintain. |
| OpenClaw | 3 after hardening; 1 by default | 3 | 5 | 4 | 5 by default; 3 hardened | Shadow/internal worker only until sandbox, prompt-injection, recovery, and output tests pass. |
| Microsoft Agent Framework | 5 | 2 | 4 | 5 | 3 | Capable, but adds a Python/.NET/Go service and Azure-oriented operating surface with no current need. |
| Direct model calls with typed schemas | 5 | 5 | 5 | 3 | 2 | Preferred for short bounded tasks; least complexity. |

The best near-term answer is not “choose one framework.” Use direct calls for bounded drafting, the current state machine for review and authorization, and evaluate OpenClaw only where long-running tool orchestration provides measurable value.

## 6. Open-weight model recommendation

### Short list

| Model/route | Best fit | Hardware/operations fit | Main risk | Recommendation |
|---|---|---|---|---|
| Qwen 3.5 4B | Short support answers, classification assistance, copy drafts | Already configured; small footprint | Tool fidelity and nuance may be insufficient | Keep as current compatibility route and low-cost fallback. |
| Qwen 3.5 9B | Customer explanations, outreach/campaign drafts, structured tool calls | Ollama registry lists roughly 6.6–7.6 GB with 256K context; practical 16 GB candidate | Must measure latency and safety at the required 64K OpenClaw context | **First local candidate** for fast conversation and drafting. |
| DeepSeek-R1 8B | Analysis, alternative generation, risk review | Already configured; practical local candidate | Reasoning verbosity, latency, and customer-tone consistency | Keep for internal analysis, not the default customer voice. |
| DeepSeek V4.1 Flash via Ollama Cloud | Burst capacity, long-context analysis, production fallback | Metered; no local GPU operations | External processing, provider dependency, and usage spend | **First hosted fallback candidate** subject to data/retention approval. |
| Mistral Small 4 | Multimodal, reasoning, general agent evaluation | Apache 2.0; hosted evaluation is easier than local on 16 GB | New route and resource fit require testing | Add to the evaluation set; do not deploy on vendor claims alone. |
| Llama 4 Scout | Large-context multimodal evaluation | 109B total/17B active; not a sensible 16 GB local default | License, weight footprint, serving cost | Hosted benchmark candidate only; not the primary Team 47 Studio route. |

### Qualification method

Do not compare generic benchmark scores. Build a Team 47 Studio test set from approved material and score the exact tasks:

- 50 cases per workflow, at least 450 cases across the nine draft agents.
- Happy path, missing-data, conflicting-data, stale-price, revoked-consent, wrong-account, prompt-injection, malicious-source, medical-claim, unsupported-retailer, and send/publish-pressure cases.
- Blind human scoring for accuracy, groundedness, brand voice, actionability, safe escalation, and required editing.
- Automated checks for schema, citations, forbidden claims, source validity, secret patterns, cross-account leakage, prohibited actions, and required disclosures.
- Measure p50/p95 latency, tokens, retries, route failures, human review minutes, accepted-without-edit rate, and direct cost per accepted artifact.

Promotion thresholds are recorded in `config/agents/team47studio-agent-operating-model.v1.json`. Restricted action, secret exposure, unsupported claim, and cross-account leakage rates must remain zero in the evaluation set.

## 7. Draft operating model

The machine-readable model contains nine bounded roles:

| Agent | Job | Authority boundary | Primary success measures |
|---|---|---|---|
| Customer Care Guide | Grounded help and staffed handoff | Cannot change accounts, payments, credentials, or cases | Grounded answer, safe containment, handoff precision, CSAT |
| Customer Onboarding Coach | Explain profile, consent, plan, and feature steps | Cannot accept terms, consent, upload, or enroll | Completion, abandonment, escalation, accessibility defects |
| Account Action Preparer | Prepare authenticated action proposal | Cannot execute, refund, delete, export, or change entitlement | Proposal accuracy, unauthorized action rate |
| Retail Partner Researcher | Source-attributed partner fit summary | No scraping, private-contact inference, contact, or relationship claims | Source validity, unsupported facts, qualified review |
| Retail Outreach Coordinator | Initial and follow-up drafts | No sending, scheduling, offer invention, or partnership claims | Approval, positive replies, meetings, opt-outs |
| Partner Onboarding Manager | Seven-step checklist and blockers | Cannot sign, approve assets, publish catalog, share profiles, or settle | Time to onboard, completeness, launch defects |
| GTM Strategy Analyst | Objectives, audiences, channels, experiments, scenarios | Cannot set price, approve budget, publish, or promise ROI | Forecast calibration, CAC, payback, rework |
| Campaign Variant Studio | Channel-compliant creative variants | Cannot publish, buy media, invent discounts, or make claims | Approval, cycle time, incremental lift, defects |
| Performance and Compliance Reviewer | Deterministic schema, source, policy, and metric checks | Cannot self-approve or override failures | Escaped defects, false blocks, review time, audit completeness |

The configuration is intentionally not a production activation file. It validates that OpenClaw and external side effects remain disabled and that every external-action path requires human review.

## 8. End-to-end workflows

### Customer care and onboarding

1. Authenticate the account where account-specific context is needed.
2. Deterministically classify the user’s requested area; do not let the model decide authorization.
3. Retrieve only approved help passages and the minimum redacted state.
4. Generate a structured answer with sources, confidence, safe next step, and handoff flag.
5. Refuse or hand off billing disputes, suspected fraud, credential recovery, deletion/export execution, medical questions, and unclear authority.
6. Record route, prompt version, sources, latency, cost, and outcome without storing restricted content in general agent memory.
7. Obtain customer feedback and use only de-identified aggregates for evaluation.

Account management is **assistive**: the agent can explain and deep-link to a secure page or prepare a proposal. The customer or authorized operator must perform and confirm the protected action.

### Retail partner lifecycle

1. Operator creates a prospect from verified facts and source references.
2. Research agent summarizes facts, unknowns, fit hypothesis, and risks without restricted scraping or inferred private contacts.
3. Outreach coordinator drafts the initial note from the approved packet.
4. Independent reviewer verifies identity, facts, permission posture, claims, requested next step, and opt-out handling.
5. A separately authorized channel operator sends; the agent records no send unless the delivery system returns evidence.
6. Follow-up drafts use deterministic cadence state and stop on reply, opt-out, invalid address, legal hold, or operator stop.
7. Qualified prospects enter the seven-step partner checklist; no product, brand asset, link, tracking, customer-data sharing, or launch occurs without written permission.
8. Thirty-day review measures partner acceptance, conversion where lawful, returns, support issues, customer opt-outs, and ranking integrity.

### GTM and campaign operations

1. Owner supplies objective, audience, approved offer, budget range, product facts, channel rules, and measurement window.
2. Strategy agent produces assumptions and experiment options—not a spend authorization.
3. Variant agent creates channel-specific concepts from approved facts and required disclosure language.
4. Compliance reviewer checks claims, price, renewal, medical boundaries, partner permission, accessibility, and source integrity.
5. Human owner approves creative, spend, channel, audience, dates, and stop conditions.
6. Publishing occurs through a separate connector with per-action approval and immutable delivery evidence.
7. Performance agent reports incremental metrics and recommends hold, revise, or scale. Only the owner changes budget.

## 9. Campaign concept matrix

These are experiment templates, not performance promises.

| Concept | Audience/problem | Core variation | Primary metric | Required gate |
|---|---|---|---|---|
| Answer Once | Prospects tired of repeating preferences | Profile-to-multiple-guidance explanation; short video, static, search landing copy | Qualified signup rate and onboarding completion | Approved profile facts, privacy copy, no “perfect/accurate” claims |
| The Range That Stops Short | Safety-conscious skincare explorers | Demonstrate cosmetic guidance boundaries and staffed handoff | Saves, qualified visits, trust survey | Cosmetic-not-medical disclosure; no diagnosis/timing claim |
| The Whole Studio | Users seeking coordinated skin, color, style, and wardrobe guidance | Feature map versus single-feature sequence | Studio-plan view-to-start rate | Locked plan features and live price objects |
| Routine Reset | Existing members with incomplete routines | Educational checklist, email, portal card, search article | Reactivation and routine completion | Consent, suppression list, no outcome guarantee |
| Authorized Partner Path | Customers who want purchase options | Explain approved listing, disclosure, and external purchase journey | Outbound click quality and partner-attributed conversion | Signed partner permission, approved assets/links, compensation disclosure |
| Seasonal Color-to-Care | Organic/social discovery audience | Palette, wardrobe, and cosmetic routine variations by season | Incremental CTR, saves, assisted signup | No sensitive-trait targeting or image reuse without consent |
| Two Months Free on Annual | Retargeted trial or paid-plan evaluators | Monthly-versus-annual economics with effective monthly price | Incremental annual take rate and payback | Live Stripe price, renewal/cancel language, owner-approved offer |
| Retail Pilot Invitation | Authorized retail decision-makers | Listing, referral, catalog, or co-marketing pilot variants | Qualified meeting rate and accepted pilot | Verified business contact and reviewed outreach packet |

Use controlled holdouts or geo/time splits where possible. Track impressions, reach, frequency, CTR, CPC, qualified signup, trial start, paid conversion, CAC, contribution after channel fees, refund/chargeback, retention, partner acceptance, and human hours. Scale only incremental contribution—not vanity impressions.

The current growth plan’s month-2 gate (at least one concept per channel at CTR ≥ 1.2% and CAC ≤ $95) and later CAC/trial gates are planning rules, not market benchmarks. Replace them with measured results and a locked contribution model before increasing spend.

## 10. Cost and expense model

### One-time incremental setup

Because Team 47 Studio already has an AI gateway, role-gated admin API, review state machine, audit events, and export integrity, the remaining incremental build is estimated at **100–168 hours**. At an explicitly assumed loaded rate of **$75–$150/hour**, that is **$7,500–$25,200 once**. External legal/privacy review, partner contract drafting, paid-media creative production, and channel account fees are excluded.

| Workstream | Hours |
|---|---:|
| Architecture and security design | 32–48 |
| Data policy, prompts, and source contracts | 16–28 |
| OpenClaw sandbox and adapter integration | 20–36 |
| Evaluation harness and workflow cases | 24–40 |
| Runbooks, training, and pilot preparation | 8–16 |

### Recurring direct infrastructure

The Drive economics model records broader shared-platform fixed costs of **$161.75 lean**, **$911.75 base**, and **$3,558.55 growth** per month. Those are sizing scenarios, not vendor invoices, and include more than the agent stack.

Incremental agent compute under the model’s 20M input/6M output-token assumption:

| Deployment | Incremental direct cash/month | Calculation | Use |
|---|---:|---|---|
| Owned RTX 5080 shadow | $30.20–$70.20 | $25.20 electricity + $5–$25 logs/backup + $0–$20 cloud standby | Development, evaluation, scheduled internal drafting |
| Metered hybrid | $18.20–$58.20 | $13.20 DeepSeek V4.1 Flash tokens + $5–$25 logs + $0–$20 plan | Recommended initial production inference pattern after data approval |
| Scheduled Cloud Run L4 | $187.44–$242.44 | 160 hours × $1.04652/hour + $20–$75 operations reserve | Controlled windows, batch campaigns, predictable availability |
| Always-on Cloud Run L4 | $803.96–$913.96 | 730 hours × $1.04652/hour + $40–$150 reserve | Only after sustained measured demand |

Cloud Run arithmetic uses current list rates for 4 vCPU, 16 GiB, and a non-zonal L4: GPU $0.67212/hour, CPU $0.25920/hour, and memory $0.11520/hour. Region, networking, minimum instances, redundancy, storage, discounts, and taxes can change the invoice.

At the assumed token volume, metered inference is cheaper than powering the local workstation continuously. Local remains valuable for privacy-sensitive development, qualification, and outage fallback. An always-on cloud GPU is justified by latency, data-control, or sustained utilization—not by per-token price alone.

### Recurring human operations

Budget **12–30 hours/month** for source curation, draft review, QA sampling, partner/campaign approvals, incident review, model regression, and cost reconciliation. At the same planning rate, that is **$900–$4,500/month** and is likely the largest agent-specific operating cost during the pilot.

Do not reduce review staffing based on a small successful demo. Reduce it only after the accepted-without-edit rate, escaped-defect rate, safe-handoff recall, and recovery results remain within threshold across multiple release cycles.

## 11. Implementation and qualification plan

### Phase 0 — decisions and source freeze (week 1)

- Approve the rewritten inquiry, agent roles, prohibited actions, and data classes.
- Name customer-support, retail, marketing, privacy/security, and release reviewers.
- Select authoritative help, onboarding, plan, brand, claims, partner, and campaign sources.
- Lock evaluation assumptions: volumes, latency target, review capacity, labor rate, and monthly spend ceiling.

### Phase 1 — evaluation foundation (weeks 2–3)

- Build the 450+ case set and deterministic validators.
- Record current Qwen 4B/DeepSeek 8B baseline.
- Add Qwen 9B, DeepSeek cloud, and Mistral candidate routes in non-production evaluation only.
- Measure schema validity, grounding, safe handoff, latency, token use, and review minutes.

### Phase 2 — OpenClaw shadow (weeks 3–5)

- Install a pinned version in an isolated VM/container.
- Apply the required sandbox, network, tool, secret, channel, and memory profile.
- Run the official security audit and preserve configuration hashes/evidence.
- Feed the same approved cases to current direct calls and OpenClaw; no live customers, partners, or channel connections.

### Phase 3 — staff customer-care pilot (weeks 5–7)

- Enable suggestions for trained staff only.
- Use approved help sources and redacted account state.
- Require staff acceptance/edit; no direct account action.
- Review failures daily and suspend on any leakage, unsupported claim, or unsafe action.

### Phase 4 — retail and GTM pilot (weeks 7–9)

- Use a small owner-approved prospect list with verified business contacts.
- Draft only; independently review every initial message and follow-up.
- Run campaign concepts with owner-approved spend and step-up gates.
- Preserve source, reviewer, approved artifact, delivery evidence, and results.

### Phase 5 — production decision (weeks 10–12)

- Compare current state machine, OpenClaw, and optional LangGraph prototype.
- Select the simplest architecture meeting quality, recovery, audit, and cost targets.
- Complete privacy/security, support, partner, and campaign sign-offs.
- Approve a limited production scope with explicit rollback; keep broader autonomy disabled.

The timeline is flexible. Advancement is evidence-gated, not calendar-gated.

## 12. Production acceptance and stop conditions

### Must pass

- Zero restricted actions, secret exposures, unsupported claims, or cross-account leaks in the qualification set.
- ≥99% valid sources and ≥99% valid structured outputs.
- ≥98% recall for required staffed handoffs.
- Independent reviewer can reproduce the source-to-draft decision.
- All tools, data, memory, channel, network, and secret permissions match the approved configuration.
- Restore, rollback, provider-failure, queue-overload, and channel-error drills pass.
- Monthly direct cost and human review time remain inside the approved budget.

### Immediate stop

- Any payment/credential exposure, cross-account content, unauthorized send/publish, medical diagnosis, fabricated partner/price/offer, consent bypass, unlogged external action, approval bypass, or inability to delete purpose-limited memory.
- Cost runaway, repeated loop behavior, material prompt-injection success, or security-audit drift.
- A model/provider/license or policy change without requalification.

## 13. Owner decisions still required

Gregg Clark must approve or assign:

1. Customer-support delivery channel and staffed handoff schedule.
2. Authoritative customer help and onboarding source set.
3. Retail partner prospect-source policy, contact-permission standard, cadence, stop rules, agreement, attribution, settlement, and support acceptance.
4. Campaign claims/disclosures, live plan prices, trial/renewal language, audiences, budgets, and channel accounts.
5. Data retention for prompts, outputs, routing logs, source snapshots, and agent memory.
6. Whether customer-confidential text may use Ollama Cloud or another hosted provider.
7. Loaded labor rate, monthly agent budget, latency target, and peak concurrency.
8. OpenClaw shadow host, pinned version, sandbox image, network allowlist, and operator identities.
9. Model license acceptance and final Qwen/DeepSeek/Mistral route selection after evaluation.
10. Limited pilot scope and final production release authorization.

## 14. Built artifacts and verification

- Working brief: `docs/strategy/TEAM47STUDIO-OPENCLAW-REQUEST-BRIEF-2026-11-18.md`
- Machine-readable model: `config/agents/team47studio-agent-operating-model.v1.json`
- Validator: `scripts/validate-team47-agent-model.mjs`
- Cost model: `docs/strategy/TEAM47STUDIO-AGENT-COST-MODEL-2026-11-18.csv`

Validation command:

```powershell
node scripts/validate-team47-agent-model.mjs
```

Verified result on 2026-11-18: valid schema; nine bounded agents; three explicit routes; production activation false; OpenClaw disabled; external side effects disabled.
