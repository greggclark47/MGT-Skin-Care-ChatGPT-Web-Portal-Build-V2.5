# MGT INC: resilient hosting and fail-closed governance blueprint

Status: **proposed design, not deployment authorization**. Accountable owner, approver, reviewer, monitoring owner and release decider: **Gregg Clark of MGT**. Release, Platform, Data, Support and Accessibility remain separate evidence domains.

## Source review and scope

All seven pages of the local MGT Skin Care Ownership and Approval Procedure v2.31 were read; pages 4-6 were additionally rendered and visually inspected. PDF SHA-256: `9b4c461e98e6a9bb104bd4ab8a7d7d43db58b8bc74324f941065e06202281883`. The printed issue date is 2026-10-09; this does not establish board adoption or a legal effective date.

Repository baseline: `36026ac53c7f647179e3e06baaf89c23a23866b3`, demo v2.32. The architecture below is not represented as deployed.

| PDF requirement | Source | Planned enforcement |
| --- | --- | --- |
| One accountable owner; distinct domains; no implicit permission | p.1 | Literal owner policy, authenticated identity binding, separate action authority |
| Ownership before work; pending templates; verified channels | p.2 | Bootstrap and runtime checks, verified contact records |
| Candidate integrity, immutable images, bounded operations, hygiene | p.3 | Signed candidate envelope, CI scans, preflight, secret-safe collectors |
| Five role artifacts; automated staging before promotion review | p.4 | Unique role evidence, independent automated verification |
| Two staging approvals, future window <=4h, pending operator execution; eight production checks | p.5 | Separate issuance/execution predicates, atomic state transitions |
| Execution receipts, fresh probes, 15m/1h/24h/7d, matching destination receipts | p.6 | Cloud controller, durable scheduler, append-only export generations |
| Complete final checklist | p.7 | Thirty implementation work packages with acceptance conditions |

### Reconciliations that must not be hidden

1. Four hours is the **maximum window**, not mandatory duration or the maximum age of every artifact. The PDF explicitly applies it to staging; applying it to production is an additional requirement from this inquiry. Each environment has its own authorization, with identical window values across its required role approvals.
2. One person signing five records is **not independent human segregation of duties**. Separate collectors, validators and role records improve accountability but do not satisfy a mandated two-person control. If law, contract, insurer or audit requires two independent humans, the all-Gregg mandate creates a blocking governance conflict. Do not invent a second reviewer or make a machine impersonate a human.
3. Every failed required verification enters HOLD and the rollback/containment path. Before any mutation, rollback is recorded as `not_required_no_mutation`; do not roll back a healthy unrelated release. After mutation, contain or restore the affected environment using the approved compatible baseline.
4. Seamless failover is a target, not a zero-interruption guarantee. In-flight requests can fail. Loss of the shared data or identity service may require read-only or maintenance mode.
5. Hashes detect changes relative to trusted digests; they do not authenticate an approver. Authenticate Gregg and sign evidence roots using managed signing infrastructure.
6. Initial operational closeout triggers archives; **final governance closeout requires verified receipts and all due monitoring**. Future 24h and 7d checks cannot be prefilled as passing.

## System topology

```text
Customers -> authoritative DNS -> cloud edge/WAF/TLS/load balancer
                                      |                 |
                              preferred local      hot cloud pool
                              web/API pool         web/API, >=2 zones
                                      \                 /
                              private authenticated access
                                              |
                     managed HA database + durable outbox/work queue
                     external identity + object storage + secret manager
                                              |
                     independent encrypted backup/PITR + restore target

GitHub Actions -> isolated automated staging -> evidence collector/verifier
                                                        |
Gregg's authenticated review -> governance service + append-only ledger
                                                        |
                                    one-use execution authorization
                                                        |
                                      cloud deployment controller
                                          |            |
                                      production    rollback controller

Ledger -> immutable evidence vault -> export worker -> GitHub A, GitHub B, Drive
External probes and durable scheduler -> incident channel + ledger
```

### Failure-domain and capacity design

