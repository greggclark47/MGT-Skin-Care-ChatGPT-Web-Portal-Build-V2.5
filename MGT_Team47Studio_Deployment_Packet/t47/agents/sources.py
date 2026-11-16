"""Source-reference validation, mirroring sourceReference() in apps/api/src/portal/agent-operations.ts.

A draft may cite at most 20 unique references. Each is a Drive file id (drive:<id>) or a clean HTTPS URL with
no credentials, query string, fragment, custom port or localhost target.
"""
from __future__ import annotations

import re
from urllib.parse import urlsplit

MAX_SOURCES = 20
DRIVE_RE = re.compile(r"^drive:[A-Za-z0-9][A-Za-z0-9._-]{2,199}$")


def source_reference(value: object) -> str | None:
    if not isinstance(value, str) or not 3 <= len(value) <= 500 or value != value.strip():
        return None
    if re.search(r"[\x00-\x1f\x7f]", value):
        return None
    if DRIVE_RE.match(value):
        return value
    try:
        url = urlsplit(value)
        port = url.port
    except ValueError:
        return None
    host = url.hostname or ""
    if url.scheme != "https" or url.username or url.password or url.query or url.fragment or port or "?" in value or "#" in value:
        return None
    if not host or host == "localhost" or host.endswith(".localhost"):
        return None
    return value


def validate_sources(refs: list[str] | tuple[str, ...]) -> list[str]:
    refs = list(refs)
    if len(refs) > MAX_SOURCES:
        raise ValueError(f"at most {MAX_SOURCES} source references are allowed")
    bad = [r for r in refs if source_reference(r) is None]
    if bad:
        raise ValueError("invalid source reference(s): " + ", ".join(repr(b)[:60] for b in bad))
    if len(set(refs)) != len(refs):
        raise ValueError("source references must be unique")
    return refs
