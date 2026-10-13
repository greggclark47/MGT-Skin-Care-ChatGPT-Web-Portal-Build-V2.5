# Anti-aging skincare platform — Phase 1 discovery package

Status: Phase 1 architecture and implementation planning complete locally. The v2.340 AI foundation checkpoint now adds grounded explanation contracts, bounded reviewed-record search, safety evaluation cases, feedback telemetry, and fixture-backed catalog/provider adapter seams; live providers and production database application remain separately gated.

Baseline audited: MGT Skin Care v2.195 at commit `2c67a3bfee9d02d73237d2b44706f323db97e59f`.

## Documents

1. [Existing-stack assessment](./EXISTING-STACK-ASSESSMENT.md) — current capabilities, reuse map, gaps, constraints, and decisions.
2. [Target architecture](./TARGET-ARCHITECTURE.md) — service boundaries, shared contracts, data flow, and deployment shape.
3. [Canonical contracts](./CANONICAL-CONTRACTS.md) — entities, ownership, provenance, API surfaces, and ER diagram.
4. [Integrations, AI, safety, and privacy](./INTEGRATIONS-AI-SAFETY.md) — adapter contracts, RAG, evaluation, consent, and escalation boundaries.
5. [Validation and operations](./VALIDATION-OPERATIONS.md) — test strategy, observability, release gates, and failure behavior.
6. [Prioritized implementation backlog](./IMPLEMENTATION-BACKLOG.md) — staged increments, dependencies, acceptance criteria, estimates, and launch priorities.
7. [Foundation checkpoint v2.230](./FOUNDATION-CHECKPOINT-v2.230.md) — 35 implemented AA-01 through AA-05 increments and verification status.
8. [Experience checkpoint v2.275](./EXPERIENCE-CHECKPOINT-v2.275.md) — 45 implemented AA-06 through AA-10 increments and verification status.
9. [AI foundation checkpoint v2.340](./AI-FOUNDATION-CHECKPOINT-v2.340.md) — 65 safe increments across AA-11 through AA-16, with live providers and partner writes still disabled.

## Recommended next move

Continue from the v2.340 contracts with production retrieval and evaluation data only after source approval, privacy review, and operational restore gates are complete. Keep product checkout, medical diagnosis, image analysis, live booking, and sponsored ranking disabled until their explicit safety, partner, and jurisdictional gates are satisfied.

## Current architectural position

The platform should extend the existing shared domain/API model rather than become a second application. The existing deterministic matching and routine engines remain authoritative for routine mutations and eligibility. The AI gateway may explain, retrieve, compare, and draft; it must not silently create medical conclusions, override safety rules, or mutate a routine without a deterministic command and user confirmation.
