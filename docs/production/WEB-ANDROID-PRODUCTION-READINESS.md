# MGT Skin Care v2 - Web and Android production readiness

Status: repository-side preparation updated; production and store release remain blocked until the external evidence below is collected and approved.

This register is an engineering release aid, not legal advice, a regulatory certification, or a production approval. Apple setup is intentionally excluded from this release scope.

## What is implemented in this checkpoint

- Android EAS profiles for development, internal preview APK, and production Play App Bundle.
- Android package identity, version code, no optional permissions, and cleartext traffic disabled.
- Mobile production API configuration fails closed instead of silently using localhost.
- Mobile privacy and terms links are explicit HTTPS release inputs.
- Web footer and route map include Privacy, Terms, and the AI disclosure boundary.
- Google Play Data safety draft for the current mobile surface.
- A release register that separates local evidence from human, vendor, account, and deployment evidence.
- API readiness fails closed unless both backup freshness and isolated restore verification are present,
  valid, non-future, and within their configured age windows; the public projection exposes only
  sanitized health categories.
- Backup verification admission is monotonic: older receipts cannot replace newer backup/restore
  evidence, timestamp-equal conflicting receipts are rejected, and exact retries are idempotent.
- An optional signed backup-attestation endpoint is available for an approved machine backup
  service; it is disabled by default, replay-safe, and retention-pruned until explicitly configured.
- The API now exposes a deterministic, side-effect-free backup-attestation request builder that
  produces the exact body, digest, and HMAC headers for an approved publisher; it performs no
  network call and does not enable publication by itself.
- The production compose contract declares its runtime mode explicitly, keeps disabled AI endpoint
  settings empty, and uses the configured worker readiness window for container health.
- The API service, worker service, and API image healthcheck share the same worker interval and
  readiness-age declaration; disabled OpenClaw mode no longer carries a residual provider mode.
- Production PostgreSQL startup now performs a read-only exact migration-ledger reconciliation;
  missing, reordered, changed, or unexpected portal migrations stop the API/worker before traffic.
- The same startup gate verifies RLS is enabled on the server-side portal tables and that the
  reviewed database role has the required RLS authority; it does not mutate the target database.
- Production admission now rejects test-only Google Drive image-storage flags, credentials and folder
  references, while validating the Supabase Google identity-mode declaration before startup.
- Signed backup-attestation enablement, key shape, replay-age and retention settings now use the same
  fail-closed contract in direct API/worker startup admission and deployment preflight.
- Durable follow-up tasks now have generation-fenced claims, future-time refusal, bounded retries,
  overdue blocking, retention, and aggregate operations-health reporting; no task executor is
  enabled implicitly.
- Release export tooling can now create an idempotent candidate ZIP directly from the pinned Git
  commit under `work/exports/`; a pre-existing archive is accepted only when its bytes and digest
  reproduce that same commit.
- The Drive archive transfer contract now prepares resumable-upload metadata, export-ID
  reconciliation, and exact content/parent/property readback without making a network call or
  enabling production OAuth.
- A recovery-drill review contract now validates candidate continuity, distinct isolated restore
  targets, measured RTO/RPO, restored migration version, rollback and failed-restore evidence,
  and the accountable decision without executing a live restore.
- Production preflight now requires the operations-alert lease to exceed its delivery timeout by
  a five-second safety margin, preventing stale-worker completion of a slow alert attempt.
- Release evidence CLI readers now reject duplicate JSON object keys before receipt, closeout,
  launch, or execution evidence enters the checksum-bound review chain.
- Production preflight now requires the complete operations and retention policy tuple explicitly;
  production cannot silently inherit worker defaults for notifications, alerts, follow-ups, or
  operational data retention.
- The edge now authenticates forwarded client addresses with a private shared token. Unauthenticated
  or malformed forwarded addresses fall back to the socket address for anonymous-session throttling;
  production startup and preflight require a distinct injected token. Keep the API network private.
- Email and Google sign-in now keep account switching separate from guest onboarding: only an
  anonymous guest may merge saved records. Switching between signed-in identities rotates the
  session without copying the previous account's profile, preferences, or wardrobe.