- Keep DNS, public URL, certificates, edge, database, identity, governance, monitoring and export scheduler outside the local workstation's power/network domain. Bind `PUBLIC_ORIGIN` to the actual approved domain inventory; no public domain is invented here.
- If local hosting must stay preferred, make it stateless and maintain an already-running cloud standby at the **same approved source/image/config/schema tuple**. The longer-term recommendation is cloud-primary with local systems used for development or optional capacity; changing that preference requires approval.
- The INC controls the corporate registrar, cloud accounts, repositories, billing and shared Drive. Gregg is the accountable person. Preserve provider resource-owner IDs and actual workload actor IDs truthfully; they need not literally be his display name.
- Reserve cloud capacity for the full load across at least two independent zones. Pre-pull the pinned images and demonstrate capacity during a rehearsal. Idle health checks do not prove peak capacity.
- Use authenticated private origin paths and origin firewall restrictions. Verify TLS at edge-to-origin and service boundaries. Staging has a separate origin, project/account boundary, data set and secret namespace.
- Sessions must survive pool changes: shared session state or verified stateless tokens with server-side revocation. Never rely on workstation disk or process memory as the only session store. Do not cache personalized responses at the edge.
- Durable files go to object storage. Worker outbox state lives in the shared database. Atomic lease claims, fencing epochs and recipient idempotency prevent duplicate reminders, alerts and payment operations.
- Do not silently replace local AI with an unapproved cloud provider. Preapprove equivalent model/data-handling/capacity or explicitly degrade optional AI while preserving core service.
- Do not run dual writable local/cloud databases. Use one logical managed writer with provider-supported zone protection. Regional promotion requires writer fencing and replication-lag evidence; uncertain writer ownership means freeze writes.

### Temporary local outage

Proposed targets, requiring Gregg's acceptance and measured rehearsal: app-only RTO <=120 seconds; RPO 0 for transactions acknowledged by the surviving managed database. This is conditional on that database's durability and does not promise RPO 0 for a regional disaster. Proposed regional targets: RTO <=60 minutes and RPO <=5 minutes, subject to the selected service and tests.

