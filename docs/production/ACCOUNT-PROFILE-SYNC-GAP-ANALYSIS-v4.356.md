# Account-profile synchronization gap analysis — v4.356

## Result

The local full-release harness passed before this checkpoint, and the focused account-profile, portal, web typecheck, mobile contract, and demo contract checks pass after the synchronization changes. This is local evidence only; it is not production or live-database evidence.

## Closed in v4.356

- Account profile data now produces a bounded `customer_context` contract for account overview, portal guidance, assistant routing, and reviewed Skin Coach responses.
- The context contains only profile readiness, preferred name, locale, timezone, measurement system, selected service interests, and the profile synchronization timestamp.
- The context is returned to the signed-in client for articulation; it is not added to the reviewed-knowledge prompt and is not sent to an AI provider.
- The web support and Skin Coach surfaces acknowledge the signed-in profile context while keeping saved profile data separate from reviewed answer content.
- Account-profile records are included in the guarded guest-to-account merge scope and protected by the account-profile lock during merge.
- A focused regression verifies that saved profile values reach articulated assistant output without exposing unrelated private records.

## Remaining gaps and release blockers

| Area | Status | Required next evidence |
| --- | --- | --- |
| Live PostgreSQL/RLS synchronization | Open | Staging connection, schema/RLS audit, reconciliation counts, cross-account isolation, race/failure tests, and restore rehearsal. |
| Supabase identity and Google OAuth | Open | Configured staging project, callback/redirect verification, token expiry/replay tests, and account-link rehearsal with approved merge decisions. |
| Android native account module | Open | Authenticated native account session, shared profile read/write contract, offline/retry behavior, and device acceptance. Current Android build links to the secure portal for account management. |
| External catalog/provider synchronization | Open | Adapter credentials, provenance/freshness evidence, deduplication, conflict handling, and scheduled import rehearsal. |
| Production image storage | Open | Approved object-storage decision, encryption/retention/deletion proof, image-processing boundary, and production consent review. Test Drive remains non-production only. |
| Full endpoint/unit exhaustiveness | Open | The verifier inventory currently marks 708 exported units and 173 endpoint declarations as needing explicit valid/boundary/malformed matrices; aggregate regression success does not close this gate. |
| Production operations and legal signoff | Open | Named owners, privacy/terms approval, support route, accessibility evidence, monitoring, rollback, backup restore, and launch authorization. |

## Interpretation

Core local components are integrated through shared contracts and the current regression suite. The remaining items are environment, external-system, native-mobile, evidence-completeness, and human-approval gaps—not reasons to enable production traffic prematurely.
