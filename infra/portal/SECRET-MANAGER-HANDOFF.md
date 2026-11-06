# Secret-manager handoff

Status: **ready for provider binding; no secret-manager account, credential, or runtime value is
stored in this repository.**

## Authority and boundary

The accountable owner, approver, and launch operator is **Gregg Clark of MGT**. Human ownership is
not a credential: each staging and production decision remains a separate, authenticated,
candidate-bound record with a bounded execution window. The secret manager authenticates workloads;
it never supplies human approval.

Use Google Drive only for redacted evidence and release records. Do not put secret values, `.env`
files, raw database backups, OAuth refresh tokens, Stripe secrets, or secret-manager export files in
Drive or Git.

## Namespace and identity model

Create two private namespaces in the already approved secret manager:

```text
mgt-skin-care/staging
mgt-skin-care/production
```

Each namespace needs a separate least-privilege workload identity. Staging identity may read only
the staging namespace; production identity may read only the production namespace. Build, migration,
runtime, backup-attestation, and export identities must remain separately auditable. Give a human
operator administrative access only through the provider's MFA-protected interface; do not convert
that access into repository values.

## Workload injection boundary

Use the repository's provider-neutral
[`secret-injection-contract.mjs`](./secret-injection-contract.mjs) as the non-secret plan for each
environment. Create a candidate-bound staging/production pair and validate the pair before asking
the provider to materialize anything. It records provider, namespace, workload identity, and secret
**path** references only; it cannot authenticate to a provider or resolve a value.

The deployment package accepts three private, noncommitted secret-materialization paths:

| Workload | Deployment input | Allowed secret variables |
| --- | --- | --- |
| Edge | `EDGE_RUNTIME_SECRETS_FILE` | `MGT_EDGE_TOKEN` only |
| API | `API_RUNTIME_SECRETS_FILE` | `DATABASE_URL`, `MGT_EDGE_TOKEN`, `SUPABASE_ANON_KEY`, plus enabled API-only backup, billing, and AI secrets |
| Worker | `WORKER_RUNTIME_SECRETS_FILE` | `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPERATIONS_ALERT_WEBHOOK_TOKEN`, plus `NOTIFICATION_WEBHOOK_TOKEN` only when webhook delivery is enabled |
| Web | No secret-manager input | No secrets; it receives only its private `PORTAL_API_ORIGIN` runtime setting |

The only allowed shared provider paths are `DATABASE_URL` (API and worker) and `MGT_EDGE_TOKEN`
(edge and API). They are still materialized into separate per-workload files. Do not mount, copy,
or log any generated file, and do not grant the web workload an identity or a secret-manager read
permission.

## Non-secret configuration boundary

Secrets and ordinary runtime configuration must remain separate. The deployment controller supplies
one private, stage-specific configuration file for each secret-bearing workload before it loads the
matching secret-manager output:

| Workload | Non-secret deployment input | Expected configuration scope |
| --- | --- | --- |
| Edge | `EDGE_RUNTIME_CONFIG_FILE` | Canonical portal domain only |
| API | `API_RUNTIME_CONFIG_FILE` | Owner declarations, public origin, worker timing, Supabase origin/auth mode, feature flags, evidence references, and enabled-product identifiers |
| Worker | `WORKER_RUNTIME_CONFIG_FILE` | Owner declarations, worker timing/health path, Supabase origin, backup/retention policy, operations and notification endpoints/policies |
| Web | None | Its fixed internal `PORTAL_API_ORIGIN` only |

Compose loads the non-secret file first and the matching `*_RUNTIME_SECRETS_FILE` second. The
configuration files must never contain `DATABASE_URL`, a key, token, password, client secret, or
any secret-manager export. Image digests and the Compose deployment input are also non-secret
candidate controls; keep them in the reviewed deployment system, not in Git, Drive, or a runtime
secret file.

Before launch, perform one short-lived aggregate validation with `PROCESS_ROLE=deployment` (or
unset) using all reviewed role-scoped inputs, then discard that validation context. API and worker
containers run their own role-scoped preflight (`PROCESS_ROLE=api` or `worker`) at startup. Those
runtime checks reject peer secrets rather than silently accepting a shared environment.

## Secret inventory

The following names are non-secret identifiers to create per enabled environment. Use provider paths
or names that are unique to each namespace and record only those identifiers in the operator intake.

| Runtime variable | Required when | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Always | TLS-verified application database connection |
| `MGT_EDGE_TOKEN` | Always | Edge-to-API request boundary |
| `SUPABASE_ANON_KEY` | Always | Public auth client configuration injected server-side as configured |
| `SUPABASE_SERVICE_ROLE_KEY` | Always | Restricted account lifecycle operations |
| `OPERATIONS_ALERT_WEBHOOK_TOKEN` | Always in production | Signed operational alert delivery |
| `BACKUP_ATTESTATION_SECRET` | `BACKUP_ATTESTATION_ENABLED=true` | Backup-verification receipt authentication |
| `NOTIFICATION_WEBHOOK_TOKEN` | `NOTIFICATION_DELIVERY=webhook` | Customer-notification delivery signing |
| `OPENAI_API_KEY` | `HOSTED_OPENAI_ENABLED=true` | Optional hosted AI service access |
| `OPENCLAW_API_KEY` | OpenClaw OpenAI-completions mode enabled | Optional orchestration service access |
| `STRIPE_SECRET_KEY` | Subscriptions enabled | Stripe server-side API access |
| `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` | Subscriptions enabled | Stripe webhook signature verification |

