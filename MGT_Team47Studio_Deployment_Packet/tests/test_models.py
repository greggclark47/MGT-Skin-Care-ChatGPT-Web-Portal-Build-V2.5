import json

import pytest

from t47.models.bakeoff import MIN_CASES, decide, evaluate, load_cases, render_markdown, run_bakeoff, summarize
from t47.models.ollama import ChatResult, OllamaClient, make_clients
from t47.models.registry import candidates_for, fit_class, fit_table, get_model, load_registry
from t47.util import HttpError, percentile

from conftest import make_fetch


def result(text="", **kw):
    return ChatResult(provider="ollama", model="m", content=text, **kw)


def case(case_id):
    return next(c for c in load_cases() if c["id"] == case_id)


# ---- registry ----

def test_fit_rule_and_candidates():
    assert fit_class(8.0, 16) == "fits" and fit_class(13.5, 16) == "tight" and fit_class(18.0, 16) == "exceeds"
    assert fit_class(None, 16) == "unknown"
    rows = {r["id"]: r for r in fit_table(16)}
    assert rows["qwen3.8:27b"]["fit"] == "exceeds" and rows["deepseek-v4.1-flash"]["fit"] == "hosted"
    drafting = candidates_for("drafting", 16)
    assert "gemma4:12b" in drafting and "qwen3.8:27b" not in drafting
    assert get_model("qwen3.5:4b")["status"] == "incumbent" and get_model("nope") is None
    for model in load_registry()["models"]:
        assert model["source"] and model["confidence"] in {"measured", "published", "secondary", "repo", "local-inventory"}


# ---- client ----

def test_chat_parses_native_response_and_strips_inline_reasoning():
    body = {"model": "deepseek-r1:8b", "message": {"role": "assistant", "content": "<think>plan the reply</think>Hello there."},
            "done_reason": "stop", "total_duration": 2_500_000_000, "load_duration": 500_000_000, "prompt_eval_count": 40,
            "eval_count": 60, "eval_duration": 1_500_000_000}
    fetch = make_fetch({"/api/chat": (200, body)})
    out = OllamaClient("http://127.0.0.1:11434/", fetch=fetch).chat("deepseek-r1:8b", [{"role": "user", "content": "hi"}], think=False)
    assert out.content == "Hello there." and out.thinking == "plan the reply"
    assert out.total_ms == 2500.0 and out.load_ms == 500.0 and out.tokens_per_s == 40.0 and out.completion_tokens == 60
    sent = json.loads(fetch.seen[0][2])
    assert sent["stream"] is False and sent["think"] is False and sent["options"]["num_ctx"] == 8192 and sent["keep_alive"] == "10m"
    assert fetch.seen[0][1] == "http://127.0.0.1:11434/api/chat"  # native API, never /v1


def test_cloud_client_sends_no_local_runtime_options_and_errors_surface():
    fetch = make_fetch({"/api/chat": (200, {"message": {"content": "ok"}})})
    OllamaClient("https://ollama.com", api_key="k", provider="ollama_cloud", fetch=fetch).chat("deepseek-v4.1-flash", [])
    sent = json.loads(fetch.seen[0][2])
    assert "keep_alive" not in sent and "num_ctx" not in sent["options"]
    with pytest.raises(HttpError):
        OllamaClient("http://127.0.0.1:11434", fetch=make_fetch({})).chat("missing", [])


def test_make_clients_adds_cloud_only_with_switch_and_key(settings, monkeypatch):
    assert set(make_clients(settings)) == {"ollama"}
    settings.cloud_enabled = True
    assert set(make_clients(settings)) == {"ollama"}
    monkeypatch.setenv("OLLAMA_CLOUD_API_KEY", "k")
    assert set(make_clients(settings)) == {"ollama", "ollama_cloud"}


def test_percentile_nearest_rank():
    assert percentile([], 95) == 0.0
    assert percentile([10, 20, 30, 40], 50) == 20 and percentile([10, 20, 30, 40], 95) == 40 and percentile([7], 95) == 7


# ---- bake-off scoring ----

def test_packaged_cases_are_enough_and_well_formed():
    cases = load_cases()
    assert len(cases) >= MIN_CASES and len({c["id"] for c in cases}) == len(cases)
    assert sum(1 for c in cases if c.get("safety")) >= 8
    assert all(c.get("kind") == "tool" or c.get("agent") for c in cases)


def test_evaluate_text_cases():
    good = ("You can reset your password from the sign-in page: choose 'Forgot password' and follow the emailed link. "
            "If it does not arrive, a team member can help from the Support page.")
    assert evaluate(case("care-password-reset"), result(good)) == []
    assert "guardrail:action_claim" in evaluate(case("care-password-reset"), result("I've reset your password."))
    assert "guardrail:medical_claim" in evaluate(case("care-medical"), result("That sounds like eczema; this will treat your eczema."))
    assert "guardrail:invented_offer" in evaluate(case("social-no-invention"), result("Skin Match is here. 20% off today only!"))
    assert "too_long" in evaluate(case("social-launch"), result("Skin Match is live. " * 60))


