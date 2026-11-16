"""Regression tests for 1.1.0: deterministic care triage, card data, D09 v3.9 alignment, corrected data."""
import pytest

from t47.agents.guardrails import contains_card_number, scan, verdict
from t47.agents.runner import run_agent, validate_brief
from t47.agents.triage import REPLIES, triage
from t47.diagnostics import site
from t47.models.registry import candidates_for, fit_table
from t47.release.gates import evaluate, initial_state, load_catalog
from t47.util import load_data

from conftest import make_fetch


@pytest.mark.parametrize("brief,kind", [
    ("My face broke out in a rash after the serum", "reaction"),
    ("it is burning and my lips are swollen", "reaction"),
    ("Please delete my account and all my data", "privacy"),
    ("I want a copy of my data under GDPR", "privacy"),
    ("I was charged twice this month", "payment_dispute"),
    ("I am filing a chargeback", "payment_dispute"),
    ("Can I talk to a real person please", "human"),
    ("rash, and also refund me", "reaction"),            # safety outranks billing
])
def test_hard_escalations_are_detected(brief, kind):
    assert triage(brief).kind == kind


@pytest.mark.parametrize("brief", ["How do I reset my password?", "Where can I change my email address?",
                                   "I had no irritation at all, just asking how often to use it", "Which plan includes the color finder?"])
def test_ordinary_questions_are_not_escalated(brief):
    assert triage(brief) is None


def test_fixed_replies_pass_the_care_guardrails_and_promise_no_time():
    for kind, reply in REPLIES.items():
        assert scan(reply, "care") == [], kind
        assert not any(word in reply.lower() for word in ("within", "hours", "minutes", "business day")), kind
    assert "seek medical or emergency help" in REPLIES["reaction"] and "cannot assess" in REPLIES["reaction"]


def test_escalation_makes_no_model_call(settings, store, fake_client):
    client = fake_client({"*": "this text must never be used"})
    out = run_agent("customer_care", "My skin is burning after the mask, what should I do?", settings=settings, store=store,
                    clients={"ollama": client})
    run = out["run"]
    assert client.calls == [] and run["draft"] == REPLIES["reaction"]
    assert run["provider"] == "deterministic" and run["verdict"] == "review"
    assert [g["rule"] for g in run["guardrail"]] == ["escalate_reaction"]
    assert out["attempts"][0]["outcome"] == "escalated"
    # other agents are not triaged: a partner brief mentioning a refund policy still goes to the model
    client = fake_client({"*": "A short, factual note about the returns policy."})
    run_agent("retailer_partnerships", "Draft a note asking about their refund policy.", settings=settings, store=store, clients={"ollama": client})
    assert len(client.calls) == 1


def test_card_numbers_are_refused_in_briefs_and_blocked_in_drafts():
    assert contains_card_number("card 4242 4242 4242 4242 exp 12/29") and contains_card_number("4242-4242-4242-4242")
    assert not contains_card_number("order 1234567890123456") and not contains_card_number("call 212-555-0147")
    assert not contains_card_number("0000000000000000")
    with pytest.raises(ValueError, match="card number"):
        validate_brief("Customer says their card 4242 4242 4242 4242 was declined")
    found = scan("Your card 4242424242424242 is on file.", "internal")
    assert [v.rule for v in found] == ["card_data"] and found[0].match == "[redacted]" and verdict(found) == "blocked"


def test_new_gates_from_the_handoff():
    ids = [g["id"] for g in load_catalog()]
    assert ids[-2:] == ["G24", "G25"]
    state = initial_state()
    for platform in ("web", "android", "ios"):
        result = evaluate(platform, state)
        assert "G25" in {b["id"] for b in result["blockers"]}
        assert "G24" in {b["id"] for b in result["launch_readiness_open"]}