Never copy a value between environments or unrelated integration roles. The two explicit shared
paths above are the only intentional fan-out and are validated as such. The runtime admission and
preflight controls reject unsafe or cross-wired production declarations. Store only the actual secret
values in the manager; injection resolves them at workload startup.

## Staging execution sequence

1. Bind an approved staging project, distinct database, Supabase project, origin, and namespace.
2. Create the applicable staging secret names; record the provider and secret **paths only** in the
   non-secret operator intake and a candidate-bound staging injection contract. The contract records
   separate edge/API/worker identities, rejects web assignment, and permits only the two explicit
   shared paths above.
3. Create separate edge/API/worker non-secret configuration files and matching secret-manager
   materializations. Configure each staging workload to read only its matching staging identity and
   namespace; leave every disabled-feature secret path unmapped. Disable automatic migrations
   (`PORTAL_AUTO_MIGRATE=false`). Run
   `pnpm infra:secret-injection-admission` with both candidate-bound contracts, all six private
   paths, and `--compose-project-name mgt-skin-care-staging`; write its redacted report to
   `work/staging/secret-injection-admission.json`. It reads secret variable names only, rejects
   shared files, peer secrets, disabled-feature mappings, and secret-like configuration values, and
   is the required staging `secret_injection` artifact. Copy its two **contract checksums** into the
   staging target's `secret_injection_contract_checksums`; the evidence review rejects a report that
   is not bound to that declared pair.
4. Inject values at runtime without printing them. Run `pnpm infra:preflight` once in the ephemeral
   aggregate deployment-validation context, then let each API/worker container perform its own
   role-scoped preflight and run `pnpm infra:readiness` from the reviewed deployment context.
5. Create a redacted secret-injection report containing candidate commit, target identity, namespace
   identifier, workload identity identifier, timestamp, rotation-policy reference, pass/hold result,
   and no secret values. Put it in `work/staging/` and archive only the redacted report and checksum
   under Drive's `06 - Release and Approval Evidence`.
6. Continue with the existing staging target, probe, evidence, review, handoff, approvals, and
   operator-execution contracts. A successful injection is not a staging approval.

## Production execution sequence

1. After staging evidence is complete, create the distinct production namespace and edge/API/worker
   workload identities. Keep migration credentials separate from runtime credentials.
2. Populate the operator intake's `secret_references_only` fields and the candidate-bound production
   injection contract with provider paths/names only. Validate it together with the staging contract.
   Do not enter values in the intake, GitHub, Google Drive, chat, or source files.
3. Build separate production configuration and secret-materialization files for edge, API, and
   worker. Run `pnpm infra:secret-injection-admission` with both candidate-bound contracts, all
   six private paths, and `--compose-project-name mgt-skin-care-production`; write its redacted
   report to `work/production/secret-injection-admission.json`. The production prerequisite
   review accepts this report—not a free-form secret-manager note—for its `secret_manager` record.
   That record must repeat the report's exact staging/production contract checksums. If the report
   says `provider_acl_required` (for example, because the admission ran on Windows or private-file
   permissions could not be inspected), attach a redacted provider ACL/identity-policy evidence
   artifact with checksum and byte count before the prerequisite review can become ready.
   Run production `pnpm infra:preflight` in the ephemeral aggregate deployment-validation
   context and `pnpm infra:readiness` through the reviewed deployment runtime. Each API/worker
   process also runs its role-scoped preflight before opening the database. All must pass before
   live validation; failures remain holds.
4. Capture a redacted injection/rotation/least-privilege report, then attach its Drive file identity,
   checksum, byte count, target, and timestamp to the candidate evidence matrix.
5. Require candidate-bound staging evidence and separately recorded approval roles before any
   operator deployment action. Owner designation alone is never a launch decision.

## Evidence to retain

The Drive archive should receive only credential-free evidence:

- provider name, namespace and workload-identity identifiers;
- secret-name/path inventory, without values;
- access-policy, rotation, and last-rotation evidence references;
- provider ACL/identity-policy evidence when local filesystem permissions could not be verified;
- candidate-bound injection reports and preflight/readiness outcomes;
- immutable evidence checksums, byte counts, Drive file IDs and review timestamps.

Keep encrypted production database backups in the approved backup system, with an independently
tested restore target. Drive remains the primary evidence archive, not the sole recovery system.

## Required binding to continue live injection

The repository is ready for a provider binding but does not contain a selected secret-manager
provider, its approved namespace paths, workload identities, or secret values. Supply the provider
name and the approved non-secret staging/production namespace references through the controlled
operator channel; then the runtime configuration can be injected and validated without disclosing
secrets.
