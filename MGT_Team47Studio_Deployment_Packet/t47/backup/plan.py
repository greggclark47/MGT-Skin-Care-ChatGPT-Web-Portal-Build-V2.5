"""The application-data backup and restore drill, written out as the exact steps and the evidence to keep.

The drill uses the repository's own encrypted-backup tooling; this module only sequences it and gives the
evidence record a fixed shape so the open release gate (backup and restore with measured RPO and RTO) can close.
"""
from __future__ import annotations

from t47.util import now_iso

DRILL_STEPS = [
    ("Freeze the candidate", "Record the 40-character commit of the release candidate. Every receipt below carries it."),
    ("Export from an approved snapshot", "Take a read-only export of the approved Supabase database snapshot. Note the snapshot time: this is the recovery point."),
    ("Encrypt locally", "BACKUP_ENCRYPTION_KEY=<from the secret manager> pnpm backup:encrypt -- --input approved-export.json --output work/exports/candidate.mgtenc.json --candidate-commit <sha>"),
    ("Store off-host", "Upload the .mgtenc.json file to the private Drive backup folder. Record the Drive file id, size and SHA-256. The key, the raw export and customer rows never go to Drive, GitHub or logs."),
    ("Read back", "Download the file again and confirm the SHA-256 matches the receipt."),
    ("Restore in isolation", "BACKUP_ENCRYPTION_KEY=<same reference> pnpm backup:restore-test -- --input work/exports/candidate.mgtenc.json --output-dir <fresh empty directory> --candidate-commit <sha>"),
    ("Time it", "Start the clock when the restore is requested and stop when the restored data passes its checks. That is the recovery time."),
    ("Check the restored data", "Row counts per table, the RLS audit, and one signed-in read for each of two test accounts against the restored copy."),
    ("Record and sign", "Fill the evidence record, attach the logs, and have the data owner sign. Then accept gate G07 with the evidence reference."),
    ("Prune by policy", "Keep seven daily and four weekly points; `t47 backup prune` lists what falls outside."),
]


def evidence_template(candidate_commit: str = "<40-character sha>") -> dict:
    return {
        "schema": "t47.restore-drill-evidence.v1", "prepared_at": now_iso(), "candidate_commit": candidate_commit,
        "snapshot_taken_at": None, "export_encrypted_at": None, "drive_file_id": None, "archive_sha256": None, "archive_bytes": None,
        "readback_sha256_matches": None, "restore_requested_at": None, "restore_verified_at": None,
        "rpo_minutes": None, "rto_minutes": None, "accepted_rpo_minutes": None, "accepted_rto_minutes": None,
        "restored_row_counts_match": None, "rls_audit_pass": None, "two_account_read_pass": None,
        "data_owner": None, "signed_off_at": None, "notes": "",
    }


def drill_markdown(candidate_commit: str = "<sha>") -> str:
    lines = ["# Backup and restore drill", "", f"Candidate: `{candidate_commit}`", "",
             "Uses the repository tooling described in `infra/portal/GOOGLE-DRIVE-ENCRYPTED-BACKUP.md`. "
             "Nothing in this drill touches production data in place.", ""]
    for index, (title, detail) in enumerate(DRILL_STEPS, 1):
        lines.append(f"{index}. **{title}.** {detail}")
    lines += ["", "RPO is the gap between the snapshot time and the moment of the simulated loss. "
              "RTO is the time from the restore request to verified data. Both are measured, then compared with the values the owner accepts."]
    return "\n".join(lines) + "\n"