- Test Google Drive image connection now checks the configured or previously created folder's
  identity, type, trash state and upload permission, rather than treating a refreshed OAuth token
  alone as proof that images can be saved. An uncreated folder remains a first-upload setup step.
- A queued account-deletion request now prevents new test Drive image uploads at the deletion
  worker's account lock; existing images remain available for the customer to remove so deletion
  can proceed after their test copies are gone.
- New test Drive uploads require a signed-in account. Historical guest test-image records transfer
  during account linking (including when a profile merge choice is needed), preserving both image
  libraries and bringing those copies under account export and deletion checks. In-progress legacy
  uploads delay linking instead of silently orphaning a copy.
- Test Drive removal now has a leased, retryable ownership state. Linking waits for an active
  removal rather than moving a record for a file being deleted; removal failures keep the record
  visible and account deletion blocked. Identity linking also refuses an account already in its
  processing deletion stage, and direct account-profile merging shares the profile write lock.
- A provider-verified email change on the same identity now refreshes the account and its support
  contact records, preserves ID-bound data and roles, and revokes earlier local sessions. Malformed
  identity subjects fail before account creation or session rotation; this does not substitute for
  a live Supabase sign-in and recovery rehearsal.
- A non-mutating Ed25519 approval-envelope verifier now binds candidate, artifact, role, key,
  signer-subject reference, validity window, payload checksum, and signature before approval
  evidence can be reviewed; human identity and production authorization remain external gates.
- Anti-aging readiness switches and operational retention are now explicit, bounded production inputs;
  they report gates only and do not activate checkout, booking or image analysis.
- Reviewed assistant outputs now carry profile, consent, prompt, safety-policy, reviewed-content and
  expiry references. The API stores only structured result/citation metadata (not the customer's
  question, answer text or hidden reasoning), rejects delivery when profile, consent or cited content
  changes during generation, and marks prior traces stale after later changes. Sanitized owner-only
  trace metadata is included in account export; AI-log retention and account deletion cover the record.
- Account export now reuses the safe consent projection, excludes internal consent ownership fields,
  and is bounded to five requests per account per hour. Account deletion removes durable consent and
  pending OAuth/PKCE records, plus guest memberships linked to the deleted owner's invitations.
  Operations cleanup removes expired OAuth flows and atomically retires expired invitation pointers;
  revoked guest access remains fenced until that reviewed expiry boundary.
- Customer-facing anti-aging progress, reminder and appointment responses now use exact public-field
  projections that exclude internal actor metadata. Account export includes the owner's anti-aging
  progress, reminders, appointment requests, AI quality events and optional feedback comments while
  excluding provider-routing details, arbitrary internal fields and every other customer's records.
- Production runtime readiness now includes the approved catalog itself. It returns only the bounded
  `catalog_unready` issue when a core routine slot lacks an in-stock eligible product, an active product
  has invalid ingredient metadata, or an ingredient lacks a valid independently approved SME rule.
  Public catalog browsing and routine generation independently enforce the same gate. The authenticated
  operator view reports active, approved and eligible counts without exposing product names, customer
  profiles or vendor details through the public readiness endpoint.
- The reviewed knowledge-library route now projects only `id`, `title`, `body`, and `source_url`.
  Author, reviewer, approval, version, revision, and review-note metadata remain server-side even when
  an article is approved and publicly retrievable.
- The public company route now projects only published identity, support, affiliations, and policy
  status fields; tax, billing, operational, and internal-note settings remain server-side.
- The authenticated session route now projects only account ID, email, and bounded roles needed by
  the portal. Identity-provider, provider-subject, login-timestamp, and internal account metadata
  remain server-side.
- Session roles are also filtered through the reviewed operator-role catalogue so unknown internal
  role labels cannot reach the browser.
- Operator readiness now distinguishes an intentionally disabled optional billing phase from a
  failed enabled billing configuration. Lean/referral releases show billing as not applicable;
  enabling subscriptions still requires the complete Stripe and terms contract.
