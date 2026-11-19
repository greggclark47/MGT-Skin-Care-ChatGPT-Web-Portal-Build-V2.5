"""Reviewed-draft export. Same shape and integrity rule as the portal's team47studio.agent-review-export.v1,
under its own schema id so a locally reviewed draft is never mistaken for one reviewed in the portal console.

The artifact is an input to a later, separately authorized delivery step. Exporting sends nothing.
"""
from __future__ import annotations

import re

from t47.agents.guardrails import MAX_DRAFT_BYTES
from t47.agents.roster import get_agent
from t47.agents.sources import MAX_SOURCES, source_reference
from t47.util import canonical_json, sha256_hex

SCHEMA_VERSION = "team47studio.local-agent-review-export.v1"
RUN_ID = re.compile(r"^agent_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


def reviewed_export(run: dict) -> dict | None:
    """Return the export artifact for an approved run, or None when the run does not qualify."""
    draft = run.get("draft")
    if not RUN_ID.match(str(run.get("id", ""))) or run.get("status") != "approved" or run.get("review_decision") != "approve":
        return None
    if not isinstance(draft, str) or not draft.strip() or len(draft.encode("utf-8")) > MAX_DRAFT_BYTES or re.search(r"[\x00\x7f]", draft):
        return None
    refs = run.get("source_refs")
    if not isinstance(refs, list) or len(refs) > MAX_SOURCES or len(set(refs)) != len(refs) or any(source_reference(r) is None for r in refs):
        return None
    if not run.get("reviewed_by") or not run.get("reviewed_at") or not run.get("created_at"):
        return None
    try:
        agent = get_agent(run["agent_id"])
    except KeyError:
        return None
    content = {
        "schema_version": SCHEMA_VERSION, "run_id": run["id"], "agent_id": agent.id, "agent_name": agent.name,
        "channel": agent.channel, "status": "approved", "draft": draft.strip(), "source_refs": refs,
        "created_at": run["created_at"], "approved_at": run["reviewed_at"],
        "controls": {"human_review_completed": True, "external_action_performed": False, "automatic_send": False,
                     "automatic_publish": False},
        "origin": "local_agent_plane",
    }
    return {**content, "integrity": {"algorithm": "sha256", "content_sha256": sha256_hex(canonical_json(content))}}


def verify_export(artifact: dict) -> bool:
    """Recompute the digest over everything except the integrity block."""
    integrity = artifact.get("integrity") or {}
    content = {k: v for k, v in artifact.items() if k != "integrity"}
    return integrity.get("algorithm") == "sha256" and integrity.get("content_sha256") == sha256_hex(canonical_json(content))
