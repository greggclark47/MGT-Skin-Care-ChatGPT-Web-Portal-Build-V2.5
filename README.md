# MGT Skin Care v2

Current production gap and end-to-end flow analysis: [PRODUCTION-GAP-AND-FLOW-ANALYSIS-2026-10-07.md](PRODUCTION-GAP-AND-FLOW-ANALYSIS-2026-10-07.md).

Consumer skincare application (web + iOS + Android) — personalized routine matching,
explainable AI-assisted guidance, external-retailer discovery, and an optional Premium
portal membership. MGT product checkout and vendor payouts are outside the initial scope.

## Source of truth
`claude/skincare-master-blueprint-v2.md` (v2.0.2) is the canonical build specification:
architecture, database schema, API spec, event taxonomy, AI prompt architecture,
financial model, and the six-month build order (SC-P0–SC-P6). Read it before making
structural changes.

`claude/model.py` is the executable financial model (LEAN/BASE/GROWTH scenarios);
re-run it whenever a pricing or cost assumption changes.

## Workspace layout
- `apps/api` — backend service (Node/Express or Fastify per blueprint Section P)
- `apps/web` — web portal
- `apps/mobile` — iOS + Android (React Native, per blueprint Section P)
- `packages/domain` — `@mgt/domain`: deterministic Tier-0 engines (rules, scoring,
  routine, cart, replenishment, entitlement, pricing) — pure, versioned, no LLM calls
- `packages/ai-gateway` — `@mgt/ai-gateway`: provider-agnostic AI routing layer
- `packages/analytics-sdk` — `@mgt/analytics-sdk`: event taxonomy client (Section K)
- `infra/db/migrations` — consolidated Postgres schema (Section J), validated locally
- `docs` — supplementary docs

## Status
Repository-controlled production requirements have a passing local checkpoint. Production
remains gated on approved configuration, live target-system evidence, the remaining ingredient
matrix decision, named owners, and release sign-off. The release export manifest prepares the
same checksum-bound handoff for GitHub and Google Drive while keeping destination completion
explicit. Use `MGT-V2-BLUEPRINT-RECONCILIATION.md` for the current boundary and
`claude/skincare-master-blueprint-v2.md` for original product intent.
