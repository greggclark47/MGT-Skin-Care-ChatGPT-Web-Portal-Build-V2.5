# Validation and operations plan

## Test layers

| Layer | Required checks |
|---|---|
| Domain | Enum/schema validation, ingredient compatibility, sensitivity ceilings, routine ordering, treatment risk flags, commercial-label separation |
| API contract | Request/response schemas, authentication, ownership, consent, idempotency, bounded pagination, error envelope, stale-source behavior |
| Persistence | Migration lineage, RLS owner/cross-account tests, append-only audit, deletion/redaction, freshness and conflict resolution |
| AI | Schema pass rate, citation validity, unsupported-claim rate, safety escalation, prompt/version reproducibility, budget/fallback behavior |
| Integration | Adapter fixtures, timeouts, retry limits, duplicate delivery, malformed partner records, provider/merchant outage behavior |
| Web/mobile | Shared DTO rendering, accessible form states, keyboard flow, responsive layout, unavailable/empty/error states, consent UX |
| Operations | Readiness, health, queue lag, import replay, backup/restore, alert routing, cost reconciliation, graceful shutdown |

## Release gates

No feature reaches a production promotion gate unless:

1. Existing v2.195 hardening and infrastructure contracts remain green.
2. Canonical contracts and migration hashes are reviewed.
3. New safety and privacy cases pass with fail-closed behavior.
4. All AI claims in golden cases have valid approved source references.
5. Partner adapters pass fixture and outage tests without leaking credentials or user data.
6. Web/mobile flows pass semantic accessibility and error-state tests.
7. Live identity, database/RLS, secrets, backups, provider credentials, and monitoring are separately verified in the target environment.

## Metrics

Track only consented, minimum-necessary aggregates:

- onboarding completion and time to first relevant result;
- recommendation explanation opens, saves, routine confirmations, and routine adherence entries;
- ingredient/product/provider search success and empty-result rate;
- appointment-request handoff completion, never implying a completed booking unless the partner confirms it;
- AI schema pass rate, citation validity, escalation rate, p95 latency, cost, fallback rate, and user feedback;
- adapter freshness, import failures, duplicate/conflict counts, and availability staleness;
- privacy, safety, authorization, and data-retention incidents.

Do not report outbound clicks as purchases, unique users, conversion, revenue, or profit without verified partner attribution and written terms.
