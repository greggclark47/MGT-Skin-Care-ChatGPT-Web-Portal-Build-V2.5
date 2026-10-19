# Production release plan: web portal and Android app

## Release state

The release has two deliverables: the production web portal (web, API, worker, database and TLS edge) and the Android application (Expo production Android App Bundle distributed through Google Play). Apple release setup is outside this plan.

The candidate is not ready for production publication until the shared production gate, the web staging checks, and the Android acceptance and store checks below have candidate-bound evidence. The current Android submit profile targets the internal track with draft status; it is not a public production rollout.

## Shared candidate and infrastructure work

1. Freeze one Git commit and use it for portal source, mobile source, API image, web image, release evidence and rollback references.
2. Select and document the production host, domain, HTTPS/TLS and edge routing. Populate the production environment through the approved secret manager; do not commit `.env` or secret values.
3. Select the production Supabase/PostgreSQL project. Review migration lineage, apply migrations through the approved operator process, and capture target-specific RLS, account lifecycle and concurrency evidence.
4. Build and publish immutable API and web images from the candidate. Record their digests and provenance. Pin approved Node, Caddy and any enabled AI runtime images by digest.
5. Deploy the exact candidate to isolated staging. Verify health/readiness, edge routing, authentication, support, backup/restore, retention, monitoring and rollback before considering production.
6. Keep automatic migrations disabled. Keep subscriptions disabled unless offer, legal, Stripe sandbox, webhook and launch approvals are complete. Keep image analysis and production customer-image storage disabled until their independent privacy/storage review is complete.
7. Obtain the named release, platform, data, support and accessibility decisions. Complete the production gate and record a launch window, rollback target, incident route and post-launch checks.

## Web portal release path

The web release uses the production API/web container workflow and the digest-pinned `infra/portal/compose.production.yaml` package. Required evidence includes the production origin and TLS, exact image manifest, preflight, database/RLS and migration reports, backup restore drill, worker and health/readiness checks, deployed accessibility report, support test, monitoring/alert route, rollback rehearsal and hosted CI result for the exact commit.

Build the candidate images with the manual GitHub Actions “Publish release images” workflow only after the candidate verification gate and approved immutable Node image are available. Test those same digests in staging. Do not build or deploy from a developer workstation to a production host.

## Android app release path

The checked-in Expo configuration defines package `com.mgt.skincare`, version `0.2.0`, Android `versionCode` 1, no optional Android permissions, and cleartext traffic disabled. The EAS production profile builds a Play-compatible AAB with remote version-code increment. The submit profile targets the internal track and creates a draft.

Before building the AAB:

1. Associate the Expo project and confirm the Android package identity in EAS and Google Play Console.
2. Configure production `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_PORTAL_URL`, `EXPO_PUBLIC_PRIVACY_URL`, and `EXPO_PUBLIC_TERMS_URL` as HTTPS values in the intended EAS environment. Confirm that no server secret enters an `EXPO_PUBLIC_*` variable.
3. Configure and verify Android signing credentials and the Play upload path under the accountable release owner. Keep recovery access in the approved account controls.
4. Run the mobile contract gate, create an internal preview APK, and test the signed-in/unauthenticated flows on supported Android devices against staging. Verify API routing, Skin Match, accessibility/tap targets, account handoffs, legal links, network failures and session behavior.
5. Build a production AAB from the same candidate and record its checksum, version code, dependency/SDK inventory and build provenance.
6. Reconcile the draft in `apps/mobile/PLAY-DATA-SAFETY-DRAFT.md` against the final AAB, transitive SDKs, API/database behavior, retention/deletion/export, analytics and published privacy notice. Have the accountable privacy/legal owner approve the final Play declarations and store listing.
7. Complete store listing, content rating, target audience, screenshots, support contact and account deletion requirements in Play Console. Submit first as a draft/internal release; review the generated store checks and obtain explicit release approval before any production rollout.

The mobile app currently links account setup, payment and image management to the web portal. Native image picking, production photo storage/sync, and image analysis are not represented as shipped Android capabilities. Do not describe them as available in the production app until separately implemented and reviewed.

## Candidate packet contents

For each candidate, retain the source archive and checksum, prerequisite packet, production submission list, operator intake and redacted intake review. Add the current web release-readiness report, hosted CI URL, image manifest, staging dossier, database/RLS report, restore transcript, accessibility report, support evidence, rollback/monitoring evidence, Android contract/device report, AAB checksum and Play review evidence. Keep reports and secret references out of the public source archive when they contain account-specific information.

The packet is evidence and operator guidance. It does not itself deploy, migrate, publish an AAB, or authorize a production rollout.
