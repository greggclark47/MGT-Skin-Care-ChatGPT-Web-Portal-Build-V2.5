# Anti-aging roadmap checkpoint — v2.405

Date: 2026-10-13
Scope: 65 safe increments after v2.340
Policy: `anti-aging-roadmap-1`

This checkpoint extends the anti-aging experience with privacy-safe progress records, referral-only commerce measurement, appointment handoff seams, bounded city discovery, data-quality reporting, and launch-readiness gates. It does not enable checkout, live booking, geocoding, live AI, image analysis, or medical inference.

## Delivered increments

### Referral-only merchant boundary (1–12)

1. Added a merchant referral contract.
2. Added an explicit allowlist check for destination hosts.
3. Required HTTPS referral destinations.
4. Removed destination query parameters before handoff.
5. Rejected credentials and fragments in referral destinations.
6. Added commercial disclosure labels.
7. Declared zero profile data shared in referral links.
8. Added aggregate-click-only measurement semantics.
9. Added a read-only referral preview route.
10. Added a store-backed click counter.
11. Added per-day, per-product aggregation.
12. Added retention coverage for aggregate referral counters.

### Consent-scoped progress and adherence (13–24)

13. Added progress status contracts.
14. Added progress timestamp validation.
15. Added bounded consent versions.
16. Added explicit `progress_tracking` consent enforcement.
17. Added idempotent progress entry writes.
18. Added owner-scoped progress reads.
19. Added completed/skipped/irritation/no-change counts.
20. Added completion-rate aggregation.
21. Added non-diagnostic adherence wording.
22. Added progress record deletion.
23. Added progress retention policy.
24. Added shared web client methods for progress operations.

### Appointment handoff seam (25–36)

25. Added appointment request contracts.
26. Added purpose-specific provider-handoff consent.
27. Added idempotency-key validation.
28. Added deterministic request identifiers.
29. Added owner-scoped request storage.
30. Added provider existence checks.
31. Added requested-window bounds.
32. Added `handoff_pending` status.
33. Added partner acknowledgement status semantics.
34. Added uncertain-status semantics.
35. Added a status/webhook application seam.
36. Kept `booking_supported` false and `data_shared` empty.

### Privacy-preserving provider discovery (37–45)

37. Added bounded city search.
38. Added radius limits.
39. Added result limits.
40. Added whitespace-normalized city matching.
41. Declared city-level location precision.
42. Explicitly disabled geocoding.
43. Added uncertainty copy for approximate discovery.
44. Preserved independent-provider handoff.
45. Added shared web client support for nearby discovery.

### Data quality and operations (46–55)

46. Added catalog quality summary contracts.
47. Counted approved records.
48. Counted unapproved records.
49. Counted stale records.
50. Counted invalid source URLs.
51. Added per-record-type counts.
52. Added review-required state.
53. Added restricted admin quality reporting.
54. Added restricted anti-aging readiness reporting.
55. Added retention and account-deletion coverage for new account-owned scopes.

### Launch-readiness gates (56–65)

56. Added live-AI gate input.
57. Added checkout gate input.
58. Added booking gate input.
59. Added image-analysis gate input.
60. Added approved-catalog gate input.
61. Added accessibility gate input.
62. Added restore-verification gate input.
63. Added privacy-review gate input.
64. Added blocked/conditional/ready output states.
65. Added the explicit rule that readiness is a report, not launch authorization.

## Safety and privacy position

Progress is opt-in and removable. Stored appointment requests contain only the provider reference, handoff consent, status, and bounded scheduling preference; they do not contain symptoms, diagnoses, photos, or profile data. Referral URLs do not contain user identifiers. Provider discovery uses reviewed city records and does not infer a precise location. All external booking and commerce actions remain outside MGT.

## Verification targets

- Domain roadmap contracts and aggregates
- Authenticated progress/referral/appointment integration
- Existing anti-aging API routes
- Existing portal, operations, web smoke, and production web build checks
- GitHub source backup and immutable source archive