- The authenticated operator snapshot now uses exact projections for catalog, knowledge, support,
  order, job, and company records. Actor/email fields, payment and vendor identifiers, and private
  notes remain outside the reviewed console response.
- Anti-aging discovery, comparison, and nearby-provider routes now expose only customer-facing
  record fields plus a bounded provenance summary. Import-run, ingestion, reviewer, and external-ID
  metadata remain server-side.
- Style-profile and wardrobe reads, including account export and legacy-array compatibility, now
  allowlist customer fields so unknown actor, photo, revision, and private-note fields stay private.
- Saved skin-match profiles, routine steps, match intelligence, score results, feedback, and account
  exports now use exact customer-facing projections. Raw records remain available only inside locked
  mutation paths, so contaminated actor, provider, internal-trace, and private-note fields stay private.
- Account-profile reads and exports now use the validated customer profile, communication/accessibility
  preferences, image-storage choice, timestamps, profile version, and revision only. Stored actor,
  provider-subject, and private-note fields remain server-side.
- Customer reminder reads and account exports now expose only product, due date, and paused state.
  Worker delivery identifiers, notification timestamps, and private notes remain server-side.
- Saved-retailer reads and account exports now expose only IDs from the reviewed retailer directory;
  unknown or contaminated stored values are filtered and deduplicated.
- Account export now allowlists regimen-cycle and check-in fields, preserving legacy partial records
  while excluding actor, consent, and arbitrary private fields.
- Account export now allowlists order references, status, line items, totals, currency, and timestamps;
  payment identifiers, actor/email fields, vendor metadata, and arbitrary private fields remain excluded.
- Customer notification reads and exports now use exact envelopes and kind-specific payloads; delivery
  leases, claims, error details, actor fields, and arbitrary payload notes remain server-side.
- Direct regimen-cycle list, create, summary, check-in, and export responses now use exact reviewed
  projections; actor, consent, and arbitrary private fields remain server-side while cycle scheduling,
  check-in, and deletion behavior remain unchanged.
- Account-export Test Drive image metadata now uses a validated projection for approved purposes,
  bounded names and sizes, timestamps, and removal state; Drive identifiers, actor fields, malformed
  records, and arbitrary private metadata remain excluded without changing test-storage behavior.
- Account overview readiness counts now derive from validated public-shaped records, so malformed or
  incomplete actor-matching rows cannot overstate setup progress; the response remains metadata-only.
- Anti-aging progress, reminder, and provider-handoff responses now exclude malformed actor-matching
  records from lists, summaries, previews, controls, exports, and account export while deletion remains
  privacy-complete.
- Customer Support reads and account exports now require bounded valid ticket/reply projections;
  malformed tickets are excluded and malformed replies are dropped while actor, email, assignment,
  escalation, source, and private metadata remain server-side.
- Operator/admin Support reads and aggregate Support metrics now reuse the validated projection;
  invalid rows are excluded, invalid replies are removed before operator updates, operator-only
  assignment/escalation/first-response fields are bounded, and invalid tickets cannot be updated.
- Account-export AI traces now require bounded identifiers, task/version fields, consent and
  knowledge revisions, result kinds, valid timestamps, and bounded citation references; malformed
  traces are excluded without changing stale-state semantics or AI provider routing.
- Account-consent reads and account exports now require the current AI disclosure version, valid
  capture/revocation timestamps, and internally consistent grant state; malformed disclosures fail
  closed as `null` without changing consent enforcement or AI routing.
- Account-export and V1 subscription ownership/entitlement projections now require structurally valid
  stored subscription records; malformed identifiers, customer references, flags, periods, and
  timestamps are excluded or fail closed without changing Stripe or external payment behavior.
- `/billing` and `/billing/activity` now expose only validated membership and activity fields and
  reject malformed customer references before Stripe read calls; invalid billing rows are omitted
  without changing checkout, webhook, portal, trial-cycle, or payment behavior.
- Account-export and operator anti-aging AI telemetry now require approved response/task/validation
  fields, bounded latency and cost values, valid ratings/reasons/comments, and valid timestamps;
  malformed event and feedback rows are excluded without changing telemetry recording or AI routing.
