# Encrypted Google Drive export and restore policy

Google Drive is the human-reviewed export destination for encrypted, candidate-bound
release packets and approved customer-data exports. It is not the primary database,
point-in-time recovery store, or a substitute for the isolated restore target.

## Export boundary

- Export only from an approved read-only database snapshot or sanitized release packet.
- Encrypt locally with `infra/portal/encrypted-backup.mjs` using a 32-byte key injected
  by the approved secret manager as `BACKUP_ENCRYPTION_KEY`.
- Upload the resulting `.mgtenc.json` binary to the private designated Drive folder.
- Keep the key, database credentials, raw dump and customer rows out of GitHub, Drive
  metadata, logs and evidence manifests.
- Record only the candidate SHA, encrypted artifact checksum/size, Drive file ID, folder
  ID, upload time and independent read-back checksum in the release evidence.

Example operator flow (values stay in the operator shell or secret manager):

```text
BACKUP_ENCRYPTION_KEY=<64 hex characters> \
  pnpm backup:encrypt -- --input approved-export.json \
  --output work/exports/candidate.mgtenc.json --candidate-commit <40-char-sha>

BACKUP_ENCRYPTION_KEY=<64 hex characters> \
  pnpm backup:restore-test -- --input work/exports/candidate.mgtenc.json \
  --output-dir <fresh-isolated-directory> --candidate-commit <40-char-sha>
```

The restore command verifies AES-256-GCM authentication, plaintext byte count and
SHA-256 before writing a single payload into a fresh isolated directory. A failed or
candidate-mismatched restore is a hold condition.

## Periodic isolated restore

`.github/workflows/backup-restore-test.yml` runs the encryption/restore contract suite
weekly and on demand. When the repository environment is given the private encrypted
artifact and key references, the same job restores that artifact into a disposable
runner directory and emits only non-secret checksum/size evidence. Until an approved
customer export exists, the scheduled job intentionally remains contract-only rather
than inventing production data or a key.

The first real export requires the owner to supply the approved Drive folder ID, the
secret-manager key reference, the reviewed source snapshot, retention period and the
isolated restore target. No public production activation, hosted AI, or billing switch
is implied by this backup workflow.
