# Production build submission

This is the handoff list for starting production infrastructure work without treating planning, local verification, source control, or an archive as a production launch. It is intentionally deployment-neutral: no cloud vendor, account, domain, secret, production database, customer image, or traffic destination is selected here.

Generate a candidate-bound submission from a non-secret prerequisite packet:

```powershell
pnpm infra:production-build-submission -- --prerequisites work/production/prerequisites-<commit>.json --output work/production/submission-<commit>.json
```

The generated JSON binds the exact candidate and prerequisite checksum, lists eight repository-ready work packages, and keeps every missing production input visibly on hold. It serializes only bounded configuration error codes, never configuration values or credentials.

## Work that can start now

| Work package | Expected handoff evidence |
| --- | --- |
| Immutable API and web release images | GitHub Actions manifest and provenance attestations |
| API, worker, web, and edge runtime package | Pinned compose and image-digest record |
| Database migration and RLS plan | Candidate-bound execution runbook |
| Supabase identity scope plan | Approved provider/callback scope record; it does not grant Drive scope |
| Health, alert, incident, and support operations | Operations runbook and destination validation plan |
| Backup and isolated restore procedure | Schedule and restore-transcript template |
| Deployed-origin accessibility validation plan | Human/device validation report template |
| Candidate release evidence package | Candidate/archive checksum-bound release record |

## Items held for approved production inputs

The submission always holds hosting/domain/TLS, production PostgreSQL or Supabase evidence, secret-manager and key-rotation evidence, backup/restore evidence, support ownership, deployed accessibility evidence, rollback authority, launch approval, and observed GitHub and Google Drive receipts. A missing or invalid production configuration is separately held by a bounded preflight error code.

The hold is released only by the existing candidate-bound production gate after approved inputs and evidence are supplied. This process does **not** deploy services, execute a migration, provision credentials, transfer customer data/images, or change traffic.
