# Release gate status

Generated: 2026-11-16T00:03:07Z

A platform ships only when every P0 gate that applies to it is accepted with evidence. 'reported' means a document says the work was done and the owner has not yet accepted it.

| Platform | Decision | Accepted | Reported | Open P0 | Open P1 | Open P2 |
|---|---|---|---|---|---|---|
| web | **HOLD** | 0/19 | 5 | 10 | 5 | 4 |
| android | **HOLD** | 0/17 | 6 | 11 | 5 | 1 |
| ios | **HOLD** | 0/17 | 5 | 11 | 5 | 1 |
| ops | **HOLD** | 0/1 | 0 | 1 | 0 | 0 |

## web: HOLD

- G01 (reported): Candidate packet and production gate for the exact commit and image digests. Evidence: Signed gate JSON, image digests, approver, rollback owner. Owner: Release authority.
- G02 (reported): Runtime admission clean with Secret Manager-backed configuration. Evidence: Clean preflight and release-readiness output from the target runtime. Owner: Platform.
- G03 (open): Stripe live activation: business verification, products and prices, meter, tax, refund, dispute and support settings, webhook secret. Evidence: Stripe dashboard evidence and a redacted runtime configuration check. Owner: Commerce.
- G04 (reported): Stripe test-mode matrix, then a controlled live smoke, with reconciliation. Evidence: Candidate-bound run log and reconciliation result. Owner: Commerce and QA.
- G05 (reported): Deployed route contract and health endpoints verified. Evidence: Approved route contract and probes through the deployed origin. Owner: API and platform.
- G06 (open): Authenticated Supabase journeys: OAuth, recovery, deletion, replay rejection, two-account isolation, entitlement reconciliation. Evidence: Two-account evidence packet, SQL and RLS logs, browser and API traces. Owner: Data and identity.
- G07 (open): Encrypted off-host backup and isolated restore drill with measured RPO and RTO. Evidence: Restore report, RPO and RTO, owner sign-off (t47 backup drill gives the record). Owner: Data and operations.
- G08 (open): Approved product catalog and ingredient and claim rules. Evidence: Content owner sign-off with a source register. Owner: Content.
- G09 (open): Named approvers and a signed release authorization. Evidence: Signed release record with go/no-go and rollback authority. Owner: Owner.
- G25 (open): Optional face scan is off by feature flag, or counsel sign-off is on file. Evidence: Flag state in the deployed configuration, or the signed counsel review (handoff section 7). Owner: Owner and counsel.

## android: HOLD

- G01 (reported): Candidate packet and production gate for the exact commit and image digests. Evidence: Signed gate JSON, image digests, approver, rollback owner. Owner: Release authority.
- G02 (reported): Runtime admission clean with Secret Manager-backed configuration. Evidence: Clean preflight and release-readiness output from the target runtime. Owner: Platform.
- G05 (reported): Deployed route contract and health endpoints verified. Evidence: Approved route contract and probes through the deployed origin. Owner: API and platform.
- G06 (open): Authenticated Supabase journeys: OAuth, recovery, deletion, replay rejection, two-account isolation, entitlement reconciliation. Evidence: Two-account evidence packet, SQL and RLS logs, browser and API traces. Owner: Data and identity.
- G07 (open): Encrypted off-host backup and isolated restore drill with measured RPO and RTO. Evidence: Restore report, RPO and RTO, owner sign-off (t47 backup drill gives the record). Owner: Data and operations.
- G08 (open): Approved product catalog and ingredient and claim rules. Evidence: Content owner sign-off with a source register. Owner: Content.
- G09 (open): Named approvers and a signed release authorization. Evidence: Signed release record with go/no-go and rollback authority. Owner: Owner.
- G14 (reported): Android: Expo project linked, signed AAB, physical-device acceptance. Evidence: Signed build record and device test notes. Owner: Mobile.
- G15 (reported): Google Play: listing, Data safety, content rating, screenshots, policy URLs, internal track. Evidence: Internal-track acceptance. Owner: Mobile.
- G18 (open): Mobile billing route decided: no purchase in app, store billing, or a permitted link-out. Evidence: Owner decision recorded against T&C Appendix C-4. Owner: Owner and counsel.
- G25 (open): Optional face scan is off by feature flag, or counsel sign-off is on file. Evidence: Flag state in the deployed configuration, or the signed counsel review (handoff section 7). Owner: Owner and counsel.

## ios: HOLD

- G01 (reported): Candidate packet and production gate for the exact commit and image digests. Evidence: Signed gate JSON, image digests, approver, rollback owner. Owner: Release authority.
- G02 (reported): Runtime admission clean with Secret Manager-backed configuration. Evidence: Clean preflight and release-readiness output from the target runtime. Owner: Platform.
- G05 (reported): Deployed route contract and health endpoints verified. Evidence: Approved route contract and probes through the deployed origin. Owner: API and platform.
- G06 (open): Authenticated Supabase journeys: OAuth, recovery, deletion, replay rejection, two-account isolation, entitlement reconciliation. Evidence: Two-account evidence packet, SQL and RLS logs, browser and API traces. Owner: Data and identity.
- G07 (open): Encrypted off-host backup and isolated restore drill with measured RPO and RTO. Evidence: Restore report, RPO and RTO, owner sign-off (t47 backup drill gives the record). Owner: Data and operations.
- G08 (open): Approved product catalog and ingredient and claim rules. Evidence: Content owner sign-off with a source register. Owner: Content.
- G09 (open): Named approvers and a signed release authorization. Evidence: Signed release record with go/no-go and rollback authority. Owner: Owner.
- G16 (open): iOS: Apple Developer Program, EAS iOS build, TestFlight device acceptance. Evidence: TestFlight build record and device test notes. Owner: Mobile.
- G17 (reported): App Store: listing, App Privacy answers, age rating, screenshots, review notes, account deletion path. Evidence: App Store Connect submission record. Owner: Mobile.
- G18 (open): Mobile billing route decided: no purchase in app, store billing, or a permitted link-out. Evidence: Owner decision recorded against T&C Appendix C-4. Owner: Owner and counsel.
- G25 (open): Optional face scan is off by feature flag, or counsel sign-off is on file. Evidence: Flag state in the deployed configuration, or the signed counsel review (handoff section 7). Owner: Owner and counsel.

## ops: HOLD

- G23 (open): Local agent plane qualified: bake-off, OpenClaw audit, injection cases, review queue, encrypted backup. Evidence: Bake-off report, audit report and a verified agent-plane backup. Owner: AI owner.
