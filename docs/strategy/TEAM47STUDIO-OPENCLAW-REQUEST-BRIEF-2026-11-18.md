# Team 47 Studio agent and chatbot assessment — working brief

**Version:** 1.0  
**Date:** 2026-11-18  
**Owner and final approver:** Gregg Clark  
**Status:** Approved inquiry scope; findings and prototype remain review material, not production authorization.

## Updated request

Perform an evidence-based, end-to-end assessment for Team 47 Studio of whether and how OpenClaw, other open-source agent frameworks, and qualified open-weight language models should support customer, retail-partner, and go-to-market operations. Treat OpenClaw as an orchestration framework rather than a language model, and evaluate the framework and models separately.

Use the complete accessible Team 47 Studio evidence set across the local repository, the approved GitHub repository, and Team 47 Studio Google Drive materials. Reconcile conflicting or outdated statements, identify whether each input is implemented, tested, proposed, estimated, or awaiting approval, and do not treat planning documents as proof of a live production capability.

The analysis must cover:

1. **Customer operations:** customer care, guided onboarding, account education and account-management assistance, including identity, consent, privacy, accessibility, escalation, deletion/export requests, billing boundaries, support handoff, and service-quality measurement.
2. **Retail-partner operations:** authorized prospect research, outreach drafting, follow-up cadence, qualification, permission capture, onboarding, catalog/asset approval, co-marketing, attribution, settlement readiness, support acceptance, renewal, and offboarding. No scraping, inferred private contact data, unsolicited sending, or claim of a partnership is permitted.
3. **Go-to-market operations:** strategy, campaign concepts and variants, approved-channel content drafting, search/index marketing, lifecycle marketing, social media, partner amplification, experiment design, budget gates, measurement, and ROI analysis. Separate planning assumptions from measured results and prohibit unsupported cosmetic, medical, price, retailer, or performance claims.
4. **Technology choices:** compare OpenClaw with the existing Team 47 Studio workflow engine and credible alternatives. Compare open-weight models by task quality, structured-output reliability, tool-use accuracy, safety, privacy, latency, hardware fit, licensing, maintainability, and measured total cost. Do not select a model on benchmark scores or price alone.
5. **Security and control:** define data classification, least-privilege tools, authentication, secrets custody, network and filesystem isolation, prompt-injection defenses, memory provenance/deletion, audit records, retention, human approval, incident response, and fail-closed behavior. Payment credentials, raw customer images, diagnostic or medical inference, and unrelated retailer data must remain outside marketing and outreach contexts.
6. **Economics:** provide one-time setup effort and recurring monthly costs for local-first, metered-hybrid, and managed-GPU deployment. Show assumptions, formulas, volume, confidence, excluded costs, human operations time, scaling triggers, and sensitivity to model, token volume, concurrency, and support load.
7. **Working draft model:** create a versioned, machine-readable operating model that maps each agent to its allowed inputs, output contract, model route, tools, human gates, metrics, retention, and prohibited actions. It must build on the existing draft → independent review → integrity-bound export workflow and must not enable publication, email, retailer contact, account mutation, payment action, or production OpenClaw activation.
8. **Qualification plan:** define a repeatable evaluation set and acceptance thresholds for correctness, groundedness, tool-call success, refusal behavior, privacy, bias, brand/claims compliance, latency, cost, recovery, and human-review burden. Include shadow mode, limited staff pilot, rollback criteria, and named sign-off points.

## Required deliverables

- Executive decision and recommended target architecture.
- Source inventory with dates and confidence.
- Use-case and responsibility matrix.
- OpenClaw and alternative-framework scorecard.
- Open-weight model short list and task-routing proposal.
- Data, tool, approval, audit, and retention controls.
- Campaign concept and measurement matrix.
- Transparent one-time and monthly cost model.
- Machine-readable draft operating model plus validation command.
- Phased implementation, evaluation, and launch plan.
- Explicit blockers and manual owner decisions.

## Acceptance standard

The work is complete only when every recommendation is traceable to repository evidence, an approved Team 47 Studio source, or a current primary external source; estimates are labeled; contradictions are surfaced; unsafe autonomy is excluded; the draft configuration validates; and no production or external action is represented as completed without live evidence.
