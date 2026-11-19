# Existing-stack assessment

## Audit scope

The audit covered the v2.195 repository structure, web/mobile entry points, Express API wiring, shared domain contracts, AI gateway, persistence migrations, portal safety/runtime boundaries, and current product/referral behavior.

## Existing capabilities to reuse

| Area | Current implementation | Assessment |
|---|---|---|
| Web | Next.js 15 app in `apps/web` with shared shell, Skin Match, routine, coach, shop, saved, support, admin, and account routes | Reuse the shell and route conventions; add feature routes as modules, not a second frontend. |
| Mobile | Expo app in `apps/mobile` using `@mgt/shared` and an API URL seam | Reuse shared DTOs and API client; keep presentation platform-specific. |
| API | Express app in `apps/api`; injected repositories; `/api/skin-match`, `/api/cart`, `/api/checkout`, `/api/coach`, admin routes, and `/api/v1` router | Extend with versioned domain routers and explicit feature dependencies. Do not expose vendor APIs directly to clients. |
| Domain logic | `@mgt/domain` provides profile vectors, concern enums, ingredient rules, deterministic scoring, routine construction, routine commands, RBAC, and evaluation helpers | Keep as the policy/rules layer. Add anti-aging and treatment concepts as versioned domain types. |
| AI | `@mgt/ai-gateway` provides task registry, provider adapters, fallbacks, budgets, schema validation, routing logs, LangChain prompt composition, and entitlement gates | Reuse as the orchestration boundary. Add task types and retrieval/tool ports; do not create feature-local model callers. |
| Knowledge/RAG | Postgres migrations define approved knowledge objects, pgvector embeddings, `knowledge.match`, evidence status, SME approval, and ingredient-rule versioning | Strong foundation for evidence-aware content. Add source provenance and freshness fields before ingesting broader clinical/provider data. |
| Safety | API input screening escalates urgent/clinical language; ingredient rules are versioned and approved; routine mutation is deterministic; portal runtime has hardened limits and shutdown behavior | Preserve these controls and make safety decisions first-class in all new DTOs and tasks. |
| Commerce | Current scope is external referral only; direct checkout/cart/payment paths are blocked by product policy even though legacy code remains | Keep external handoff as the default. Add adapter interfaces without enabling merchant checkout or affiliate attribution prematurely. |
| Persistence | Postgres/Supabase migration lineage with RLS, admin audit, consent, AI budgets/logs, catalog, routines, profiles, orders, and referral-era records; local portal store for development | Reuse Postgres and repository injection. Add migrations only after canonical contracts are approved. |
| Verification | Package builds, focused API/domain/AI tests, web production build and route contracts, infrastructure/security gates | Add new contract and safety suites beside existing gates; do not weaken current release gates. |

## Important current constraints

1. The current scope is an external-referral portal. It explicitly does not claim retailer partnerships, direct fulfillment, live provider booking, medical diagnosis, or production readiness.
2. Catalog data can be demo/sample data; sample records must never be presented as purchasable or provider-certified.
3. AI providers and production PostgreSQL/identity are not live-verified in the local workspace. New integrations need ports, fakes, and contract tests before live credentials.
4. The existing API has both legacy `/api/*` routes and an evolving `/api/v1` surface. New public functionality should use a single versioned namespace and an explicit migration policy.
5. The repository contains historical untracked evidence. It must remain preserved and outside feature commits unless a specific receipt is intentionally added.

## Capability gaps

### P0 — blocking foundations

- Canonical product/ingredient/treatment/clinic/practitioner/provider DTOs with ownership, timestamps, provenance, freshness, and access policy.
- Consent categories for personalization, sensitive skin information, treatment history, photos, reminders, and partner handoffs.
- Evidence and claim taxonomy that distinguishes cosmetic education, professional information, and medical content.
- Adapter ports for catalog ingestion, clinic directory ingestion, geocoding/search, merchant links, appointment requests, and notifications.
- API versioning and authentication rules for user-owned records versus public reviewed content.

### P1 — first user value

- Anti-aging/antioxidant discovery dashboard built on existing Skin Match profile and routine engines.
- Ingredient explorer and compatibility checker using approved rules and reviewed knowledge.
- Product comparison and routine planning DTOs with deterministic eligibility and transparent reasons.
- Clinic/provider directory with service-area filtering, qualification display, verified-review policy, and no implied endorsement.
- AI tasks for evidence-aware explanations, comparisons, and conversational search with citations.

### P2 — integration and optimization

- Freshness-aware catalog/provider synchronization and conflict resolution.
- Geospatial indexing, map UI, availability summaries, and booking handoffs.
- Progress/adherence tracking, reminders, feedback, and privacy-preserving analytics.
- Editorial/admin workflows, data-quality dashboards, AI evaluation runs, partner attribution, and cost optimization.

## Architectural decisions recorded by this audit

- Use the existing Express API, Postgres/Supabase persistence, Next.js web app, Expo client, `@mgt/domain`, `@mgt/shared`, and `@mgt/ai-gateway`.
- Use a modular monolith with ports/adapters first. Split services only when measured load, isolation, or partner requirements justify it.
- Keep deterministic policy and ranking before model generation. Models may explain or retrieve; they do not authorize treatment, override rules, or mutate records.
- Treat clinics and procedures as reviewed directory information plus professional-assessment handoffs, not as universally suitable recommendations.
- Keep commercial placement separate from evidence ranking and label it in every API/UI representation.
- Do not introduce photographs or image analysis in the first implementation wave.
