"""Encrypted backup of the local agent plane (review queue, reports, bake-off results).

This covers the workstation's own state only. Application data stays with the repository's tooling
(`pnpm backup:encrypt` and `pnpm backup:restore-test`, see infra/portal/GOOGLE-DRIVE-ENCRYPTED-BACKUP.md).

AES-256-GCM with a 32-byte key read from an environment variable (64 hex characters). The key is never written
to disk, to the receipt or to the archive. Requires `cryptography` (`pip install t47[backup]`).
"""
from __future__ import annotations

import base64
import io
import json
import os
import tarfile
from datetime import datetime, timezone
from pathlib import Path

from t47.util import canonical_json, now_iso, sha256_hex

SCHEMA = "t47.agent-plane-backup.v1"
KEY_ENV = "T47_BACKUP_KEY"
SUFFIX = ".t47enc.json"


class BackupError(RuntimeError):
    pass


def load_key(env: str = KEY_ENV) -> bytes:
    value = os.environ.get(env, "")
    try:
        key = bytes.fromhex(value)
    except ValueError as exc:
        raise BackupError(f"{env} must be 64 hexadecimal characters") from exc
    if len(key) != 32:
        raise BackupError(f"{env} must be 64 hexadecimal characters (a 32-byte key)")
    return key


def _pack(src: Path) -> tuple[bytes, int]:
    buffer, count = io.BytesIO(), 0
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for path in sorted(src.rglob("*")):
            if path.is_file() and not path.name.endswith(SUFFIX) and "backups" not in path.relative_to(src).parts:
                tar.add(path, arcname=str(path.relative_to(src)))
                count += 1
    return buffer.getvalue(), count


def create_backup(src_dir: str | Path, out_dir: str | Path, key: bytes, *, stamp: datetime | None = None) -> dict:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    src, out = Path(src_dir), Path(out_dir)
    if not src.is_dir():
        raise BackupError(f"nothing to back up: {src}")
    plaintext, files = _pack(src)
    if files == 0:
        raise BackupError(f"no files under {src}")
    stamp = stamp or datetime.now(timezone.utc)
    header = {"schema": SCHEMA, "created_at": stamp.isoformat(timespec="seconds").replace("+00:00", "Z"),
              "files": files, "plaintext_bytes": len(plaintext), "plaintext_sha256": sha256_hex(plaintext)}
    nonce = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, canonical_json(header).encode("utf-8"))
    envelope = {**header, "nonce_b64": base64.b64encode(nonce).decode(), "ciphertext_b64": base64.b64encode(ciphertext).decode()}
    out.mkdir(parents=True, exist_ok=True)
    target = out / f"agent-plane-{stamp.strftime('%Y%m%dT%H%M%SZ')}{SUFFIX}"
    payload = json.dumps(envelope).encode("utf-8")
    target.write_bytes(payload)
    return {"file": str(target), "archive_sha256": sha256_hex(payload), "archive_bytes": len(payload), **header,
            "verified_at": None}


def _open(file: str | Path, key: bytes) -> tuple[dict, bytes]:
    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    try:
        envelope = json.loads(Path(file).read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise BackupError(f"cannot read backup: {exc}") from exc
    if envelope.get("schema") != SCHEMA:
        raise BackupError("not an agent-plane backup")
    header = {k: envelope[k] for k in ("schema", "created_at", "files", "plaintext_bytes", "plaintext_sha256")}
    try:
        plaintext = AESGCM(key).decrypt(base64.b64decode(envelope["nonce_b64"]), base64.b64decode(envelope["ciphertext_b64"]),
                                        canonical_json(header).encode("utf-8"))
    except InvalidTag as exc:
        raise BackupError("authentication failed: wrong key or altered backup") from exc
    if len(plaintext) != header["plaintext_bytes"] or sha256_hex(plaintext) != header["plaintext_sha256"]:
        raise BackupError("decrypted content does not match the recorded size and checksum")
    return header, plaintext


def verify_backup(file: str | Path, key: bytes) -> dict:
    """Decrypt in memory and check size and checksum. Writes nothing."""
    header, _ = _open(file, key)
    return {"file": str(file), "ok": True, "verified_at": now_iso(), **header}


def restore_backup(file: str | Path, dest_dir: str | Path, key: bytes) -> dict:
    """Restore into a fresh directory. Refuses to write into a directory that already has content."""
    dest = Path(dest_dir)
    if dest.exists() and any(dest.iterdir()):
        raise BackupError(f"restore target is not empty: {dest}")
    header, plaintext = _open(file, key)
    dest.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(plaintext), mode="r:gz") as tar:
        tar.extractall(dest, filter="data")
    restored = sum(1 for p in dest.rglob("*") if p.is_file())
    if restored != header["files"]:
        raise BackupError(f"restored {restored} files, expected {header['files']}")
    return {"file": str(file), "restored_to": str(dest), "files": restored, "restored_at": now_iso(), **header}


def list_backups(out_dir: str | Path) -> list[tuple[datetime, Path]]:
    found = []
    for path in Path(out_dir).glob(f"agent-plane-*{SUFFIX}"):
        try:
            stamp = datetime.strptime(path.name[len("agent-plane-"):-len(SUFFIX)], "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        found.append((stamp, path))
    return sorted(found, reverse=True)
