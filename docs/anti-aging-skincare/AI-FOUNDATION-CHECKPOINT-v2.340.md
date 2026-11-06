# Anti-aging AI foundation checkpoint — v2.340

Date: 2026-10-13
Scope: 65 safe increments after v2.275
Policy: `anti-aging-grounded-ai-1`

This checkpoint adds a grounded, reviewable AI boundary without enabling a live model, medical advice, diagnosis, image analysis, checkout, booking, or provider data transfer. The deterministic catalog and referral-only policy remain authoritative.

## Delivered increments

### Grounded task contracts (1–16)

1. Added a versioned anti-aging AI policy identifier.
2. Added an explanation task contract.
3. Added a structured search task contract.
4. Added a comparison task contract.
5. Added a provider-summary task contract.
6. Registered all four task types in the provider-neutral gateway.
7. Added prompt-version identifiers.
8. Marked each task as grounded.
9. Added structured explanation fields.
10. Added confidence values.
11. Added professional-assessment flags.
12. Added limitations and safety-note arrays.
13. Added citation source identifiers.
14. Added citation review-status fields.
15. Added shared search-result fields.
16. Exported the task registry for inspection and audit.

### Fail-closed explanation and question safety (17–32)

17. Added bounded summary validation.
18. Added bounded list validation.
19. Required at least one approved citation.
20. Limited citation counts.
21. Required citations to be in the retrieval set.
22. Required HTTPS citation URLs.
23. Rejected unapproved citation identifiers.
24. Rejected malformed citation excerpts.
25. Reused the domain blocked-term scan.
26. Added unsafe-claim checks for guarantees and medical instructions.
27. Added prompt-injection screening.
28. Added diagnosis and prescription boundary screening.
29. Added symptom and urgent-care escalation wording.
30. Added deterministic explanation construction from catalog provenance.
31. Added evidence-level-to-confidence mapping.
32. Prevented deterministic explanations from emitting invalid contracts.

### Search, feedback, and evaluation telemetry (33–44)

33. Added bounded reviewed-record search across ingredients, products, treatments, and providers.
34. Added explicit search uncertainty.
35. Added no-match behavior.
36. Added structured feedback ratings.
37. Added bounded feedback reasons.
38. Added bounded optional comments.
39. Added persistent AI event storage through the existing store boundary.
40. Added persistent feedback storage through the existing store boundary.
41. Added aggregate response metrics.
42. Added citation-failure metrics.
43. Added schema-failure metrics.
44. Added latency and cost aggregation.

### Fixture-backed catalog import (45–54)

45. Added a catalog adapter interface.
46. Added fixture-only import execution.
47. Added deterministic replay keys.
48. Added accepted-record reporting.
49. Added duplicate quarantine.
50. Added conflicting-record quarantine.
51. Added stale-record quarantine.
52. Added unapproved-record quarantine.
53. Added malformed-shape quarantine.
54. Kept the adapter credential-free and network-free.

### Provider moderation boundary (55–60)

55. Added provider directory adapter contracts.
56. Added provider qualification states.
57. Added pending moderation queue output.
58. Added rejected-provider quarantine.
59. Added deterministic city and region normalization.
60. Preserved independent-provider and external-handoff boundaries.

### API, privacy, and verification (61–65)

61. Added read-only ingredient explanation route.
62. Added read-only product explanation route.
63. Added structured anti-aging search route.
64. Added feedback route and restricted aggregate admin review endpoint.
65. Added telemetry retention and account-deletion cleanup coverage.

## Safety position

The new surface is educational and source-grounded. It does not diagnose, prescribe, assess a symptom, change a routine, book an appointment, buy a product, rank sponsored content as evidence, or send profile data to an external provider. Live AI providers remain disabled until a later release explicitly wires retrieval, production prompt approval, and evaluation gates.

## Verification

- `@mgt/domain` build: passed
- `@mgt/ai-gateway` build: passed
- `@mgt/shared` build: passed
- `@mgt/api` build: passed
- `@mgt/web` typecheck: passed
- Grounded-AI contract cases: passed
- Fixture adapter replay/quarantine cases: passed
- Anti-aging API integration cases: passed
- Existing v2.275 verification baseline remains the compatibility reference