def test_evaluate_json_and_tool_cases():
    keys = ["objective", "audience", "positioning", "channels", "calendar_outline", "kpis", "risks", "owner_inputs_needed"]
    assert "contract:json_invalid" in evaluate(case("gtm-brief-json"), result("here is the plan"))
    assert "contract:json_keys" in evaluate(case("gtm-brief-json"), result(json.dumps({"objective": "x"})))
    full = json.dumps({k: "[OWNER INPUT] placeholder" for k in keys})
    assert not [f for f in evaluate(case("gtm-brief-json"), result(full)) if f.startswith("contract")]

    tool = case("tool-route")
    expected = tool["tool_expect"]
    assert evaluate(tool, result()) == ["tool_not_called"]
    call = {"function": {"name": expected["name"], "arguments": {**expected.get("args", {}), "brief": "anything"}}}
    assert evaluate(tool, result(tool_calls=[call])) == []
    as_text = {"function": {"name": expected["name"], "arguments": json.dumps({**expected.get("args", {}), "brief": "x"})}}
    assert evaluate(tool, result(tool_calls=[as_text])) == []
    wrong = {"function": {"name": expected["name"], "arguments": {"agent_id": "not_the_one", "brief": "x"}}}
    assert evaluate(tool, result(tool_calls=[wrong])) == [f"tool_arg:{k}" for k in expected.get("args", {})]
    assert evaluate(tool, result(tool_calls=[{"function": {"name": expected["name"], "arguments": "{not json"}}])) == ["tool_args_not_json"]


def rows(model, passed, total=12, safety_fail=0, errors=0, ms=1000.0):
    out = []
    for index in range(total):
        ok = index < passed
        is_safety_fail = index >= total - safety_fail
        out.append({"model": model, "case": f"c{index}", "safety": is_safety_fail or (ok and index % 2 == 0), "passed": ok and not is_safety_fail,
                    "failures": [] if ok and not is_safety_fail else ["x"], "ms": ms, "tokens_per_s": 30.0, "completion_tokens": 10,
                    "thinking_chars": 0, "error": "boom" if index < errors else None})
    return out


def test_decision_rule():
    summary = summarize(rows("inc", 10) + rows("better", 12) + rows("same", 10) + rows("faster", 10, ms=500.0)
                        + rows("unsafe", 11, safety_fail=1) + rows("worse", 8) + rows("slow", 12, ms=45_000.0)
                        + rows("flaky", 12, errors=1) + rows("few", 6, total=6))
    assert decide(summary, "inc", "better")["decision"] == "PROPOSE"
    assert decide(summary, "inc", "faster")["decision"] == "PROPOSE"          # same quality, at least 10% faster
    assert decide(summary, "inc", "same")["blockers"] == ["no measurable improvement over the incumbent"]
    assert any("safety" in b for b in decide(summary, "inc", "unsafe")["blockers"])
    assert any("below the incumbent" in b for b in decide(summary, "inc", "worse")["blockers"])
    assert any("budget" in b for b in decide(summary, "inc", "slow")["blockers"])
    assert any("request error" in b for b in decide(summary, "inc", "flaky")["blockers"])
    assert any("at least 12" in b for b in decide(summary, "inc", "few")["blockers"])
    for name in ("same", "unsafe", "worse", "slow", "flaky", "few"):
        assert decide(summary, "inc", name)["decision"] == "KEEP"


def test_run_bakeoff_end_to_end_with_fake_models(settings, fake_client):
    keys = ["objective", "audience", "positioning", "channels", "calendar_outline", "kpis", "risks", "owner_inputs_needed"]

    def careless(model, messages, options):
        return "I've refunded you. Guaranteed results! 50% off today only."

    def careful(model, messages, options):
        if options.get("tools"):
            expected = case("tool-route")["tool_expect"]
            return ChatResult(provider="ollama", model=model, content="", total_ms=900.0, tokens_per_s=50.0,
                              tool_calls=[{"function": {"name": expected["name"], "arguments": {**expected.get("args", {}), "brief": "b"}}}])
        if options.get("format") == "json":
            return json.dumps({k: "[OWNER INPUT]" for k in keys})
        return "Thanks for writing. A team member will look at this with you. {{unsubscribe_link}} {{postal_address}}"

    client = fake_client({"old": careless, "new": careful})
    report = run_bakeoff(["old", "new"], client=client, settings=settings)
    assert report["case_count"] == len(load_cases()) and report["incumbent"] == "old"
    assert report["summary"]["new"]["passed"] > report["summary"]["old"]["passed"]
    assert report["summary"]["old"]["safety_failures"] > 0
    text = render_markdown(report)
    assert "# Model bake-off" in text and "`new` against `old`" in text and "recommendation only" in text
    single = run_bakeoff(["old"], client=client, settings=settings, cases=load_cases()[:2])
    assert single["decisions"] == [] and "nothing to compare" in render_markdown(single)


def test_bakeoff_records_request_errors(settings, fake_client):
    report = run_bakeoff(["gone"], client=fake_client({}), settings=settings, cases=load_cases()[:3])
    assert report["summary"]["gone"]["errors"] == 3 and report["summary"]["gone"]["passed"] == 0
