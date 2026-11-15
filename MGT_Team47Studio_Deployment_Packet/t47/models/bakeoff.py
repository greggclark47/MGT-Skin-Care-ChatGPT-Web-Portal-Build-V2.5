"""Model bake-off: the same synthetic cases against every model, scored by deterministic checks.

Output is a scorecard and, per candidate, PROPOSE or KEEP. Nothing here edits a route: the task registry in the
repository changes only after the owner approves a proposal and the staging regression passes.
"""
from __future__ import annotations

import json
import re
from statistics import median

from t47.agents.guardrails import scan
from t47.agents.roster import get_agent
from t47.agents.runner import build_messages, check_json_contract
from t47.config import Settings
from t47.models.ollama import ChatResult, OllamaClient
from t47.util import HttpError, load_data, now_iso, percentile

MIN_CASES = 12
ROUTER_SYSTEM = "You route operator requests to a drafting tool. Call the tool once with the right agent. Do not write the draft yourself."
ROUTER_TOOL = [{"type": "function", "function": {
    "name": "create_draft", "description": "Create a draft for human review with the named agent.",
    "parameters": {"type": "object", "required": ["agent_id", "brief"], "properties": {
        "agent_id": {"type": "string", "enum": ["customer_care", "gtm_strategy", "social_engagement", "marketing_promotions",
                                                "retailer_partnerships", "retention_lifecycle"]},
        "brief": {"type": "string"}}}}}]


def load_cases(path: str | None = None) -> list[dict]:
    if path:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)["cases"]
    return load_data("cases.json")["cases"]


def evaluate(case: dict, result: ChatResult) -> list[str]:
    """Return the list of failed checks for one model answer (empty means pass)."""
    failures: list[str] = []
    if case.get("kind") == "tool":
        expect = case["tool_expect"]
        calls = [c.get("function", {}) for c in result.tool_calls]
        hit = next((c for c in calls if c.get("name") == expect["name"]), None)
        if hit is None:
            return ["tool_not_called"]
        args = hit.get("arguments") or {}
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except ValueError:
                return ["tool_args_not_json"]
        return [f"tool_arg:{k}" for k, v in expect.get("args", {}).items() if args.get(k) != v]

    agent = get_agent(case["agent"])
    text = result.content
    profile = case.get("profile", agent.profile)
    for violation in scan(text, profile, brief=case["brief"], required_tokens=agent.required_tokens):
        if violation.severity == "block":
            failures.append(f"guardrail:{violation.rule}")
    failures += [f"contract:{v.rule}" for v in check_json_contract(agent, text)]
    patterns = case.get("must_match_any")
    if patterns and not any(re.search(p, text) for p in patterns):
        failures.append("missing_expected_content")
    failures += [f"forbidden:{p[:30]}" for p in case.get("must_not_match", []) if re.search(p, text)]
    if case.get("max_chars") and len(text) > case["max_chars"]:
        failures.append("too_long")
    return failures


def run_case(client: OllamaClient, model: str, case: dict, settings: Settings, think: bool | None) -> dict:
    row = {"model": model, "case": case["id"], "safety": bool(case.get("safety")), "passed": False, "failures": [],
           "ms": 0.0, "tokens_per_s": 0.0, "completion_tokens": 0, "thinking_chars": 0, "error": None}
    try:
        if case.get("kind") == "tool":
            messages = [{"role": "system", "content": ROUTER_SYSTEM}, {"role": "user", "content": case["brief"]}]
            result = client.chat(model, messages, temperature=0.0, num_predict=300, num_ctx=settings.num_ctx,
                                 keep_alive=settings.keep_alive, think=False, tools=ROUTER_TOOL)
        else:
            agent = get_agent(case["agent"])
            use_think = agent.think if think is None else think
            result = client.chat(model, build_messages(agent, case["brief"], case.get("sources", [])),
                                 temperature=agent.temperature, num_predict=agent.num_predict, num_ctx=settings.num_ctx,
                                 keep_alive=settings.keep_alive, think=use_think,
                                 format="json" if agent.format == "json" else None)
    except (HttpError, ValueError) as exc:
        row["error"] = str(exc)[:200]
        row["failures"] = ["error"]
        return row
    row["failures"] = evaluate(case, result)
    row["passed"] = not row["failures"]
    row.update(ms=result.total_ms, tokens_per_s=result.tokens_per_s, completion_tokens=result.completion_tokens,
               thinking_chars=len(result.thinking))
    return row


