import json
from datetime import datetime, timedelta, timezone

import pytest

from t47.backup.agentplane import KEY_ENV, SUFFIX, BackupError, create_backup, list_backups, load_key, restore_backup, verify_backup
from t47.backup.plan import DRILL_STEPS, drill_markdown, evidence_template
from t47.backup.retention import plan_retention

KEY = bytes(range(32))


def populate(folder):
    (folder / "bakeoff").mkdir(parents=True)
    (folder / "queue.sqlite3").write_bytes(b"queue-bytes" * 100)
    (folder / "gates.json").write_text('{"G01": {"status": "open"}}', encoding="utf-8")
    (folder / "bakeoff" / "run.json").write_text("{}", encoding="utf-8")
    return folder


def test_key_must_be_32_bytes_of_hex(monkeypatch):
    monkeypatch.delenv(KEY_ENV, raising=False)
    with pytest.raises(BackupError):
        load_key()
    monkeypatch.setenv(KEY_ENV, "abc")
    with pytest.raises(BackupError):
        load_key()
    monkeypatch.setenv(KEY_ENV, "zz" * 32)
    with pytest.raises(BackupError):
        load_key()
    monkeypatch.setenv(KEY_ENV, KEY.hex())
    assert load_key() == KEY


def test_roundtrip_encrypt_verify_restore(tmp_path):
    src = populate(tmp_path / "state")
    receipt = create_backup(src, src / "backups", KEY)
    archive = tmp_path / "state" / "backups" / receipt["file"].split("/")[-1]
    assert archive.name.endswith(SUFFIX) and receipt["files"] == 3 and len(receipt["archive_sha256"]) == 64
    raw = archive.read_bytes()
    assert b"queue-bytes" not in raw and KEY.hex().encode() not in raw  # ciphertext only; the key is not stored
    assert verify_backup(archive, KEY)["ok"] is True
    restored = restore_backup(archive, tmp_path / "restore", KEY)
    assert restored["files"] == 3
    assert (tmp_path / "restore" / "queue.sqlite3").read_bytes() == b"queue-bytes" * 100
    assert json.loads((tmp_path / "restore" / "gates.json").read_text()) == {"G01": {"status": "open"}}
    assert (tmp_path / "restore" / "bakeoff" / "run.json").is_file()


def test_backups_do_not_nest_and_restore_needs_an_empty_target(tmp_path):
    src = populate(tmp_path / "state")
    first = create_backup(src, src / "backups", KEY, stamp=datetime(2026, 11, 14, 2, 30, tzinfo=timezone.utc))
    second = create_backup(src, src / "backups", KEY, stamp=datetime(2026, 11, 15, 2, 30, tzinfo=timezone.utc))
    assert second["files"] == 3 and second["plaintext_bytes"] == first["plaintext_bytes"]
    assert [stamp.day for stamp, _ in list_backups(src / "backups")] == [15, 14]
    with pytest.raises(BackupError, match="not empty"):
        restore_backup(second["file"], src, KEY)


def test_wrong_key_and_tampering_are_detected(tmp_path):
    src = populate(tmp_path / "state")
    file = create_backup(src, tmp_path / "out", KEY)["file"]
    with pytest.raises(BackupError, match="authentication failed"):
        verify_backup(file, bytes(32))
    envelope = json.loads(open(file, encoding="utf-8").read())
    envelope["files"] = 99  # header is authenticated
    (tmp_path / "out" / "tampered.t47enc.json").write_text(json.dumps(envelope), encoding="utf-8")
    with pytest.raises(BackupError, match="authentication failed"):
        verify_backup(tmp_path / "out" / "tampered.t47enc.json", KEY)
    (tmp_path / "out" / "junk.t47enc.json").write_text("{}", encoding="utf-8")
    with pytest.raises(BackupError, match="not an agent-plane backup"):
        verify_backup(tmp_path / "out" / "junk.t47enc.json", KEY)
    with pytest.raises(BackupError):
        create_backup(tmp_path / "missing", tmp_path / "out", KEY)
    (tmp_path / "empty").mkdir()
    with pytest.raises(BackupError, match="no files"):
        create_backup(tmp_path / "empty", tmp_path / "out", KEY)


def test_retention_keeps_seven_daily_and_four_weekly():
    newest = datetime(2026, 11, 14, 20, 30, tzinfo=timezone.utc)
    stamps = [newest - timedelta(days=d) for d in range(60)] + [newest - timedelta(hours=3)]
    plan = plan_retention(stamps)
    keep = plan["keep"]
    assert keep[0] == newest and len(keep) == 11 and len(plan["prune"]) == len(set(stamps)) - 11
    assert [s.date() for s in keep[:7]] == [(newest - timedelta(days=d)).date() for d in range(7)]
    weeks = [s.isocalendar()[:2] for s in keep[7:]]
    assert len(set(weeks)) == 4 and all(s < keep[6] for s in keep[7:])
    assert (newest - timedelta(hours=3)) in plan["prune"]  # only the newest backup of a day is kept
    assert plan_retention([]) == {"keep": [], "prune": []}
    assert plan_retention([newest]) == {"keep": [newest], "prune": []}
    assert set(plan_retention(stamps, daily=2, weekly=0)["keep"]) == {newest, newest - timedelta(days=1)}
    assert plan_retention(stamps, daily=0, weekly=0)["keep"] == [newest]  # the newest backup survives any policy


def test_drill_uses_the_repository_tooling_and_a_fixed_evidence_shape():
    text = drill_markdown("a" * 40)
    assert "pnpm backup:encrypt" in text and "pnpm backup:restore-test" in text and "RPO" in text and "a" * 40 in text
    assert len(DRILL_STEPS) == 10
    record = evidence_template("a" * 40)
    assert record["schema"] == "t47.restore-drill-evidence.v1" and record["candidate_commit"] == "a" * 40
    assert {"rpo_minutes", "rto_minutes", "accepted_rpo_minutes", "accepted_rto_minutes", "data_owner", "signed_off_at"} <= set(record)
    assert all(record[k] is None for k in ("rpo_minutes", "rto_minutes", "data_owner"))  # measured and signed by people, never prefilled
