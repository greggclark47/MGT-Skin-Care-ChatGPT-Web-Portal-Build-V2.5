# Anti-aging skincare platform — Phase 1 discovery package

Status: Phase 1 architecture and implementation planning complete locally. No major application behavior or production database changes are included in this package.

Baseline audited: MGT Skin Care v2.195 at commit `2c67a3bfee9d02d73237d2b44706f323db97e59f`.

## Documents

1. [Existing-stack assessment](./EXISTING-STACK-ASSESSMENT.md) — current capabilities, reuse map, gaps, constraints, and decisions.
2. [Target architecture](./TARGET-ARCHITECTURE.md) — service boundaries, shared contracts, data flow, and deployment shape.
3. [Canonical contracts](./CANONICAL-CONTRACTS.md) — entities, ownership, provenance, API surfaces, and ER diagram.
4. [Integrations, AI, safety, and privacy](./INTEGRATIONS-AI-SAFETY.md) — adapter contracts, RAG, evaluation, consent, and escalation boundaries.
5. [Validation and operations](./VALIDATION-OPERATIONS.md) — test strategy, observability, release gates, and failure behavior.
6. [Prioritized implementation backlog](./IMPLEMENTATION-BACKLOG.md) — staged increments, dependencies, acceptance criteria, estimates, and launch priorities.

## Recommended next move

Implement Phase 2 in a separate, reviewable increment: canonical domain types plus read-only catalog, ingredient, treatment, clinic, and practitioner tables/contracts. Keep product checkout, medical diagnosis, image analysis, live booking, and sponsored ranking disabled until their explicit safety, partner, and jurisdictional gates are satisfied.

## Current architectural position

The platform should extend the existing shared domain/API model rather than become a second application. The existing deterministic matching and routine engines remain authoritative for routine mutations and eligibility. The AI gateway may explain, retrieve, compare, and draft; it must not silently create medical conclusions, override safety rules, or mutate a routine without a deterministic command and user confirmation.
