# Target architecture

## Shape

```mermaid
flowchart LR
  Web[Next.js web portal] --> Shared[@mgt/shared DTOs + API client]
  Mobile[Expo mobile] --> Shared
  Shared --> API[Express versioned API]
  API --> Domain[@mgt/domain policy, scoring, routines]
  API --> Repos[Repository ports]
  API --> AI[AI gateway orchestration]
  API --> Adapters[Integration adapter ports]
  Repos --> DB[(Postgres/Supabase + RLS)]
  AI --> Knowledge[Approved knowledge + pgvector RAG]
  AI --> Providers[Model/provider adapters]
  Adapters --> Merchants[Retailer/product feeds]
  Adapters --> Clinics[Clinic/provider feeds]
  Adapters --> Booking[Booking/appointment systems]
  API --> Events[Consent-aware analytics + audit]
```

## Boundary responsibilities

### Clients

Web and mobile render shared DTOs and invoke the shared API client. They do not call model, merchant, clinic, booking, payment, or geocoding providers directly. They may display deterministic reasons, evidence references, commercial labels, consent state, and handoff status returned by the API.

### API/application layer

The API authenticates the caller, checks consent and authorization, validates DTOs, invokes deterministic domain policies, coordinates repositories and adapters, and returns bounded response envelopes. Every mutation gets an idempotency key and audit/event record where appropriate.

Proposed routers:

```text
/api/v1/skin-profile
/api/v1/ingredients
/api/v1/products
/api/v1/routines
/api/v1/treatments
/api/v1/providers
/api/v1/clinics
/api/v1/appointments
/api/v1/assistant
/api/v1/consents
/api/v1/progress
/api/v1/admin/catalog
/api/v1/admin/providers
/api/v1/admin/knowledge
```

### Domain layer

`@mgt/domain` owns concern taxonomy, ingredient compatibility, sensitivity ceilings, routine ordering, product eligibility, treatment suitability flags, disclosure rules, ranking inputs, and deterministic mutations. Domain functions receive explicit policy versions and never read process environment or call external services.

### AI gateway

`@mgt/ai-gateway` owns task selection, model routing, prompt versions, schema validation, budget reservation, fallback behavior, retrieval context limits, tool authorization, output screening, and routing telemetry. New tasks should be registered centrally and exposed through a typed request/response contract.

### Integration adapters

Adapters translate external data and actions into canonical internal DTOs. They must be replaceable, rate-limited, replayable in tests, and unable to write directly to user-owned tables without an application-layer authorization decision.

### Persistence

Postgres/Supabase remains the source of truth for durable user, reviewed content, catalog, provider, appointment-request, provenance, audit, and AI telemetry records. RLS protects user-owned data. Public catalog/provider data is still served through the API so moderation, freshness, and commercial labeling remain enforceable.

## Core data flow: personalized discovery

1. User completes or updates the existing Skin Match profile.
2. API loads the profile, consent, approved ingredient rules, active product records, and treatment safety constraints.
3. Domain policy filters unsafe/incompatible candidates and computes deterministic match reasons.
4. Search/ranking returns products, ingredients, and professional-service categories with provenance and commercial labels.
5. AI gateway optionally retrieves approved sources and generates a structured explanation; it cannot add an unreviewed treatment claim.
6. API returns the result with evidence references, uncertainty, safety notes, and next-step options.
7. User may save a routine/product/provider or request an external handoff. Each action respects consent and records only the minimum event needed.

## Deployment recommendation

Start as the existing modular monolith and worker. Add separate ingestion/search workers only when catalog/provider refresh volume or failure isolation requires it. Keep model providers and partner services behind HTTP adapters and secrets stored outside source control. Preserve the existing container, readiness, backup, and release-contract gates.
