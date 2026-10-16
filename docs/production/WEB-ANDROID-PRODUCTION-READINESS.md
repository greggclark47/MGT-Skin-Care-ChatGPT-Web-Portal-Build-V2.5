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
| Android build | EAS profiles and contract gate added | EAS project, Android signing, Play Console app, Data safety, content rating, screenshots, privacy URL and internal-track test | Critical |
| Support | Request and escalation routes exist | Named support owner, response target, helpdesk/queue, escalation and incident coverage | High |
| Billing | Disabled by default and gated | Explicit scope decision, Stripe sandbox evidence, terms approval and signed webhook rehearsal if enabled | High |
| AI providers | Local policy and fallback controls exist | Provider/model approval, spend limits, latency/error budget and billing reconciliation | High |
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
