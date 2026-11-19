import json

import pytest

from t47.agents.export import SCHEMA_VERSION, reviewed_export, verify_export
from t47.agents.guardrails import Violation
from t47.agents.queue import QueueError
from t47.agents.sources import source_reference, validate_sources
from t47.util import canonical_json, sha256_hex


def make(store, **kw):
    base = dict(agent_id="customer_care", brief="b", draft="A clear, calm reply.", source_refs=["drive:1AbCdEfGhIjK"],
                created_by="agent:t47-local", violations=[])
    return store.create(**{**base, **kw})


def test_source_reference_rules():
    assert source_reference("drive:1AbCdEfGhIjK") == "drive:1AbCdEfGhIjK"
    assert source_reference("https://team47studio.com/learn/skin-match") is not None
    for bad in ("http://team47studio.com/a", "https://user:pw@example.com/a", "https://example.com/a?x=1", "https://example.com/a#top",
                "https://example.com:8443/a", "https://localhost/a", "https://app.localhost/a", "drive:", " https://example.com/a",
                "ftp://example.com/a", 42, "x"):
        assert source_reference(bad) is None, bad


def test_validate_sources_limits():
    with pytest.raises(ValueError):
        validate_sources([f"drive:file{i:03d}" for i in range(21)])
    with pytest.raises(ValueError):
        validate_sources(["drive:abc123", "drive:abc123"])
    with pytest.raises(ValueError):
        validate_sources(["https://example.com/a?token=1"])
    assert validate_sources(("drive:abc123", "https://example.com/page")) == ["drive:abc123", "https://example.com/page"]


def test_happy_path_and_audit_trail(store):
    run = make(store)
    assert run["status"] == "draft" and run["verdict"] == "clean" and run["id"].startswith("agent_")
    run = store.submit(run["id"], "gregg")
    assert run["status"] == "pending_review"
    run = store.review(run["id"], "gregg", "approve", "reads well")
    assert run["status"] == "approved" and run["reviewed_by"] == "gregg"
    actions = [entry["action"] for entry in store.audit_log()]
    assert actions == ["agent_draft_approved", "agent_draft_submitted", "agent_draft_created"]


def test_blocked_draft_cannot_be_submitted(store):
    run = make(store, violations=[Violation("medical_claim", "block", "cures", "no")])
    assert run["verdict"] == "blocked"
    with pytest.raises(QueueError):
        store.submit(run["id"], "gregg")


def test_creator_and_agents_cannot_review(store):
    run = store.submit(make(store, created_by="gregg")["id"], "gregg")
    with pytest.raises(QueueError, match="creator"):
        store.review(run["id"], "gregg", "approve")
    with pytest.raises(QueueError, match="named human"):
        store.review(run["id"], "agent:t47-local", "approve")
    with pytest.raises(QueueError, match="named human"):
        store.review(run["id"], "  ", "approve")
    with pytest.raises(QueueError):
        store.review(run["id"], "dana", "maybe")
    assert store.review(run["id"], "dana", "reject")["status"] == "rejected"


def test_only_pending_runs_can_be_decided_and_only_drafts_edited(store):
    run = make(store)
    with pytest.raises(QueueError):
        store.review(run["id"], "gregg", "approve")
    store.submit(run["id"], "gregg")
    with pytest.raises(QueueError):
        store.replace_draft(run["id"], "new", [], "gregg")
    with pytest.raises(QueueError):
        store.submit(run["id"], "gregg")
    with pytest.raises(QueueError, match="not found"):
        store.get("agent_missing")


def test_edit_rescans_and_filters_work(store):
    run = make(store, violations=[Violation("medical_claim", "block", "cures", "no")])
    run = store.replace_draft(run["id"], "A calmer line.", [], "gregg")
    assert run["verdict"] == "clean" and run["draft"] == "A calmer line."
    make(store, agent_id="social_engagement")
    assert len(store.list()) == 2
    assert [r["agent_id"] for r in store.list(agent_id="social_engagement")] == ["social_engagement"]
    assert store.list(status="approved") == []


def test_export_only_for_approved_runs_and_digest_matches_the_portal_rule(store):
    run = make(store)
    assert reviewed_export(run) is None
    store.submit(run["id"], "gregg")
    assert reviewed_export(store.get(run["id"])) is None
    approved = store.review(run["id"], "gregg", "approve")
    artifact = reviewed_export(approved)
    assert artifact["schema_version"] == SCHEMA_VERSION and artifact["status"] == "approved"
    assert artifact["controls"] == {"human_review_completed": True, "external_action_performed": False, "automatic_send": False,
                                    "automatic_publish": False}
    assert artifact["agent_name"] == "Account Setup & Customer Care" and artifact["channel"] == "portal"
    # the digest covers everything except the integrity block, serialized the way JSON.stringify would
    content = {k: v for k, v in artifact.items() if k != "integrity"}
    assert artifact["integrity"] == {"algorithm": "sha256", "content_sha256": sha256_hex(canonical_json(content))}
    assert verify_export(json.loads(json.dumps(artifact)))
    tampered = {**artifact, "draft": artifact["draft"] + " Buy now."}
    assert not verify_export(tampered)


def test_export_refuses_bad_runs(store):
    approved = store.review(store.submit(make(store)["id"], "gregg")["id"], "gregg", "approve")
    assert reviewed_export({**approved, "source_refs": ["https://example.com/a?x=1"]}) is None
    assert reviewed_export({**approved, "draft": "x" * 13_000}) is None
    assert reviewed_export({**approved, "agent_id": "unknown_agent"}) is None
    assert reviewed_export({**approved, "id": "run_123"}) is None
    assert reviewed_export({**approved, "reviewed_by": None}) is None


def test_canonical_json_matches_javascript_stringify():
    assert canonical_json({"a": 1, "b": [True, None, "é"], "c": {"d": 1.5}}) == '{"a":1,"b":[true,null,"é"],"c":{"d":1.5}}'