- Customer session, deletion-request, and account-export views plus the operator deletion queue now
  require valid request IDs, lifecycle states, timestamps, attempt counts, blocker codes, and
  completion proofs; malformed rows fail closed or are excluded without changing deletion workflow.
- The operator subscription-webhook health view now requires valid receipt IDs, event types,
  lifecycle statuses, counters, timestamps, and sanitized error codes; malformed receipts are
  excluded from operational counts and alerts without changing signed webhook processing.
- Operations-health and alert-history views now require validated alert IDs, delivery states,
  attempts, timestamps, retry values, alert codes, and sanitized error codes; malformed events are
  excluded from counts and history without changing alert delivery or worker behavior.

## Current local verification checkpoint

The current local working-tree checkpoint is F1090. It combines F1076's API policy-publication
admission with F1077's stricter Android policy-link parsing: non-development builds reject policy URLs
with embedded credentials, ports, query strings, fragments, placeholders, local hosts, or missing
public hostnames. The API and Android therefore require the same distinct approved public policy
locations before their customer path becomes available. The worker remains independent because it
does not serve customer policy links. F1078 also requires the public HTTPS account portal in an
Android production build and gives signed-in members a direct handoff to its privacy, data-export,
and account-deletion controls. F1079 applies the same public-HTTPS parsing to the Android API endpoint,
so Skin Match stays unavailable when any customer-facing release URL is unsafe. F1080 adds a candidate
environment preflight for the five Android public URLs and blocks secret-shaped public environment names,
without echoing configuration values. F1081 invokes that preflight from the standard Android production
build command before EAS runs. F1082 synchronizes every production-ready release fixture with the
same distinct public policy locations, so owner, prerequisite, environment, and readiness contracts
exercise their intended controls rather than stopping at an unrelated policy-configuration blocker.
F1083 additionally makes a separate evidence-bound approval for the published Privacy Notice, Terms
of Use, and AI Disclosure mandatory before the production-environment review can be ready; a generic
subscription-terms record cannot substitute for that three-policy approval.
F1084 carries the same policy-publication approval into the candidate-bound production input intake,
which now emits and validates one exact set of twelve evidence references regardless of whether
preflight configuration is already ready. Every evidence id and requirement must appear exactly once.
F1085 adds the same approval as an explicit external prerequisite and prerequisite-review record,
so policy approval is visible and evidence-bound from the first production packet through intake and
environment review rather than appearing only in a later handoff.
F1086 makes that prerequisite-review evidence a structured, candidate-bound approval record: it must
have a safe approval reference, a past approval time, and exactly three distinct public HTTPS URLs for
the Privacy Notice, Terms of Use, and AI Disclosure. Missing, duplicated, unsafe, future-dated, or
substituted records fail closed before a candidate can be reviewed.
F1087 carries the exact artifact forward: the production-environment review revalidates the structured
approval and requires its reference, checksum, and byte count to match the approval accepted by the
prerequisite review. A different or altered policy artifact cannot be substituted at the later stage.
F1088 requires the backup/restore prerequisite to be a ready, candidate-bound recovery-drill review
with checksum-verified restore-transcript, rollback-plan, and failed-restore evidence. A generic note
cannot satisfy recovery proof.
F1089 independently validates the serialized ready recovery review, rejecting altered acceptance
decisions, measurements, migration identity, or evidence fields even when its checksum is recomputed.
F1090 binds every production database structural audit to one exact candidate commit; an audit without
that binding remains blocked and cannot be reused as release evidence for another build.
It also combines the F1021 reviewed
production-admission parity boundary, F1022 Android source-boundary verification, F1023's
private evidence-archive implementation plan, F1024–F1029's scoped secret-injection and stage
isolation controls, F1030's catalog runtime safety boundary, F1031's reviewed-knowledge
public projection, F1032's company-settings public projection, F1033's authenticated-session
public projection, F1034's session role allowlist, F1035's optional billing readiness semantics,
F1036's operator snapshot projection, F1037's anti-aging public catalog projection, F1038's
style/wardrobe projection, F1039's skin profile/routine projection, and F1040's account profile
projection, F1041's replenishment reminder projection, F1042's saved-retailer projection, and
F1043's regimen export projection, F1044's order export projection, F1045's notification payload
projection, F1046's direct regimen-cycle projection, F1047's image-export projection, and
F1048's account-overview integrity counts, F1049's anti-aging record integrity projection, and
F1050's Support record integrity projection, F1051's operator Support integrity projection, and
F1052's AI output trace integrity projection, F1053's AI disclosure projection integrity,
F1054's subscription projection integrity, F1055's billing read projection integrity,
F1056's anti-aging AI telemetry projection integrity, F1057's deletion-request projection
integrity, F1058's subscription-webhook health projection integrity, and F1059's operations-alert
history projection integrity, F1060's AI routing telemetry projection integrity, and
F1061's AI budget projection integrity, and F1062's AI reservation reconciliation
projection integrity, F1063's Support metric projection integrity, and F1064's referral
metric projection integrity, and F1065's anti-aging search telemetry projection integrity.
F1066 adds operator snapshot integrity projection for catalog products, ingredient rules,
reviewed knowledge, order references, and job summaries; malformed persisted rows now fail
closed at the `/admin` boundary. F1067 adds current operations alert-state projection
integrity; malformed alert delivery state now fails closed to a safe `not_sent` view. F1068
adds strict input projections for the operational aggregates feeding `/admin/operations-health`.
F1069 adds a validated operator audit projection so malformed audit rows fail closed at `/admin`.
F1070 adds notification record integrity for customer reads and account export. F1071 adds
public catalog product integrity while preserving the established legacy field fallbacks.
F1072 adds strict reviewed-knowledge integrity for public article reads. F1073 adds
strict company-settings integrity for public company reads, including bounded text, valid
support email, bounded affiliations, safe defaults, and an exact publication flag. F1074 adds
legacy-order integrity projection: malformed stored orders are excluded from customer export and
operator references rather than being returned with partial values.
The static operator demo still
displays the last externally archived F1023 boundary because no new external publication was
performed; neither view implies that live evidence exists.

