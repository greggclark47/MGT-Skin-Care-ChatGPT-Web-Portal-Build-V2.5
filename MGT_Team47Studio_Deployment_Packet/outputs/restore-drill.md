# Backup and restore drill

Candidate: `<40-character sha>`

Uses the repository tooling described in `infra/portal/GOOGLE-DRIVE-ENCRYPTED-BACKUP.md`. Nothing in this drill touches production data in place.

1. **Freeze the candidate.** Record the 40-character commit of the release candidate. Every receipt below carries it.
2. **Export from an approved snapshot.** Take a read-only export of the approved Supabase database snapshot. Note the snapshot time: this is the recovery point.
3. **Encrypt locally.** BACKUP_ENCRYPTION_KEY=<from the secret manager> pnpm backup:encrypt -- --input approved-export.json --output work/exports/candidate.mgtenc.json --candidate-commit <sha>
4. **Store off-host.** Upload the .mgtenc.json file to the private Drive backup folder. Record the Drive file id, size and SHA-256. The key, the raw export and customer rows never go to Drive, GitHub or logs.
5. **Read back.** Download the file again and confirm the SHA-256 matches the receipt.
6. **Restore in isolation.** BACKUP_ENCRYPTION_KEY=<same reference> pnpm backup:restore-test -- --input work/exports/candidate.mgtenc.json --output-dir <fresh empty directory> --candidate-commit <sha>
7. **Time it.** Start the clock when the restore is requested and stop when the restored data passes its checks. That is the recovery time.
8. **Check the restored data.** Row counts per table, the RLS audit, and one signed-in read for each of two test accounts against the restored copy.
9. **Record and sign.** Fill the evidence record, attach the logs, and have the data owner sign. Then accept gate G07 with the evidence reference.
10. **Prune by policy.** Keep seven daily and four weekly points; `t47 backup prune` lists what falls outside.

RPO is the gap between the snapshot time and the moment of the simulated loss. RTO is the time from the restore request to verified data. Both are measured, then compared with the values the owner accepts.
