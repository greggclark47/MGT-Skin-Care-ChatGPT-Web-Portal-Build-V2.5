# Anti-aging experience checkpoint — v2.275

Status: implemented locally from v2.230. This checkpoint covers 45 safe increments across the initial anti-aging experience. The new experience is educational, preview-only, and referral-only. It does not diagnose, prescribe, save sensitive health information, book appointments, or process purchases.

## 45 increments

1. Added anti-aging goal contracts.
2. Added sensitivity-level contracts.
3. Added onboarding input contracts.
4. Added onboarding preview response contracts.
5. Added routine preview request contracts.
6. Added routine preview step contracts.
7. Added explicit confirmation-required state for previews.
8. Added consent-aware onboarding status.
9. Added optional personalization consent handling.
10. Added no-consent browsing path.
11. Added deterministic product selection for routine previews.
12. Added ingredient-avoidance exclusion logic.
13. Added sensitivity-aware retinoid caution text.
14. Added routine step ordering.
15. Added AM/PM placement rules.
16. Added preview-only safety notes.
17. Added bounded onboarding goal parsing.
18. Added bounded routine product parsing.
19. Added invalid onboarding rejection.
20. Added invalid routine-preview rejection.
21. Added missing-product rejection.
22. Added provider external-handoff contract.
23. Added zero-data-shared provider handoff.
24. Added explicit no-live-booking provider state.
25. Added provider discovery allowlist boundary.
26. Added portal access allowlist entries for onboarding.
27. Added portal access allowlist entries for routine previews.
28. Added shared API-client onboarding method.
29. Added shared API-client routine-preview method.
30. Added shared API-client provider-handoff method.
31. Added anti-aging explorer page.
32. Added reviewed discovery category tabs.
33. Added ingredient search UI.
34. Added product search UI.
35. Added treatment discovery UI.
36. Added provider discovery UI.
37. Added product selection controls.
38. Added routine preview controls.
39. Added onboarding goal controls.
40. Added sensitivity controls.
41. Added explicit personalization consent checkbox.
42. Added sample-only product disclosure.
43. Added independent-provider disclosure.
44. Added anti-aging navigation entry and application-hub card.
45. Added API, portal, domain, and web smoke verification coverage.

## Verification

- `@mgt/domain` build: passed.
- `@mgt/shared` build: passed.
- `@mgt/api` build: passed.
- `@mgt/web` typecheck: passed.
- Anti-aging API contract test: passed.
- Existing portal regression: passed.
- Full web smoke suite: passed.
- Existing migration-lineage and domain contract checks remain green from v2.230.

Live provider feeds, qualification verification, appointment requests, AI explanations, image analysis, sponsored ranking, direct commerce, and production migration application remain gated for later phases.