- `node infra/portal/verify.cjs` passed 1,359/1,359 local regression and release-control checks on
  2026-10-30; the evidence report is
  `work/verification/2026-10-30T23-30-43-008Z/report.md`.
- `pnpm release:checkpoint` passed all local gates and recorded the production preflight as
  **BLOCKED** with release decision **NOT READY**; the checkpoint is
  `work/checkpoints/2026-10-30T23-30-36-008Z/report.md`.
- The optimized web production build generated 40 routes, and the production proxy journey passed.
- The static demo contract, static build and generated-artifact scan passed after the v4.380
  checkpoint update. The operator demo's four exact reviewed AI/billing vendor disclosures are
  copy- and file-bound; added, duplicated or configuration-shaped vendor references still fail.
- `pnpm test:mobile-contract` passed the Android Expo configuration, shared Skin Match, and
  accessibility/tap-target contract checks.
- F1076 scoped verification passed the shared production-admission build and contract, API build,
  48/48 API runtime-admission checks (including pre-database startup rejection), and web smoke
  render checks. This is local source and fixture evidence only; it does not publish or approve
  the required policy locations.
- F1077's Android policy-link parsing contract passed 3/3. It is not an Android device, EAS, or
  Play Console test and does not substitute for the required internal-track acceptance evidence.
- F1078's Android portal handoff and production-portal configuration contract passed 3/3. It is
  local source evidence only; internal-track acceptance must confirm the signed-in portal route,
  data export, and account deletion path against the deployed environment.
- F1079's Android endpoint parity contract requires a public HTTPS API endpoint alongside the portal
  and three customer policy links. It is local source evidence only; an internal-track build must
  verify the deployed API route and customer flow before release.
- F1080's Android candidate-environment preflight contract validates the complete public URL set and
  rejects secret-shaped public variable names. Running it against a real EAS environment remains an
  external release-evidence step and must not expose values in logs or the ship packet.
