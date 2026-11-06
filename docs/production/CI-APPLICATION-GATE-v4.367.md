# CI application gate — v4.367

This checkpoint records ten safe dev-to-production increments after v4.357: the application test matrix is now reproducible, sequential, and required before both continuous verification and manual immutable image publication.

## Ten increments

1. Added deterministic discovery of every API test file and the Android contract.
2. Added one-process-at-a-time execution for server-backed tests.
3. Added failure aggregation so later suites still run and all failures are reported.
4. Added the `test:application` package command.
5. Added the application gate to pull-request and protected-branch verification.
6. Added the same gate before registry authentication and image publication.
7. Extended the CI contract to verify the continuous workflow command.
8. Extended the immutable-image contract to verify its candidate gate command.
9. Re-ran the complete local application matrix: 32 test files passed.
10. Re-ran the release verifier, infrastructure/database contracts, client checks, and demo contract before publication.

## Evidence

- Full release verifier: 1,302 assertions passed.
- Infrastructure/database contract suite: 1,107 tests passed.
- Application matrix: 32 sequential test files passed.
- CI, Compose, and image workflow contracts: 20 tests passed.
- Web typecheck, production build, proxy journey, demo contract, and Android contract passed.

## Boundary

This gate proves repository behavior and workflow ordering only. It does not create staging credentials, validate a live Supabase/PostgreSQL target, perform a real Android device acceptance run, approve production image storage, or authorize production traffic. Those external gates remain required.
