# Dev-to-production test readiness — v4.357

## Result

The repository-side dev-to-production test pass is green. The full release verifier, all infrastructure/database contracts, the sequential application matrix, web typecheck, and Android contract pass on local fixtures. This is not evidence that an external staging or production environment has been deployed or approved.

## Verified locally

- Full release verifier: 1,302 assertions passed.
- Infrastructure and database contract suite: 1,107 tests passed.
- Sequential application runner: 32 test files passed, including all API suites and the Android contract.
- Web TypeScript typecheck passed.
- Web production build and production proxy journey passed.
- Credential scan passed with no high-confidence credential material found.
- Generated public artifact vendor scan found zero affected files.
- The application runner now executes server-backed API tests one at a time to prevent local port and child-process contention.

## Account-profile continuity

- Account profile values reach the bounded `customer_context` contract used by account overview, assistant guidance, Skin Coach, and support output.
- The context is returned to the signed-in client for articulation and is not sent to an AI provider.
- Profile merge locking and account deletion/export boundaries remain covered by focused API tests.
- Test Drive image storage remains consent-scoped and non-production.

## Still required before production approval

1. Execute the exact candidate in an isolated staging environment with the authoritative PostgreSQL/Supabase target, RLS/policy audit, migration reconciliation, two-account isolation, deletion/export, backup restore, and rollback evidence.
2. Verify Supabase identity and Google OAuth callback, expiry, replay, account-link, and approved merge behavior using staging configuration.
3. Complete Android EAS internal-track acceptance on supported devices, including sign-in, Skin Match, accessibility, privacy disclosures, and API failure/retry behavior.
4. Provide approved production object storage for images with encryption, retention, deletion, consent, and image-processing boundary evidence; test Drive remains non-production.
5. Complete catalog/provider synchronization rehearsal, freshness/provenance checks, conflict handling, and retailer-link review.
6. Close the explicit exhaustive-coverage inventory: 708 exported units and 173 endpoint declarations still need valid, boundary, and malformed input matrices beyond the aggregate suites.
7. Obtain named operations, privacy/legal, support, accessibility, rollback, and go/no-go approvals.

## Release interpretation

Local code and contract gates are ready for staging execution. The product remains blocked from production traffic until the external evidence and human approvals above are recorded; no local test result authorizes deployment.