- F1081's mobile contract binds the standard production-build command to that preflight. A direct
  EAS invocation remains outside the repository command boundary and is still stopped by the
  app's runtime configuration gate.
- F1082's full local verifier passed all 1,352 checks, including 125 production-owner,
  prerequisite, and readiness contract cases that now run beyond the policy-publication gate.
  This is local fixture evidence only and does not replace the live environment, recovery, or
  approval evidence required for release.
- F1083 requires a distinct, evidence-bound approval record covering the published Privacy Notice,
  Terms of Use, and AI Disclosure before the production-environment review can become ready. It
  rejects a generic subscription-terms substitute; the real approval remains external evidence.
- F1084 makes the production input intake version 1.1 and binds it to exactly twelve named evidence
  references, including policy publication approval. This prevents a configuration-ready candidate
  from omitting the production-configuration or policy-approval handoff item.
- F1085 adds policy publication approval to the original external prerequisite packet and the
  candidate-bound prerequisite review, so all production evidence stages require the same policy
  approval before a ready state is possible.
- F1086 requires the candidate-bound approval to carry a safe approval reference, a past timestamp,
  and exactly three distinct public HTTPS policy URLs. It is still local validation; the real approval
  and published policy locations remain external release evidence.
- F1087 revalidates that approval at the production-environment boundary and requires the exact
  prerequisite-approved artifact reference, checksum, and byte count, preventing a later substitute.
- F1088 makes backup/restore evidence a ready candidate-bound recovery-drill review with verified
  transcript, rollback, and failed-restore records; plain text cannot advance the prerequisite gate.
- The API build, assistant policy integration, account-profile integration, portal smoke regression,
  and operations retention/deletion smoke test passed after the output-trace checkpoint on 2026-10-29.

The local readiness assessor remains intentionally not ready when no production environment file is
provided. Its missing values are production inputs, not safe defaults: target origin and database,
immutable image digests, identity/notification settings, backup and accessibility evidence, and
the required human decisions. Both approved GitHub remotes are configured, but this mixed
staged/unstaged/untracked workspace is not a safe candidate to publish until its pre-existing
changes are reconciled into an exact reviewed commit. Local verification is not hosted-CI,
staging, deployment, or publication evidence.

## Release scope

| Surface | In scope | Not in scope |
| --- | --- | --- |
| Web portal | Staging and production web deployment, API, worker, database, edge, support and monitoring | A live deployment from this local workspace |
| Android | Expo/EAS internal acceptance build, Play internal-track draft, then staged rollout | Apple/iOS setup and submission |
| Commerce | Referral-only unless a separately approved Premium decision enables billing | Product checkout, fulfillment, payouts, refunds and retailer billing |
| AI | Reviewed, disclosed, bounded guidance only | Unreviewed clinical claims, diagnosis, treatment, or unbounded provider access |

## Open implementation and setup register

| Area | Repository status | External completion required | Release gate |
| --- | --- | --- | --- |
| Web/API/worker build | Local build and verification pass | Build and deploy immutable images in staging | Critical |
| Hosting/domain/TLS | Contracts and edge checks exist | Approved host, domain, DNS, certificates, secret manager and edge evidence | Critical |
| Database/RLS | Migrations and local contracts exist | Authoritative project, TLS target, migration reconciliation, RLS and two-account isolation report | Critical |
| Backup/restore | Fail-closed status projection exists | Encrypted off-host backup and successful isolated restore rehearsal | Critical |
| Identity/email | Local boundaries exist | Auth provider, email delivery, deletion and recovery evidence | Critical |
| Catalog/claims | Seed and review contracts exist | Approved catalog, ingredient rules, sources, substantiation and freshness owner | Critical |
| Accessibility | Local keyboard and contract checks exist | Deployed WCAG 2.2 AA review at mobile and desktop widths, with blockers closed | High |
| Android build | EAS profiles and contract gate added | EAS project, Android signing, Play Console app, Data safety, content rating, screenshots, approved Privacy/Terms/AI Disclosure URLs and internal-track test | Critical |
| Support | Request and escalation routes exist | Named support owner, response target, helpdesk/queue, escalation and incident coverage | High |
| Billing | Disabled by default and gated | Explicit scope decision, Stripe sandbox evidence, terms approval and signed webhook rehearsal if enabled | High |
| AI providers | Local policy, bounded output traceability and fallback controls exist | Provider/model approval, spend limits, latency/error budget and billing reconciliation | High |
| Monitoring | Readiness and aggregate operations controls exist | Dashboard, alerts, incident runbook, alert owner and first-response test | Critical |
| Release authority | Evidence and rollback contracts exist | Named approver, launch window, rollback authority, staging sign-off and go/no-go record | Critical |

