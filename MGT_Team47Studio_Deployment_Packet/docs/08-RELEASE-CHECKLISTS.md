# 08 Release checklists

Version 1.0.0, 2026-11-14. Built from the production diagnostic (2026-11-13), the candidate `47d405b` checkpoint and `docs/PROJECT-TODO-2026-11-14.md`. The live list is `t47 release gates`; this page is the reading copy.

**Decision today: HOLD on web, Android, iOS and the local agent plane.** A platform ships only when every P0 gate that applies to it is accepted by a named person with an evidence reference. "Reported" means a document says the work was done; it is not acceptance.

## Web portal: P0 in working order

| Gate | What closes it | State |
|---|---|---|
| G01 | Candidate packet and production gate for the exact commit and image digests | reported |
| G02 | Clean runtime admission with Secret Manager configuration | reported |
| G05 | Route contract and health endpoints verified through the deployed origin | reported |
| G07 | Encrypted off-host backup and an isolated restore drill with measured RPO and RTO | open |
| G08 | Approved product catalog and ingredient and claim rules | open |
| G06 | Authenticated Supabase journeys with two-account isolation | open |
| G03 | Stripe live activation | open |
| G04 | Stripe test matrix, then a controlled live smoke, reconciled | reported locally; provider rehearsal not run |
| G09 | Named approvers and a signed release authorization | open |

G07 and G08 come first because they are what keeps `/readyz` at 503. G09 is last by nature.

## Before broad marketing: P1

G10 accessibility audit (WCAG 2.2 AA), G11 support and incident ownership, G12 AI routing approval, G13 customer image storage.

## Android and Google Play

All shared P0 gates above, plus G14 (signed AAB and device acceptance), G15 (Play listing, Data safety, content rating, internal track) and G18 (mobile billing route).

## iOS and App Store

All shared P0 gates, plus G16 (Developer Program, EAS iOS build, TestFlight), G17 (listing, App Privacy, age rating, review notes, account deletion path) and G18.

## Local agent plane

G23: bake-off report, OpenClaw audit, injection cases passing, review queue in use, one verified encrypted backup.

## Later: P2

G19 retail partner acceptance, G20 policy pages complete on the candidate, G21 load and abuse tests, G22 one authoritative runbook.

## Recording a decision

```
t47 release set G07 --status accepted --evidence drive:<file id> --by "Gregg Clark"
t47 release status --strict
```

An agent identity cannot accept a gate, and the MCP bridge has no gate tool.
