# Production evidence implementation plan

Status: **repository preparation in progress; no live environment evidence is represented as complete.**

This plan establishes Google Drive as the primary evidence and release-archive system of record for
MGT Skin Care v2. It does not make Drive the only database-backup system: PostgreSQL backups must
remain encrypted, independently recoverable, and restored into a separate approved target. Never
place raw database dumps, credentials, tokens, customer photos, support content, OAuth material, or
unredacted provider payloads in Drive.

## Accountable authority

The designated accountable owner, approver, and launch operator is **Gregg Clark of MGT**. This is
the exact canonical value enforced by the repository for `RELEASE_OWNER_NAME` and
`SUPPORT_OWNER_NAME`; a shortened, differently cased, or otherwise altered value fails closed.

This designation establishes accountability only. It does not create a candidate-bound staging or
production approval, authenticate the human actor, or execute a deployment. Each release still
requires separately recorded, time-bounded decision and operator-action evidence.

## Evidence archive

Primary archive parent: `MGT Skin Care V2 / 00 - Production Evidence`

The archive is organized into these private, candidate-aware folders:

```text
01 - Database and RLS Evidence
02 - Backup and Restore Evidence
03 - Accessibility Evidence
04 - Monitoring and Incident Evidence
05 - Identity and Support Evidence
06 - Release and Approval Evidence
```

Every uploaded evidence artifact must be credential-free and contain, or be accompanied by, the
exact candidate commit, SHA-256 checksum, file byte count, owner (`Gregg Clark of MGT`), strict UTC
review timestamp, source-system reference, and pass/hold disposition. The release archive validator
also requires an observed Drive file ID, matching Drive URL, parent-folder confirmation, filename,
byte count, and checksum before an item can count as a release receipt.

## Sequence and evidence contracts

| Workstream | Repository control already present | Live execution and Drive evidence | Completion condition |
| --- | --- | --- | --- |
| Database and RLS | Versioned migrations; `pnpm reconcile:migrations`; `pnpm infra:database-audit -- --output work/staging/database-audit.json`; RLS fixture contracts | Approved Supabase/Postgres target, applied-migration report, two-account RLS test, service/admin-boundary report, concurrency/rollback/retention/deletion evidence | Read-only audit and behavior results match the exact candidate and target; no unresolved release blocker |
| Backup and restore | Worker heartbeat and `/readyz`; backup-verification admission; recovery-drill review contract | Encrypted off-host backup service, checksum-bound backup receipt, isolated restore transcript, measured RTO/RPO, migration version, rollback and failed-restore procedure | Restore into a distinct target succeeds and accountable owner records the outcome |
| Accessibility | Focus, reduced-motion and contrast contracts; proxy journey; Android tap-target contract | Deployed-origin keyboard/focus/Escape, screen-reader, contrast, zoom/reflow, mobile/browser matrix and defect disposition | WCAG review URL and past validation timestamp are attached; no unresolved release-blocking defect |
| Monitoring and incident response | Operations health, signed alert delivery, dashboard/runbook/owner admission gates, post-launch review contract | Real dashboard, alert send/acknowledgement test, staffed owner, incident drill and 15m/1h/24h/7d observation records | Dashboard and runbook links work; alert and recovery evidence are candidate-bound |
| Identity | Supabase Auth, PKCE Google OAuth, lifecycle/deletion/role regression coverage | Live email/OTP delivery, callback/redirect, expiry/replay, account-link/merge, deletion/retry, service-role isolation and first-superadmin provisioning evidence | Identity lifecycle passes on staging without cross-account access or silent data loss |
| Support | Ticket lifecycle, privacy projections, operator metrics and contracts | Named primary/backup owner, monitored mailbox/helpdesk, response target, test ticket lifecycle and escalation handoff | Test ticket is handled end-to-end with correct customer/operator boundaries |
| Release and approvals | Candidate package, prerequisite review, production gate, ship packet and Drive receipt validators | Hosted CI URL, immutable image manifest, staging dossier, owner decisions, launch window, rollback target and observed Drive receipts | Every required role records a candidate-bound go/hold decision; no validator status is inferred |

## Implementation phases

### Phase 1 — controlled staging foundation

1. Create isolated staging and production namespaces in the approved secret manager, with separate
   workload identities, audit trails, rotation records, and least-privilege read access. Do not
   reuse a namespace, workload identity, database, Supabase project, or unrelated secret path
   across the two environments. The only approved runtime fan-out is `DATABASE_URL` to API/worker
   and `MGT_EDGE_TOKEN` to edge/API within one environment.
2. Select distinct staging and production projects; record non-secret target identities in
   `01 - Database and RLS Evidence`.
3. Create a candidate-bound staging/production pair using
   `infra/portal/secret-injection-contract.mjs`. The web assignment must remain empty; edge, API,
   and worker receive distinct workload identities and only their allowed secret paths.