def summarize(rows: list[dict]) -> dict[str, dict]:
    summary: dict[str, dict] = {}
    for model in dict.fromkeys(r["model"] for r in rows):
        mine = [r for r in rows if r["model"] == model]
        timed = [r["ms"] for r in mine if not r["error"]]
        speeds = [r["tokens_per_s"] for r in mine if r["tokens_per_s"]]
        summary[model] = {
            "cases": len(mine), "passed": sum(r["passed"] for r in mine),
            "pass_rate": round(sum(r["passed"] for r in mine) / len(mine), 3) if mine else 0.0,
            "safety_failures": sum(1 for r in mine if r["safety"] and not r["passed"]),
            "errors": sum(1 for r in mine if r["error"]),
            "p50_ms": round(percentile(timed, 50), 1), "p95_ms": round(percentile(timed, 95), 1),
            "tokens_per_s": round(median(speeds), 1) if speeds else 0.0,
            "thinking_chars": sum(r["thinking_chars"] for r in mine),
            "failed_cases": [f"{r['case']} ({', '.join(r['failures'])})" for r in mine if not r["passed"]],
        }
    return summary


def decide(summary: dict[str, dict], incumbent: str, candidate: str, *, latency_budget_ms: float = 30_000) -> dict:
    """PROPOSE only when the candidate is safe, at least as good, inside the latency budget, and better somewhere."""
    inc, cand = summary[incumbent], summary[candidate]
    blockers: list[str] = []
    if cand["cases"] < MIN_CASES:
        blockers.append(f"only {cand['cases']} cases; at least {MIN_CASES} are required")
    if cand["errors"]:
        blockers.append(f"{cand['errors']} request error(s)")
    if cand["safety_failures"]:
        blockers.append(f"{cand['safety_failures']} safety case(s) failed")
    if cand["pass_rate"] < inc["pass_rate"]:
        blockers.append(f"pass rate {cand['pass_rate']:.0%} is below the incumbent's {inc['pass_rate']:.0%}")
    if cand["p95_ms"] > latency_budget_ms:
        blockers.append(f"p95 latency {cand['p95_ms']:.0f} ms is over the {latency_budget_ms:.0f} ms budget")
    better = (cand["pass_rate"] > inc["pass_rate"] or cand["safety_failures"] < inc["safety_failures"]
              or (cand["pass_rate"] == inc["pass_rate"] and inc["p50_ms"] and cand["p50_ms"] < inc["p50_ms"] * 0.9))
    if not blockers and not better:
        blockers.append("no measurable improvement over the incumbent")
    return {"incumbent": incumbent, "candidate": candidate, "decision": "KEEP" if blockers else "PROPOSE", "blockers": blockers,
            "note": "PROPOSE is a recommendation. The route changes only after owner approval and a passing staging regression."}


def run_bakeoff(models: list[str], *, client: OllamaClient, settings: Settings, cases: list[dict] | None = None,
                think: bool | None = None, incumbent: str | None = None, progress=None) -> dict:
    cases = cases if cases is not None else load_cases()
    rows: list[dict] = []
    for model in models:
        for case in cases:
            row = run_case(client, model, case, settings, think)
            rows.append(row)
            if progress:
                progress(row)
    summary = summarize(rows)
    incumbent = incumbent or models[0]
    decisions = [decide(summary, incumbent, m) for m in models if m != incumbent]
    return {"generated_at": now_iso(), "endpoint": client.base_url, "num_ctx": settings.num_ctx, "think": think,
            "case_count": len(cases), "incumbent": incumbent, "summary": summary, "decisions": decisions, "rows": rows}


def render_markdown(report: dict) -> str:
    lines = ["# Model bake-off", "", f"Generated: {report['generated_at']}  ", f"Endpoint: `{report['endpoint']}`  ",
             f"Cases: {report['case_count']} synthetic, context {report['num_ctx']} tokens  ", "",
             "| Model | Pass | Safety failures | Errors | p50 ms | p95 ms | tok/s | Thinking chars |", "|---|---|---|---|---|---|---|---|"]
    for model, s in report["summary"].items():
        lines.append(f"| `{model}` | {s['passed']}/{s['cases']} ({s['pass_rate']:.0%}) | {s['safety_failures']} | {s['errors']} | "
                     f"{s['p50_ms']:.0f} | {s['p95_ms']:.0f} | {s['tokens_per_s']} | {s['thinking_chars']} |")
    lines += ["", "## Decisions", ""]
    if not report["decisions"]:
        lines.append("Only one model was run, so there is nothing to compare.")
    for d in report["decisions"]:
        reason = "; ".join(d["blockers"]) if d["blockers"] else "safe, at least as good, inside the latency budget, and better on one measure"
        lines.append(f"- `{d['candidate']}` against `{d['incumbent']}`: **{d['decision']}**. {reason}.")
    lines += ["", "## Failed cases", ""]
    for model, s in report["summary"].items():
        lines.append(f"- `{model}`: " + ("; ".join(s["failed_cases"]) if s["failed_cases"] else "none"))
    lines += ["", "A PROPOSE result is a recommendation only. The task registry changes after owner approval and a passing staging regression."]
    return "\n".join(lines) + "\n"
