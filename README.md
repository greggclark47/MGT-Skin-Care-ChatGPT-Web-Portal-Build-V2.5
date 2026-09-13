# MGT Skin Care v2

Consumer skincare application (web + iOS + Android) — personalized routine matching,
explainable AI-assisted recommendations, and multi-brand commerce with subscription
replenishment.

## Source of truth
`claude/skincare-master-blueprint-v2.md` (v2.0.0) is the canonical build specification:
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
SC-P1 scaffold. See `claude/skincare-master-blueprint-v2.md` Section Q for the full
build order and Section H for phase objectives/gates.
