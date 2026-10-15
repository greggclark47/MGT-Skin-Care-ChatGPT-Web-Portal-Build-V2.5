# Match intelligence checkpoint v4.345

Status: repository implementation and local verification only. This checkpoint is not a production deployment, medical-device determination, retailer endorsement, or regulatory approval.

## Shared capability

The web portal and Android API now consume one versioned `MatchIntelligence` contract. The backend creates it after reviewed ingredient rules remove ineligible products, deterministic scoring ranks the remaining catalog, and the routine engine selects a product for each eligible slot.

The response records:

- the questionnaire datapoints used and how each affects matching;
- required-step coverage, optional-step coverage, eligible-candidate count, exclusion count, and a bounded coverage label;
- a deterministic explanation for each routine product, including score, reason codes, key ingredients, sensitivity status, placement, cautions, and alternatives;
- scoring, routine, match-intelligence, and safety-matrix versions;
- a retailer-directory handoff derived from routine slots; and
- explicit limitations and the current image-analysis boundary.

## Product feedback loop

Each included routine product can be marked **Comfortable**, **Not right**, or **Irritated** in
the web portal. The record is purpose-limited to the saved profile, contains no free-text health
notes, and is removed with that profile.

- **Not right** and **Irritated** place only that product ID on the profile's reversible exclusion
  list, so it is omitted from later deterministic routine matches.
- **Irritated** also changes the saved sensitivity selection to `high` before rebuilding the
  routine, and the interface tells the person to stop products that irritate them and seek
  professional advice for persistent or severe symptoms.
- **Comfortable** records the latest response but does not loosen safety rules or promote a
  product.

The check-in accepts feedback only for a product currently present in the person's routine,
requires the current profile revision, and rebuilds the result transactionally. It does not infer
diagnoses, ingredient causality, or treatment response. A later full Skin Match retake begins a
fresh profile result rather than silently carrying former product exclusions forward.

## Decision boundary

Product inclusion, exclusion, ranking, and routine placement remain deterministic and auditable. `ai_narrative_status` is `not_requested` in this version. Optional AI copy may later explain an already-reviewed result, but it must not select, rank, include, exclude, diagnose, prescribe, or silently change a routine.

Photos are not used by the matching engine. Retailer links are discovery routes only; they do not establish personal suitability, current price, availability, shipping, returns, or a commercial relationship.

## Platform behavior

- Web: My Routine shows coverage, all datapoints, method versions, product explanations, limitations, and an external-retailer discovery handoff.
- Android: the completion view shows core coverage, eligible-product count, the first four datapoints, the AI-ranking boundary, image limitation, and a secure portal link for the full result.
- Backend: both `/api/hub/profile` and `/api/skin-match/complete` generate the same domain contract.
- Static demo: v4.344 previews datapoints, coverage, product evidence, retail handoff, and the AI boundary with sample records only.

## Production prerequisites

Before relying on this capability in production, operators still need approved catalog and ingredient records, verified formula freshness, production database evidence, monitored scoring distributions, accessibility validation on supported devices, privacy/legal approval, incident ownership, retailer-link review, and release authorization. Coverage labels describe catalog completeness for the current routine; they are not clinical confidence scores.
