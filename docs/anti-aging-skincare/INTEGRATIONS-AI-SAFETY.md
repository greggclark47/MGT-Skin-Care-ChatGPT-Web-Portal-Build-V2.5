# Integrations, AI orchestration, safety, and privacy

## Adapter inventory

| Adapter port | Input | Output | First implementation |
|---|---|---|---|
| `ProductCatalogSource` | Feed cursor, merchant config | Product/brand/ingredient observations | File/HTTP fixture adapter; live merchant later |
| `ProviderDirectorySource` | Region, cursor | Provider/location/service observations | Curated JSON fixture plus admin import |
| `Geocoder` | Address or coordinates | Normalized location and geohash | Stub in tests; approved provider later |
| `SearchIndex` | Canonical query/filter | IDs plus freshness/ranking metadata | Postgres search first; dedicated index only after measurement |
| `BookingAdapter` | Appointment request | External handoff/request status | External link/request receipt first |
| `MerchantLinkAdapter` | Product/merchant ID | Validated external URL and commercial label | Referral-only, no checkout |
| `NotificationAdapter` | Consent-approved event | In-portal notification receipt | Existing in-portal alerts first |

Each adapter must expose health, capability, timeout, retry, rate-limit, provenance, and error classification. Partner failures degrade to a clear unavailable state; they never erase canonical data or block routine education.

## AI task additions

Extend the central registry only after schemas and evaluation cases exist:

```text
ingredient_explanation
ingredient_compatibility_summary
product_comparison
routine_explanation
treatment_education
provider_discovery_summary
conversational_search
recommendation_narrative
```

Each task declares whether it is grounded, which source types are permitted, whether user consent is required, its maximum context size, output schema, budget class, fallback behavior, and escalation policy. `treatment_education` and `provider_discovery_summary` must be grounded and must include evidence IDs plus a professional-assessment disclaimer.

## Retrieval policy

1. Retrieve only approved knowledge objects and active provenance records.
2. Filter by entity type, concern, jurisdiction, language, and freshness before similarity ranking.
3. Keep source IDs and excerpts attached to the model context and response.
4. Reject answers that cite missing, retired, stale, or mismatched sources.
5. Treat model output as a draft explanation. Deterministic policy decides eligibility, warnings, commercial labeling, and next-step availability.
6. Do not use user photos, treatment history, or sensitive free text for model training or partner sharing unless a separate explicit consent exists.

## Safety boundaries

- Cosmetic guidance is not diagnosis, prescribing, or individualized medical treatment advice.
- Red-flag symptoms, severe reactions, pregnancy-related questions, suspected disease, medication interactions, or invasive/procedural questions route to professional assessment language.
- Procedures and injectables are displayed as informational categories with risks, limitations, provider qualification requirements, and recovery considerations; they are not ranked as universally suitable.
- The platform does not infer clinical suitability from age alone, and it does not make claims from before/after imagery.
- Ingredient incompatibility and sensitivity ceilings are reviewed policy inputs. The model cannot override them.
- Routine changes are deterministic, previewed, and user-confirmed. No model-authored routine mutation is accepted.
- Sponsored/partner/affiliate placements are separate fields and never alter evidence ranking without an explicit, disclosed commercial policy.

## Consent and privacy model

Add distinct, revocable consent types rather than one broad checkbox:

```text
personalization
sensitive_skin_information
treatment_interest
progress_tracking
reminders
provider_handoff
commercial_attribution
photo_analysis (future, disabled)
```

Store consent version, purpose, timestamp, actor, jurisdiction, and revocation. Minimize location precision for discovery, keep appointment details scoped to the user and authorized provider adapter, encrypt secrets and sensitive blobs, and apply retention classes to progress, conversations, events, and provider requests.

## Review workflow

All clinical/evidence-bearing content enters draft, review, approved, and retired states. SME approval is separate from partner submission. A source update creates a new version or import observation; it never silently overwrites the evidence used by a previous recommendation.
