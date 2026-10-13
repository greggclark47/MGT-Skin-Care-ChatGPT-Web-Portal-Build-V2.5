# Prioritized implementation backlog

Estimates are relative engineering effort for the existing repository, not commitments. Each increment must keep the current production/referral boundary intact.

## Phase 2 — canonical foundation (P0)

| ID | Increment | Acceptance criteria | Estimate | Depends on |
|---|---|---|---:|---|
| AA-01 | Shared contract package | Implemented in `@mgt/domain` and `@mgt/shared`; typed entities, provenance, commercial labels, consent purposes, pagination, and response policy metadata compile | M | Phase 1 docs |
| AA-02 | Catalog/ingredient schema | Implemented as a server-owned migration and fixture-backed catalog with stable IDs, freshness, review status, and RLS | L | AA-01 |
| AA-03 | Treatment/provider schema | Implemented as canonical records and the initial server-owned schema; live qualification/appointment adapters remain deferred | L | AA-01 |
| AA-04 | Consent/access policy | Implemented as purpose-scoped contracts/schema; user-owned write flows and deletion integration remain deferred to the next increment | M | AA-01 |
| AA-05 | Read-only v1 routes | Implemented and tested for bounded ingredient, product, treatment, and provider reads with provenance and safety metadata | M | AA-02, AA-03 |

## Phase 3 — initial experience (P0/P1)

| ID | Increment | Acceptance criteria | Estimate | Depends on |
|---|---|---|---:|---|
| AA-06 | Anti-aging onboarding extension | Implemented as a consent-aware, non-persistent preview with bounded goals and sensitivity; existing Skin Match profile remains authoritative | M | AA-01, AA-04 |
| AA-07 | Ingredient explorer | Implemented with reviewed records, bounded search, evidence, compatibility notes, provenance, and safety copy | M | AA-05 |
| AA-08 | Product comparison | Implemented as metadata-only selection and comparison; sample products cannot be purchased and commercial labels do not rank evidence | M | AA-05 |
| AA-09 | Routine planner | Implemented as a deterministic AM/PM preview with avoidance exclusions, cautions, safety notes, and explicit confirmation-required state | M | AA-05, AA-06 |
| AA-10 | Clinic/provider directory | Implemented as fixture-backed location/provider discovery with independent external handoff, zero shared data, and no live booking | L | AA-03, AA-05 |

## Phase 4 — AI intelligence (P1)

| ID | Increment | Acceptance criteria | Estimate | Depends on |
|---|---|---|---:|---|
| AA-11 | Grounded explanation tasks | Central task registry, schemas, prompt versions, approved-source retrieval, citations, and fail-closed validation | M | AA-01, AA-02 |
| AA-12 | Conversational search | Assistant can search approved products/ingredients/treatments/providers with structured results and uncertainty | L | AA-05, AA-11 |
| AA-13 | Safety evaluation suite | Golden cases cover cosmetic vs medical boundary, contraindications, procedural escalation, unsupported claims, and prompt injection | M | AA-11 |
| AA-14 | AI feedback/evaluation | Feedback, evaluation runs, schema/citation/claim metrics, cost and latency telemetry are persisted and reviewable | M | AA-11, AA-13 |

## Phase 5 — partner integrations (P1/P2)

| ID | Increment | Acceptance criteria | Estimate | Depends on |
|---|---|---|---:|---|
| AA-15 | Fixture-backed catalog adapter | Import, dedupe, provenance, freshness, conflict reporting, replay, and quarantine work without live credentials | M | AA-02 |
| AA-16 | Provider directory adapter | Provider submissions, qualification verification state, location normalization, and moderation queue work | L | AA-03 |
| AA-17 | Merchant referral adapter | Allowlisted URLs, disclosure labels, click measurement boundary, and no profile data in URLs | M | AA-05 |
| AA-18 | Appointment request adapter | Idempotent request, consent receipt, partner handoff, status polling/webhook seam, and user-visible uncertainty | L | AA-03, AA-04 |

## Phase 6 — optimization and launch (P2)

| ID | Increment | Acceptance criteria | Estimate | Depends on |
|---|---|---|---:|---|
| AA-19 | Progress/adherence | Opt-in progress records, reminders, deletion, aggregate analytics, and no diagnostic inference | M | AA-04, AA-09 |
| AA-20 | Admin/data quality | Moderation, provenance/freshness dashboard, review queues, partner conflicts, and audit exports | L | AA-02, AA-03, AA-15, AA-16 |
| AA-21 | Search/geospatial scale | Measured need, bounded geocoding, privacy-preserving radius search, latency SLOs, and fallback behavior | L | AA-10, AA-16 |
| AA-22 | Launch readiness | Accessibility, security, privacy, load, restore, CI/CD, monitoring, and jurisdiction/partner review complete | L | All P0/P1 |

## Launch priorities

The first useful release is AA-01 through AA-10: it provides evidence-aware skincare discovery, personalized routine planning, and cautious provider discovery without enabling medical diagnosis, live booking, direct checkout, image analysis, or unreviewed commercial ranking. AI and partner adapters follow only after the data and safety contracts are stable.