## Regulatory and policy applicability

The product must remain positioned as cosmetic education and referral discovery. Avoid diagnosis,
treatment, disease, guaranteed-result, or drug-like claims unless a qualified regulatory review
approves a different product classification and substantiation path.

- **FTC advertising and endorsements:** claims, reviews, affiliate/referral disclosures, pricing,
  subscriptions, cancellation language, and performance statements require substantiation and clear
  disclosure before publication.
- **Cosmetics / FDA boundary:** product labels and manufacturer directions remain authoritative;
  MGT must not imply that cosmetic guidance diagnoses, treats, cures, or prevents disease.
- **Privacy:** skin concerns and routine preferences are health-adjacent personal data. Final counsel
  must determine applicability of US state privacy laws including California, GDPR/UK GDPR or other
  regional rules based on the launch geography, data flows, rights, retention, processors and transfer
  mechanisms.
- **Children:** choose and document the target audience. Do not knowingly collect data from children
  without the required parental and platform controls; confirm COPPA and any local child-safety rules
  with counsel if under-13 users are possible.
- **Accessibility:** target WCAG 2.2 AA for the web and equivalent Android accessibility behavior,
  including TalkBack labels, focus order, touch targets, contrast, reduced motion and error recovery.
- **Google Play:** complete Data safety, content rating, target-audience, account-deletion and
  privacy-policy declarations from the final AAB and SDK inventory. The Android draft is in
  `apps/mobile/PLAY-DATA-SAFETY-DRAFT.md`.
- **Payments:** if Premium billing is enabled, obtain consumer terms, recurring-consent, cancellation,
  refund, tax, PCI scope and webhook reconciliation review before switching it on.

## Required evidence before web or Android ship

1. Approved legal identity, privacy notice, terms, AI disclosure, support contact and retention schedule.
2. Staging evidence for identity, RLS, deletion, export, backup restore, catalog approval, provider
   boundaries, monitoring, accessibility and the production proxy journey.
3. Web deployment proof with exact image digests, migrations, health/readiness and rollback target.
4. Android internal-track AAB test on supported devices, including sign-in, Skin Match, consent,
   API failure, TalkBack, offline/error recovery, deep links and account deletion instructions.
5. Final Play Console forms and store listing reviewed against the actual build.
6. Named owner and approver sign the ship packet; no local test result substitutes for that approval.

## Explicit blockers in this workspace

No production environment file, real database target, secret-manager record, deployed URL, Android
signing credential, Play Console application, legal approval, approved catalog, live restore proof,
or final store listing was available during this update. The repository is prepared to accept those
inputs, but it is not authorized to invent them or to claim that web or Android has shipped.

## Reference authorities

These primary sources are reference points for counsel and the accountable release owner; they do not replace jurisdiction-specific advice or platform review.

- FTC, [Health Products Compliance Guidance](https://www.ftc.gov/system/files/ftc_gov/pdf/Health-Guidance-508.pdf)
- FDA, [Cosmetics Labeling Claims](https://www.fda.gov/cosmetics/cosmetics-labeling/cosmetics-labeling-claims)
- Google Play, [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311) and [account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- Google Play, [Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469)
- W3C, [WCAG 2.2 Recommendation](https://www.w3.org/WAI/news/2023-10-05/wcag22rec/)
