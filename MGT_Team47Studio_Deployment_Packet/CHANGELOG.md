# Changelog

## 1.1.0, 2026-11-15

- Customer care: deterministic triage for the four hard escalations, fixed replies, no model call.
- Guardrails: payment card numbers refused in briefs and blocked in drafts.
- Aligned with the D09 v3.9 handoff: response targets removed ([SLA UNSET]), Studio price unset, gates G24 and G25, v3.9 routes in the site diagnostic.
- Data: `qwen3.5:9b` and `mistral-small3.2` sizes read from the Ollama registry; metered fallback costed as pay-as-you-go.
- Merge kit: `merge/patches/0001` (iOS scripts), `0002` (packet CI), `MANIFEST.sha256`, `docs/10-MERGE-PLAN.md`.
- Report: `docs/11-DIAGNOSTIC-REGRESSION-v1.1.md`.
- Tests: 116 to 134.

## 1.0.0, 2026-11-14

- First release.