def test_model_and_cost_data_corrections():
    rows = {r["id"]: r for r in fit_table(16)}
    assert rows["qwen3.5:9b"]["size_gb"] == 6.6 and rows["qwen3.5:9b"]["fit"] == "fits"
    assert rows["mistral-small3.2"]["size_gb"] == 15.0 and rows["mistral-small3.2"]["fit"] == "tight"
    assert "qwen3.5:9b" in candidates_for("drafting", 16)
    assert all(r["size_gb"] is not None for r in rows.values() if r["status"] == "candidate")
    pytest.importorskip("t47.economics.model")  # cost data ships in the private packet only
    costs = load_data("costs.json")
    preset = costs["price_presets"]["A"]
    assert (preset["guided"], preset["studio"]) == (14.99, 29.99) and "Owner-set" in preset["label"]  # handoff v1.2 plans
    cloud = next(f for f in costs["fixed"] if f["id"] == "ollama_cloud")
    assert (cloud["lean"], cloud["base"]) == (0, 0)


def test_site_reports_v39_routes_as_information_only():
    routes = {"https://team47studio.com/": (200, "<title>Team 47 Studio</title>", {}), "/trust-and-ai": (200, "ok")}
    report = site.run("https://team47studio.com", "https://www.team47studio.com", fetch=make_fetch(routes), tls_days=lambda h: 30.0)
    got = {c.id: (c.status, c.detail) for c in report.checks}
    assert got["site.v39.trust-and-ai"] == ("info", "present")
    assert got["site.v39.privacy-terms"][0] == "info" and "not live" in got["site.v39.privacy-terms"][1]


def test_merge_preflight(tmp_path):
    import json
    import subprocess

    from t47.release import mergecheck

    assert [c.id for c in mergecheck.run(str(tmp_path)).checks] == ["merge.repo"]
    root = tmp_path / "repo"
    (root / "apps/mobile").mkdir(parents=True)
    (root / "package.json").write_text("{}")
    (root / "apps/mobile/package.json").write_text(json.dumps({"scripts": {"android:preview": "x"}}, indent=2) + "\n")
    (root / "apps/mobile/eas.json").write_text(json.dumps({"submit": {"production": {"android": {}}}}))
    got = {c.id: c.status for c in mergecheck.run(str(root)).checks}
    assert got["merge.packet"] == "fail"
    packet = root / mergecheck.PACKET_DIR
    (packet / "merge/patches").mkdir(parents=True)
    (packet / "pyproject.toml").write_text("[project]\n")
    (packet / "VERSION").write_text("9.9.9\n")
    import hashlib
    (packet / "MANIFEST.sha256").write_text(f"{hashlib.sha256(b'9.9.9' + chr(10).encode()).hexdigest()}  ./VERSION\n")
    try:
        subprocess.run(["git", "init", "-q", str(root)], check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError):
        pytest.skip("git is not available")
    patch = ("--- a/apps/mobile/package.json\n+++ b/apps/mobile/package.json\n@@ -1,5 +1,6 @@\n {\n   \"scripts\": {\n"
             "-    \"android:preview\": \"x\"\n+    \"android:preview\": \"x\",\n+    \"ios:preview\": \"y\"\n   }\n }\n")
    (packet / "merge/patches/0001-ios.patch").write_text(patch)
    report = mergecheck.run(str(root))
    got = {c.id: c.status for c in report.checks}
    assert got["merge.manifest"] == "pass" and got["merge.patch.0001"] == "warn" and got["merge.ios"] == "warn"
    assert got["merge.ci"] == "warn" and got["merge.d09"] == "info" and report.ok
    subprocess.run(["git", "-C", str(root), "apply", str(packet / "merge/patches/0001-ios.patch")], check=True, capture_output=True)
    assert {c.id: c.status for c in mergecheck.run(str(root)).checks}["merge.patch.0001"] == "pass"
    (packet / "VERSION").write_text("tampered\n")
    assert {c.id: c.status for c in mergecheck.run(str(root)).checks}["merge.manifest"] == "fail"
