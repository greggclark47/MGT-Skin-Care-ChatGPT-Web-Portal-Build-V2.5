# Production readiness delta — 2026-11-03

## Current position

The repository-side portal, API, Android configuration guards, operations
worker, release-evidence tooling, and commercial controls are locally verified.
This is not deployment authorization. The current environment intentionally has
no production configuration, so `node infra/portal/preflight.mjs` reports **60
blocking configuration inputs**. No placeholder values were supplied to make
that check pass.

Latest local verification: `work/verification/2026-11-03T22-37-43-977Z/report.md`
(19 gates and 1,650 reported assertions passed). Local fixtures do not prove a
deployed service, database isolation, backup restore, browser journey, Android
device behavior, or human approval.

## Repository controls complete

- Fail-closed production admission, secret isolation, immutable-image checks,
  policy URL admission, database/TLS checks, operations alert controls, retention
  configuration, and candidate-bound release evidence tooling.
- Referral-only retail boundary: MGT does not take product payments or fulfill
  merchant orders.
- Optional Free-plan sponsorship: non-personal selection, visible disclosure,
  current-authorization matching, authorization-bound merchant reporting,
  aggregate-only metrics, bounded retention, and safe operator eligibility
  status. See `COMMERCIAL-SPONSORSHIP-CONTROL-REVIEW-2026-11-03.md`.
- Android production build command guards final public URLs and blocks
  secret-shaped public configuration.

## Inputs still required outside source control

1. **Release and hosting:** approved owner declarations, canonical HTTPS origin,
   domain/DNS/TLS, edge secret reference, and immutable Node/API/Web/Ollama/Caddy
   image digests.
2. **Data and identity:** reviewed Supabase/Postgres target, server-only key
   references, Google identity decision, manual migration approval and live RLS,
   lifecycle, export, deletion, and reconciliation evidence.
3. **Public notices and support:** final HTTPS Privacy Notice, Terms, AI
   Disclosure, support owner/contact, accessibility report, monitoring dashboard,
   incident runbook, alert owner, and webhook credentials.
4. **Operations and recovery:** worker timing, health-file location, retention
   tuple, encrypted off-host backup/restore proof, rollback rehearsal, and alert
   delivery evidence.
5. **AI:** explicit Ollama/OpenClaw/hosted fallback posture; if enabled, approved
   endpoint/key references, model qualification, capacity, safety, consent, and
   spend evidence.
6. **Commercial scope:** explicit disabled/enabled declarations for subscriptions,
   Omni Retail, and sponsored content. Enabling subscriptions or sponsorship
   requires their separate commercial/legal approval and evidence records.
7. **Anti-aging features:** explicit feature and retention declarations; do not
   enable live AI, checkout, booking, or image analysis without their live
   validation and approvals.
8. **Android:** five final HTTPS values—API, portal, Privacy, Terms, and AI
   Disclosure—then Expo/EAS ownership, signing, internal device testing, Play
   Console, store assets, Data Safety declaration, and accountable approval.

## Exact external handoff values

### Android public configuration

The Android production validator currently stops only because these five
values are absent. Supply each through the Android build environment, never in
source control:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_PORTAL_URL`
- `EXPO_PUBLIC_PRIVACY_URL`
- `EXPO_PUBLIC_TERMS_URL`
- `EXPO_PUBLIC_AI_DISCLOSURE_URL`

Each value must be a final public `https://` URL with a dotted hostname. It may
not contain credentials, a port, query string, fragment, `localhost`, an IP
loopback address, `example.`, or a placeholder such as `your-` or `change-me`.
No `EXPO_PUBLIC_` variable may be named as, or carry, a secret, token,
password, service-role key, or private key. The URLs should be released only
after the portal and notices can be checked in staging.

### Candidate-bound staging handoff

When a clean release candidate is selected, the existing ship-packet workflow
requires one consistent 40-character candidate commit across the packet,
staging target, attestation, and evidence ledger. The external operator must
then record:

- the separate staging `https://` origin and deployment, isolation, and
  secret-injection references;
- immutable `node`, `ollama`, and `caddy` image digests;
- recorded `/healthz` and `/readyz` results for that exact candidate;
- attributable staging, secret-injection, artifact-health, evidence-ledger,
  and rollback evidence with checksums; and
- release, support, data, platform, and accessibility owners plus their
  time-bounded approval references.

Use `infra/portal/ship-packet.example.json` as the controlled template. Do not
replace its placeholders with guessed values, secrets, or unobserved results.

## Safe next sequence

1. Select the production accounts, region, legal scope, launch geography, and
   data/retention decisions; put secret values only in the approved manager.
2. Populate a private environment file and run `pnpm infra:preflight`; correct
   every reported input without copying secrets into the repository or demo.
3. Provision staging, apply reviewed migrations manually, and collect live
   identity, RLS, customer-lifecycle, accessibility, monitoring, backup/restore,
   and rollback evidence.
4. Create a clean candidate commit and run the existing candidate-bound release
   evidence workflow. Build Android only after public portal and policy URLs are
   live in staging.
5. Obtain recorded approvals and execute the controlled release workflow. This
   document does not authorize traffic, publication, merchant outreach, or spend.
