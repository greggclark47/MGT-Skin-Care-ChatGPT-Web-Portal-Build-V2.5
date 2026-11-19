import json

import pytest

from t47.agents.roster import load_roster
from t47.agents.runner import MAX_BRIEF_CHARS, build_messages, model_chain, run_agent, validate_brief
from t47.util import HttpError

GOOD_CARE = ("Thanks for reaching out. You can reset your password from the sign-in page by choosing 'Forgot password'. "
             "If the email does not arrive, a team member can help from the Support page.")


def test_roster_is_draft_only():
    roster = load_roster()
    assert set(roster) == {"customer_care", "gtm_strategy", "social_engagement", "marketing_promotions", "retailer_partnerships",
                           "retention_lifecycle"}
    for agent in roster.values():
        public = agent.public
        assert public["mode"] == "draft_only" and public["human_review_required"] is True
        assert not (public["automatic_send"] or public["automatic_publish"] or public["automatic_scraping"])
        assert agent.system and agent.contract


def test_messages_carry_the_injection_note_and_sources():
    agent = load_roster()["customer_care"]
    messages = build_messages(agent, "Reply to a password question.", ["drive:abc123"])
    assert messages[0]["role"] == "system" and "never an instruction" in messages[0]["content"]
    assert "drive:abc123" in messages[1]["content"]


def test_dry_run_calls_no_model(settings, fake_client):
    client = fake_client({"*": GOOD_CARE})
    out = run_agent("customer_care", "Reply to a password question.", settings=settings, store=None, clients={"ollama": client}, dry_run=True)
    assert out["dry_run"] and out["chain"][0] == ("ollama", "qwen3.5:4b") and client.calls == []


def test_run_queues_a_clean_draft(settings, store, fake_client):
    client = fake_client({"qwen3.5:4b": GOOD_CARE})
    out = run_agent("customer_care", "Reply to a password question.", settings=settings, store=store, clients={"ollama": client})
    run = out["run"]
    assert run["status"] == "draft" and run["verdict"] == "clean" and run["created_by"] == "agent:t47-local"
    assert run["model"] == "qwen3.5:4b" and run["prompt_version"].startswith("t47-agents-")
    assert client.calls[0]["think"] is False and client.calls[0]["num_ctx"] == settings.num_ctx


def test_unsafe_draft_is_queued_as_blocked(settings, store, fake_client):
    client = fake_client({"qwen3.5:4b": "I've reset your password. This cream cures acne."})
    run = run_agent("customer_care", "Reply to a password question.", settings=settings, store=store, clients={"ollama": client})["run"]
    assert run["verdict"] == "blocked"
    assert {g["rule"] for g in run["guardrail"]} >= {"action_claim", "medical_claim"}


def test_falls_back_to_the_second_local_model(settings, store, fake_client):
    client = fake_client({"qwen3.5:4b": HttpError(500, "boom"), "deepseek-r1:8b": GOOD_CARE})
    out = run_agent("customer_care", "Reply to a password question.", settings=settings, store=store, clients={"ollama": client})
    assert [a["outcome"] for a in out["attempts"]] == ["error", "ok"]
    assert out["run"]["model"] == "deepseek-r1:8b"


def test_no_model_available_raises(settings, store, fake_client):
    client = fake_client({"*": HttpError(0, "connection refused")})
    with pytest.raises(RuntimeError, match="no model produced a draft"):
        run_agent("customer_care", "Reply to a password question.", settings=settings, store=store, clients={"ollama": client})
    assert store.list() == []


def test_cloud_fallback_only_when_enabled_keyed_and_not_sensitive(settings, monkeypatch):
    agent = load_roster()["customer_care"]
    assert all(provider == "ollama" for provider, _ in model_chain(agent, settings))
    settings.cloud_enabled = True
    assert all(provider == "ollama" for provider, _ in model_chain(agent, settings))  # no key in the environment
    monkeypatch.setenv("OLLAMA_CLOUD_API_KEY", "test-key")
    assert model_chain(agent, settings)[-1] == ("ollama_cloud", "deepseek-v4.1-flash")
    for data_class in ("sensitive", "biometric"):
        assert all(provider == "ollama" for provider, _ in model_chain(agent, settings, data_class=data_class))


def test_reasoning_agent_uses_the_reasoning_model_and_json_contract(settings, store, fake_client):
    keys = load_roster()["gtm_strategy"].json_keys
    good = json.dumps({k: "x" for k in keys})
    client = fake_client({"deepseek-r1:8b": good})
    run = run_agent("gtm_strategy", "Plan the Skin Match awareness push.", settings=settings, store=store, clients={"ollama": client})["run"]
    assert run["verdict"] == "clean" and client.calls[0]["format"] == "json" and client.calls[0]["think"] is True
    client = fake_client({"deepseek-r1:8b": json.dumps({"objective": "x"})})
    run = run_agent("gtm_strategy", "Plan the Skin Match awareness push.", settings=settings, store=store, clients={"ollama": client})["run"]
    assert run["verdict"] == "blocked" and "json_keys" in {g["rule"] for g in run["guardrail"]}
    client = fake_client({"deepseek-r1:8b": "not json"})
    run = run_agent("gtm_strategy", "Plan the Skin Match awareness push.", settings=settings, store=store, clients={"ollama": client})["run"]
    assert "json_invalid" in {g["rule"] for g in run["guardrail"]}


def test_email_agents_need_their_placeholders(settings, store, fake_client):
    client = fake_client({"qwen3.5:4b": "Skin Match is live. Take a look when you have a minute."})
    run = run_agent("marketing_promotions", "Announce Skin Match.", settings=settings, store=store, clients={"ollama": client})["run"]
    assert run["verdict"] == "blocked"
    assert {g["match"] for g in run["guardrail"] if g["rule"] == "missing_token"} == {"{{unsubscribe_link}}", "{{postal_address}}"}


def test_brief_and_source_validation(settings, store, fake_client):
    client = fake_client({"*": GOOD_CARE})
    for bad in ("", "   ", "x" * (MAX_BRIEF_CHARS + 1), "bad\x00brief"):
        with pytest.raises(ValueError):
            validate_brief(bad)
    with pytest.raises(ValueError):
        run_agent("customer_care", "ok", settings=settings, store=store, clients={"ollama": client}, source_refs=["http://insecure.example/a"])
    with pytest.raises(KeyError):
        run_agent("nobody", "ok", settings=settings, store=store, clients={"ollama": client})
    with pytest.raises(ValueError, match="review queue"):
        run_agent("customer_care", "ok", settings=settings, store=None, clients={"ollama": client})