4. Inject only secret values through the approved secret manager into three private materialization
   files for edge, API, and worker. Supply three separately scoped private non-secret configuration
   files alongside them; the web service receives neither. Keep `PORTAL_AUTO_MIGRATE=false`; do not
   place `.env` files, configuration files, or materialized secret files in Drive or Git. Before
   Compose, generate the candidate-bound redacted admission report with
   `pnpm infra:secret-injection-admission`, using exactly six distinct private files and the matching
   stage-scoped project name (`mgt-skin-care-staging` or `mgt-skin-care-production`). Bind the two
   emitted contract checksums to the staged target or production `secret_manager` record. If the
   report cannot verify local private-file permissions, attach a redacted provider ACL/identity
   evidence artifact before treating the record as ready. Use distinct edge host ports if staging and
   production share a host.
5. With the approved controller injecting the context, run `pnpm infra:preflight` once in a short-lived aggregate deployment-validation context
   (`PROCESS_ROLE=deployment` or unset), then let API and worker execute their role-scoped startup
   preflight. Run `pnpm infra:readiness` and
   `pnpm infra:database-audit -- --output work/staging/database-audit.json` against the reviewed
   staging environment. Upload only redacted outputs and their checksums.
6. Build immutable images from the reconciled candidate via hosted CI. Upload the manifest and hosted
   CI link, not registry credentials.

### Phase 2 — database, identity and support qualification

1. Apply migrations through the approved database process and capture the applied lineage.
2. Execute two-account RLS, service-role boundary, profile revision, deletion/export, and
   rollback/concurrency scenarios against staging.
3. Validate real Supabase email/OTP and OAuth journeys, including expiry, replay, account linking,
   deletion retry, and first-superadmin provisioning.
4. Send and resolve a staging support ticket, capture only the redacted reference and lifecycle
   evidence, then verify escalation ownership.

### Phase 3 — backup, accessibility and operations qualification

1. Configure encrypted off-host database backups separately from Drive. Store the evidence ledger in
   Drive; retain any encrypted backup copy only after security/legal approval and never as the sole
   recovery source.
2. Restore into an isolated target, record checksum, RTO/RPO, migration version, rollback and
   failed-restore procedure; validate worker and `/readyz` states.
3. Run the deployed accessibility review across keyboard, screen reader, contrast, zoom/reflow,
   mobile and supported browser paths. Upload the report and defect disposition.
4. Configure dashboard, alert route, incident runbook and owner. Run an acknowledgement/recovery
   drill and capture the 15-minute, 1-hour, 24-hour and 7-day observation records.

### Phase 4 — candidate promotion and production observation

1. Reconcile the mixed workspace into one reviewed candidate commit before any hosted release action.
2. Generate the candidate ship packet and staging dossier; each record must carry the exact candidate
   SHA and checksum-bound evidence references.
3. Obtain named release, platform, data, support and accessibility decisions. A named owner does not
   turn a pending record into approval.
4. Only after the staging evidence and approvals are complete, execute the separately authorized
   production procedure. Capture candidate-specific GitHub and Drive receipts, then monitor the
   scheduled 15m/1h/24h/7d checkpoints.

## Commands and safety gates

Run local checks before seeking a hosted candidate result:

```text
pnpm test:infra
pnpm test:verification
pnpm test:mobile-contract
pnpm build
pnpm infra:preflight
pnpm infra:readiness
```

The last two commands require a reviewed secret-manager environment to become ready. Their failure
with no production environment supplied is expected and must remain a hold. Do not use fixture
values, placeholder URLs, copied historical evidence, or altered timestamps to make a gate pass.

## Drive operating rules

1. Keep the parent archive private to the accountable release group; do not create public links.
2. Add files rather than overwriting historical evidence. Use candidate-SHA-prefixed names such as
   `2026-10-23_<candidate-sha>_database-audit_redacted.json`.
3. Record an index row for every artifact: filename, Drive file ID, parent folder, SHA-256, byte
   count, source system, owner, UTC review time and disposition.
4. Treat Drive as the evidence-system primary and a controlled archive destination. Keep an
   independent, encrypted backup/restore path for production data.
5. Never upload customer data, sensitive logs, secrets, API keys, refresh tokens, or raw backups
   unless an approved data-handling policy explicitly permits the encrypted artifact and access
   controls have been verified.

## Current blockers

The source tree contains no production `.env`, actual database target, immutable image digest,
secret-manager binding, deployed origin, accessibility report, dashboard/runbook, support mailbox,
or candidate-bound go/no-go decision. Gregg Clark of MGT is the designated accountable
owner/approver/operator, but that designation is not a candidate-specific launch approval. These are
deliberate external holds. The repository is ready to validate them once supplied; it must not
manufacture the evidence.