Proposed external probe settings: 15-second interval, 3-second deadline, three consecutive failures, multiple vantage points. Check health/readiness, TLS, dependencies and the approved release identity. Verify release identity through protected control-plane observation, not arbitrary public response text. Tune to provider limits and false-positive risk. [Cloudflare monitors](https://developers.cloudflare.com/load-balancing/monitors/) illustrate a mechanism, not a selected vendor.

On local failure, remove the local pool and route to the healthy, **already-approved** cloud pool. No new build, migration or approval bypass occurs. A standing failover authorization must bind both pools, exact tuple, permitted actions and incident route before an outage. A different or unverified standby cannot receive traffic. Record failover observations. Require ten minutes of stable recovery plus Gregg's explicit failback decision before restoring local preference.

## 1. Ownership establishment

### Corporate and authenticated identity

1. Record the INC's actual legal name, jurisdiction, entity reference, approved domain and corporate authority naming Gregg. Do not treat the product name as established legal identity.
2. Verify corporate control of registrar/cloud/repositories/Drive and operational contacts. Preserve verification references, not credentials. Missing jurisdiction, domain or contact information blocks the corresponding setup.
3. Bind Gregg using a verified identity issuer and immutable subject, plus verified GitHub numeric user ID. Require phishing-resistant MFA. The display name, email text or an environment variable is not authentication.
4. Compile a protected canonical-owner constant into templates, preflight, approval validators, serializers, deployment admission, monitoring and export services. Database types must reject any other value. Client controls display it but cannot set authority.
5. Use separate workload identities for builders, collectors, validators, deployment, rollback and export. Their actual actors remain machines; their accountable owner remains Gregg. They cannot create human approvals.

### Exact owner check before privilege or work

```text
CANONICAL_OWNER = "Gregg Clark of MGT"
require RELEASE_OWNER_NAME == CANONICAL_OWNER
require SUPPORT_OWNER_NAME == CANONICAL_OWNER
require every owner/approver/reviewer/monitor/decider == CANONICAL_OWNER
require roles == {release, platform, data, support, accessibility}
require verified support and incident contact references
require all new approval decisions == pending
require new production decision in {pending, hold}
```

Reject missing, non-string, differently spelled, case-altered or extra-whitespace owner values. Do not silently normalize a conflicting declaration. Human contact channels are independently verified and are not invented from the owner name.

The first trusted CI bootstrap runs before candidate checkout/execution. Each later privileged job repeats it; runtime startup and admission enforce it too. A configuration reload violating ownership is rejected while the last valid configuration remains active. Losing governance availability denies new changes, not automatically all healthy public reads.

The bootstrap must come from a separately protected, digest-pinned policy/runner package, not candidate-controlled code. A candidate cannot edit its own validator to approve itself. Changes to the policy require their own approved governance change.

### Five separate review actions

Provide a separate authenticated review action for each role, with its own scope, artifact and signed record. No approve-all endpoint. Production's final release GO is an additional decision record, not reuse of the Release role signature.

GitHub required-reviewer approval is an extra interlock, not a replacement for the five-role ledger. One required reviewer may unblock an environment. Prevent-self-review blocks Gregg from approving a deployment he initiated, creating a conflict if no other human is permitted. Do not automatically disable an existing two-person protection: hold and resolve the policy conflict. Verify plan capabilities and disable administrative bypass for the selected design. [GitHub environment rules](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)

## 2. Configuration and integrity validation

### Candidate envelope

Freeze a signed manifest containing entity ID, policy/schema hash, repository ID, full source SHA, source tree/archive SHA-256 and bytes, branch as metadata, trusted workflow revision, run ID/attempt, toolchain/scanner versions, SBOM/provenance, exact image digests, environment/origin, non-secret configuration hash, migration-set hash and rollback tuple.

Node, API, web, edge and enabled local-AI images use exact digest references. An approved disabled-AI exclusion is explicit. Pin the correct platform image or multi-architecture index and verify selected platform. Do not resolve a branch tip, mutable tag or `latest` during deployment. Build once and promote those exact bytes. Rebuilding at the same source SHA still changes the candidate envelope and invalidates prior approval.

Verify registry attestations against the permitted source/workflow identity, not just presence of a signature. Pin third-party Actions/reusable workflows to reviewed full SHAs. Runner and scanner images are also policy-controlled. [GitHub workflow security](https://docs.github.com/en/actions/reference/security/secure-use)

Canonical hashing covers the complete nested structure. Reject duplicate JSON keys before parsing and non-finite values. Record the canonicalization version. v2.32 fixed shallow prerequisite hashing: regenerate older prerequisites and dependent reviews; do not simply replace their stored digest.

### Automated staging gate before human promotion review

1. Validate owner, trusted policy and exact candidate identity.
2. Run frozen dependency installation, builds, unit/integration/contract tests and tracked-source hygiene.
3. Scan dependencies, SBOM, images and IaC. Proposed policy blocks known critical/high findings, missing or stale scanner data and unsupported runtimes. Risk acceptance requires an explicit policy change; no failed result becomes pass.
4. Verify secret-injection boundaries using workload identity and abstract references: approved environment only; cross-environment access denied; consumption succeeds without revealing values.
5. Provision isolated staging only under a **previously approved standing staging-automation authorization**. This permits automatic staging before human promotion review without violating the PDF's requirement for authority before external action. Without standing authorization, provisioning is blocked.
6. Deploy exact digests, execute the approved manual migration procedure and probe `/healthz`, `/readyz`, worker freshness, TLS/edge and synthetic customer flow.
7. Independently verify observations, assemble the role artifacts, then freeze/sign the handoff. No human promotion record becomes reviewable until all required automated results pass.

Untrusted PR workflows have no environment, registry-write, ledger-signing or Drive authority. Trusted post-merge orchestration resolves a full candidate SHA; it does not execute arbitrary PR artifacts with production privilege. Use job-scoped least privilege and OIDC federation bound to verified issuer, audience, repository identity, workflow and environment. Do not assume one universal OIDC subject format. [GitHub OIDC](https://docs.github.com/en/actions/concepts/security/openid-connect)

### Operational configuration contract

| Control | Planned enforcement | Required evidence |
| --- | --- | --- |
| Database transport | CA and hostname validation equivalent to verify-full; no TLS downgrade | Wrong hostname, invalid CA and expired certificate fail |
| Database privileges | Runtime is not superuser, table owner or BYPASSRLS; migrator separated | Two-account isolation and unauthorized-write tests |
| Migration policy | PORTAL_AUTO_MIGRATE=false; expand/contract; compatible rollback | Applied migration hash and rehearsal |
| Secret boundary | Only abstract references in declarations; short-lived runtime retrieval | Reference/version, allowed/denied result, no raw value |
| Delivery endpoints | HTTPS allowlist, verified recipient, explicit non-secret key ID, redirect/address restrictions | Invalid endpoint/signature/key-ID tests |
| Timeout | Proposed explicit 10,000ms, permitted integers 1,000-30,000ms | Invalid or missing policy fails, not fallback parsing |
| Retry | Proposed 300s base, 3,600s cap, 5 attempts, jitter and bounded Retry-After | Terminal/nonretryable and exhausted-budget tests |
| Lease | Proposed 60s operations lease > timeout plus safety margin | Atomic claim, stable delivery ID and fenced late completion |
| Worker readiness | Proposed 60s period, 300s last-success age | DB-backed success, not process existence only |
| Backups | Proposed <=24h backup age, <=30d restore proof, approved PITR | Off-host checksum and actual isolated restore |

These are proposed production settings, not observed live values. Current notification validation and fenced delivery are useful foundations; operations-alert timeout/retry/attempt/lease/key-ID parsing still needs complete strict preflight parity. Validate the whole tuple and reject invalid values instead of silently substituting defaults.

PostgreSQL verify-full checks CA trust and hostname. RLS does not constrain superusers as an ordinary user, and table ownership needs deliberate treatment. [TLS](https://www.postgresql.org/docs/current/libpq-ssl.html), [row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

### Secret leakage: fail closed without preserving the secret

Collectors serialize bounded allowlisted fields and error codes, not arbitrary exception/provider objects, customer data, connection strings, request bodies or environment dumps. Disable shell tracing and core dumps; restrict egress. Scan before normal logging/artifact upload. Masking is defense in depth, not a secrecy guarantee.

On detection: set HOLD, revoke candidate authorization, isolate the source and trigger the affected-mutation rollback/containment path. Rotate/revoke exposed credentials through the approved secret manager. Revoke access to tainted logs/artifacts and perform authorized removal where required. Keep sanitized incident/tombstone metadata and correction references; do not preserve the secret in the compliance ledger. Any legally required forensic copy belongs in a separately restricted system. Rollback cannot undo a disclosure.

## 3. Role-specific evidence ledger

### Five uncollapsable artifacts

| Role | Separate evidence scope | Owner and reviewer |
| --- | --- | --- |
| Release | Candidate continuity, safe customer smoke, rollback tuple, launch plan | Gregg Clark of MGT |
| Platform | Account/origin, isolation, secret boundary, TLS, health/readiness, standby capacity | Gregg Clark of MGT |
| Data | Applied migrations, structural audit, RLS, retention, backup and restore | Gregg Clark of MGT |
| Support | Verified route, test ticket, coverage, response target, incident/runbook drill | Gregg Clark of MGT |
| Accessibility | Deployed keyboard, assistive technology, zoom/responsive, contrast and WCAG evaluation | Gregg Clark of MGT |

Each role record has: immutable ID, exactly one role, candidate-envelope hash, environment/origin, observation time, real collector identity, canonical owner/reviewer, action code, expected/actual non-secret result, status, stable evidence object/version, SHA-256, bytes, applicable rollback reference, schema version and supersession reference.

Exactly five distinct role IDs, artifact references and role-bound hashes are required. Supporting attachments may be shared; role artifacts cannot be collapsed. Status begins pending; pass is recorded only after observation and review. Corrections are new records, not destructive overwrites. Supersession changes the evidence root and invalidates approvals tied to the previous root.

### Storage and authority

Use a separate compliance schema and service from customer-data APIs. Store metadata and redacted evidence references; put artifacts in versioned, retention-locked object storage. Drive is an additional backup/distribution destination, not the sole immutable source of truth.

Collectors cannot approve; approvers cannot rewrite observations; executors cannot authorize themselves; exporters cannot change artifacts. Preserve actual workload identities while attributing accountability to Gregg. Append-only events, signed roots and independent retention anchors help detect ledger tampering. A checksum chain by itself is insufficient if one administrator can rewrite everything.

The reference SQL provides structural constraints and no public privileges. It is **not a production migration**. Cross-row completeness, signer authentication, trusted time, currentness, revocation, secret scanning and immutable-object verification belong in tested server-side transition functions. Do not grant direct application insert/update/delete rights.

### Applicability and retention

INC status alone does not establish legal duties. Obtain a jurisdiction/data/contract-specific register for corporate authority, privacy/consumer notices, consent, retention, breach reporting, accessibility, payment scope, product/health claims, vendor terms and data residency. Do not assert HIPAA, GDPR, PCI DSS, SOC 2 or any certification simply from the product category.

Map the design to NIST access/identity, audit, configuration/change, contingency/recovery, integrity and incident families as an engineering crosswalk, not a certification. Flag single-person control in any separation-of-duties assessment. [NIST SP 800-53](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)

Proposed engineering accessibility target: WCAG 2.2 AA unless an applicable obligation dictates another baseline. Automated scanners do not establish conformance; manual deployed-journey evidence is required. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

Retention is an approved required input, not an invented fixed number of years. Specify record classes, periods, legal-hold precedence, residency, access reviews, deletion authority and recovery tests. Expiry invokes a controlled purge/tombstone workflow, not ad hoc application deletion.

## 4. Staging and production promotion

### State machine

```text
REGISTERED -> OWNER_VALID -> CANDIDATE_VERIFIED -> STAGING_AUTOMATION_PASS
 -> STAGING_HANDOFF_FROZEN -> TWO_STAGING_ROLE_APPROVALS
 -> PENDING_OPERATOR_EXECUTION -> STAGING_EXECUTED -> FRESH_POST_ACTION_PASS
 -> PRODUCTION_EVIDENCE_FROZEN -> FIVE_ROLE_APPROVALS -> GO_RECORDED
 -> PENDING_OPERATOR_EXECUTION -> PRODUCTION_EXECUTED -> IMMEDIATE_PASS
 -> OPERATIONAL_CLOSEOUT -> ARCHIVE_RECEIPTS_VERIFIED -> MONITORING_OPEN
 -> FINAL_CLOSEOUT (all required observations, including 7d, and final receipts)

Required failure -> HOLD + AUTHORIZATION_REVOKED + ROLLBACK/CONTAINMENT
Changed candidate/images/config/evidence/scope/window -> new handoff and approvals
```

A trusted governance service evaluates transitions. Editing a file or a browser GO toggle cannot grant authority. Handoff, human decision, authorization and independent operator receipt are separate records.

### Issuance and execution time predicates

At issuance, use server UTC:

```text
timestamps parse as timezone-qualified UTC instants
evidence_observed_at <= handoff_frozen_at <= approval_time <= server_now
window_start >= server_now
0 < window_end - window_start <= 4 hours
each required role binds the same handoff hash and window ID
approval age <= 60 minutes at authorization issuance
all required checks passed, current, authentic and unrevoked
```

The 60-minute issuance freshness matches the existing staging default; the PDF itself does not prescribe that number.

At execution use a different predicate:

```text
window_start <= server_now < window_end
server_now < authorization.expires_at
all role approvals and final decision remain authentic and unrevoked
candidate/config/schema/images/origin/rollback tuple is unchanged
fresh pre-action checks and clock-health checks pass
execution completes within the window or invokes containment/rollback
```

Proposed stricter policy also limits approval age to 60 minutes at execution start. Expiry is the earliest of window end and the required approvals' age ceilings. Thus a four-hour window does not permit a four-hour-old approval. Obtain Gregg's acceptance and display the effective expiry before signing. Never backdate an approval.

Proposed infrastructure prerequisite: measured clock drift <=30 seconds. Use authoritative server receipt time for authorization; retain source observation time separately. Clock tolerance is not an extension of the signed window.

Use the common half-open boundary [start,end). The existing staging receipt validator accepts the end instant inclusively; align and test it before rollout. This boundary choice is an explicit design refinement.

### Eight production checks

Require exactly one fresh passing record for each, bound to the production handoff:

1. target_identity: entity/account/region/domain/origin/environment.
2. candidate_continuity: source, images, provenance, config/schema and staging handoff.
3. production_preflight: owner, secrets boundary, network/TLS and bounded settings.
4. production_readiness: dark-slot health/readiness, edge, workers, backup, certificates.
5. customer_smoke: approved synthetic journey with no unauthorized customer mutations.
6. data_rls_backup: migration, structural audit, isolation, retention, backup and restore.
7. support_accessibility: references **both distinct** Support and Accessibility artifacts.
8. rollback_monitoring: compatible last-known-good tuple, rehearsal, incident route and schedule.

Dark-slot provisioning and migration preparation need their own previously approved scoped authority; the final traffic GO does not retroactively authorize them. Incompatible/destructive database migration blocks rollout unless a separate maintenance/recovery plan is approved.

### Atomic authorization consumption and execution

Authenticate the executor workload, then use a serializable transaction to lock the environment slot, check the active policy and all binding predicates, check revocations, consume a one-use nonce, increment a fencing epoch, append execution_started and commit an outbox command. No caller writes the state projection directly.

The executor uses an execution/target idempotency key and target-side fencing. If it crashes after a cloud side effect but before recording success, reconciliation observes target identity/generation before retrying. A database transaction cannot make a remote cloud operation exactly-once by itself. A late worker cannot overwrite a newer execution.

Unknown, missing, cancelled, stale or timed-out required results deny further mutation. An independent cloud rollback controller watches heartbeats and target health; an Actions failure step alone will not survive runner loss. It can execute only the already-approved compatible rollback tuple. If no safe tuple exists, isolate the candidate or enter maintenance/read-only mode; do not blindly reverse migrations.

### CI/CD pseudo-configuration

The companion ci-cd.pseudo.yaml is a specification outside .github/workflows, not executable Actions YAML. Adapter commands, identity bindings and reference symbols must be implemented and verified before activation. Privileged jobs must use trusted protected workflow/policy code, not unchecked candidate scripts.

Sequence: owner bootstrap -> immutable build/scans -> preauthorized automated staging -> frozen handoff -> two separate staging reviews -> explicit operator action -> fresh probes -> eight production checks/five role artifacts -> five reviews/final GO -> explicit production operator action -> monitoring -> operational closeout -> archives/readback -> scheduled final closeout.

## 5. Closeout and post-execution

### Monitoring

| Cadence | Required observations | Failure outcome |
| --- | --- | --- |
| Immediate | Digest/origin, health/readiness, edge, worker/outbox, alert route, support, safe customer smoke | Stop ramp; contain/rollback affected release |
| 15m | Errors/latency, capacity, retry/lease health and duplicate-delivery detection | Incident, revoke further promotion, approved containment |
| 1h | Sustained capacity, saturation, queues, support and integrity signals | Same fail-closed path |
| 24h | Backup/PITR freshness, isolation/security signals and operational trend | Hold closeout, incident/rollback assessment |
| 7d | Stability, restore policy, unresolved incidents and complete receipts | Final closeout only on complete pass |

Use a durable external scheduler, not a seven-day workflow or a precise-timing assumption about GitHub cron. Record due time, observed time, tolerance, result, real collector and Gregg as monitoring owner. Proposed allowed lateness: 5m/10m/1h/4h for the four follow-ups, subject to approval. These do not extend deployment authority. Overdue checks are blocked; retries never backdate results.

Any late failure triggers the incident path, but compare current environment generation before rollback: an old release's check must not undo a newer release. Ledger unavailability freezes new changes and buffers signed non-secret observations; already-approved healthy service may continue. If safety is unknown, disable affected writes/features or use maintenance mode.

### Checksum-verified GitHub and Drive archive routine

1. After immediate operational success **and explicit publication authority**, freeze export generation G0 with source/non-secret config, manifests, five role artifacts, approvals, GO, execution and initial monitoring. Exclude secrets, customer data, raw dumps and unrestricted logs.
2. Produce source ZIP deterministically from the exact Git commit with hierarchy intact. Optionally add an authorized Git bundle for offline history recovery. For evidence, enumerate each path, media type, byte length and SHA-256. Source and evidence ZIPs have different purposes and separate hashes.
3. Scan all payloads before any upload. A failed scan blocks publication and invokes containment.
4. In both approved GitHub repositories preserve the exact source commit and upload the **same locally constructed source ZIP bytes** as release assets. Observe repository ID, candidate SHA, release/tag, asset ID/name/size/hash/URL and time. Read back and hash content. A provider-generated source ZIP need not match a custom ZIP. Protect refs and verify immutable-release settings where used. [Immutable releases](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes), [asset API](https://docs.github.com/en/rest/releases/assets)
5. Verify the approved corporate Drive folder/shared-drive identity and effective permissions. Upload non-secret evidence as a binary ZIP without Docs conversion, using resumable transfer. Use export-ID/artifact-hash idempotency metadata and reconcile ambiguous results before retrying. [Uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [shared drives](https://developers.google.com/workspace/drive/api/guides/enable-shareddrives)
6. Read back both metadata and content. Match candidate/export/artifact bindings, exact name, integer byte count, SHA-256, intended parent/repository and observed IDs/URLs/times. Drive exposes binary checksum/size fields; independently hash downloaded bytes if a SHA-256 field is unavailable. Opaque IDs do not equal across providers: each must match its own observed receipt. [Drive file fields](https://developers.google.com/workspace/drive/api/reference/rest/v3/files)
7. Only after readback append signed receipts. Any missing or mismatched GitHub A/B or Drive receipt leaves archive_pending/closeout_blocked, triggers bounded retry and alerts Gregg. Apply approved containment; never mark partial replication as a complete backup or blindly roll back a newer deployment.
8. Store the receipt set as a signed sidecar plus ledger events. It cannot be inside the exact archive whose upload it attests. Anchor manifest and receipt-set hashes independently, avoiding an infinite self-referential archive.
9. Append later monitoring as G1...Gfinal or delta bundles, linked to prior hashes, never overwriting G0. Final generation includes all required follow-ups and has its own matching destination receipts. Only then permit final closeout.

Both configured GitHub repositories were reachable during this inquiry; that does not prove publication rights, protections or corporate ownership. The approved Drive folder ID and a live connector are not available in this session. Do not fabricate them or activate the publisher without verified bindings.

### Backup is more than publication

Two repositories under one provider/account are correlated copies. Keep separately administered encrypted recovery copies in retention-controlled object storage. Drive is not assumed immutable and is not the database backup system.

Database snapshots/WAL/PITR remain in an approved encrypted off-host backup service; only redacted metadata and restore proof enter the non-secret ledger/Drive package. Restore source, pinned images, non-secret config, secret-reference bindings, database, ledger signatures, receipts and scheduler state in a clean environment. Measure RTO/RPO. Reconcile the latest independent revocation anchor before enabling restored authority; an old backup must not resurrect revoked approvals.

## Thirty implementation work packages

These are planned steps with acceptance conditions, not 30 claimed completed changes. Execute in this order; missing exit evidence blocks dependent work. Gregg remains accountable for every row under the distinct role labels.

| # | Work package | Required output / acceptance |
| --- | --- | --- |
| 01 | Establish INC/jurisdiction/domain/applicability register | Unknown mandatory obligations block approval |
| 02 | Bind Gregg identity and MFA | Same display name with wrong subject is rejected |
| 03 | Protect exact canonical-owner policy | Missing/alternate owner in any tier fails |
| 04 | Verify contacts and corporate resource control | Observed proofs; no invented contact/folder/account |
| 05 | Bootstrap workflows and runtime admission | Candidate cannot alter its own gate or get early privilege |
| 06 | Freeze candidate envelope/canonical hashing | Nested mutations and duplicate JSON keys are rejected |
| 07 | Pin toolchain/actions/images and provenance | Rebuild or tag substitution cannot reuse approval |
| 08 | Implement secret-safe collectors/incident response | Synthetic leakage blocks ordinary logging and export |
| 09 | Align operations/notification bounds and fences | Invalid tuple fails; late worker cannot win |
| 10 | Provision external HA data/network/identity | TLS negative and two-tenant RLS tests pass |
| 11 | Provision hot standby and edge | Full-capacity local-outage rehearsal meets measured target |
| 12 | Authorize automated staging and run its gate | All scans/boundary/probes pass before promotion review |
| 13 | Implement restricted append-only compliance ledger | Direct unauthorized insert/update/delete/truncate denied |
| 14 | Produce five separate role artifacts | Missing/duplicate role, ID, reference or hash blocks |
| 15 | Implement retention, signing and external anchors | Altered root/signature/chain fails verification |
| 16 | Implement manual migrations and restore proof | Actual isolated restore and rollback compatibility pass |
| 17 | Collect deployed support/accessibility evidence | Verified route plus manual accessibility, not scan-only claim |
| 18 | Implement two staging approvals | Same handoff and identical future window <=4h |
| 19 | Separate issuance/execution time checks | Before-start/end/expiry/skew fail; valid in-window succeeds |
| 20 | Implement nonce/fence/outbox executor | Replay and concurrency cannot duplicate authorized effect |
| 21 | Collect eight production checks/five reviews | Combined check cannot replace separate role evidence |
| 22 | Implement final GO and independent operator action | GO alone cannot deploy; binding changes revoke authority |
| 23 | Implement independent rollback/containment controller | Runner loss after mutation restores safe baseline or isolates |
| 24 | Rehearse outage/recovery/failback | No split-brain or duplicate delivery in declared scope |
| 25 | Implement durable follow-up scheduler | No future pass; overdue blocks; old generation cannot roll back new |
| 26 | Freeze deterministic sanitized export generations | Repeated package matches or creates explicit new generation |
| 27 | Verify both GitHub source/asset receipts | Exact SHA/name/bytes/hash/ID/URL in both |
| 28 | Implement Drive upload/readback | Exact binary hash/size/parent/ID; ambiguous retry reconciles |
| 29 | Implement receipt sidecars/final closeout | All due observations and destination bindings pass |
| 30 | Complete recovery/security/governance rehearsal | Actual RTO/RPO, remaining risks and explicit Gregg decision |

## Observed repository gaps

| Existing foundation | Remaining work |
| --- | --- |
| Shared Gregg default; ship/production approval-to-owner matching | Exact Gregg equality is not universal; preflight accepts other names and staging checks any human name |
| Full nested prerequisite hashing and 100 mutation cases in v2.32 | Add authenticated approval signing and independently retained roots |
| Staging <=4h and approval freshness checks | Define unified production timing and consistent end boundary |
| Fenced operational deliveries | Prove real multi-host shared-state and recipient behavior |
| Digest-oriented image publication workflow | Not a full staging/approval/deployment pipeline; add owner bootstrap and privilege isolation |
| Local verification suites | Do not establish live cloud capacity, RLS, restore, external identity or WCAG conformance |
| Local export/receipt utilities | Implement current-candidate remote readback and durable monitoring/closeout |

## Required decisions and handoff status

Before provisioning, record actual legal entity/jurisdiction, domain, cloud accounts/regions/budget, residency/retention, verified identity and contacts, Drive folder, repository capabilities, accepted time/recovery thresholds, degraded-service behavior, and standing staging/failover/rollback/publication authority.

This design package does not implement the proposed controller, establish legal compliance, provision resources, change traffic, publish source, upload evidence or alter runtime ownership behavior. The demo remains v2.32. The companion pseudo-config and SQL are reference material requiring implementation, tests and explicit authority before production use.
