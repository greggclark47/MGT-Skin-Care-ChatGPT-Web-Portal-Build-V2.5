import json
import subprocess

from t47.config import Settings
from t47.diagnostics import local_ai, repo, site
from t47.diagnostics.checks import Check, Report

import pytest

from conftest import make_fetch

HOME = """<!doctype html><html><head><title>Team 47 Studio — Care, color and style, connected.</title>
<meta name="description" content="Personal care, color and style guidance.">
<meta name="author" content="Someone Named">
<link rel="canonical" href="https://team47studio.com/"></head>
<body><h1>Your care, with a clearer next step.</h1><footer>Cosmetic guidance, not diagnosis or medical treatment.</footer></body></html>"""
HEADERS = {"Strict-Transport-Security": "max-age=31536000", "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'",
           "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin"}


def statuses(report):
    return {c.id: c.status for c in report.checks}


def healthy_routes():
    routes = {"https://team47studio.com/": (200, HOME, HEADERS),
              "https://www.team47studio.com/": (301, "", {"Location": "https://team47studio.com/"}),
              "/healthz": (200, "ok"), "/readyz": (503, '{"ready":false}'), "/api/hub/session": (200, "{}"),
              "/robots.txt": (200, "User-agent: *"), "/sitemap.xml": (200, "<urlset/>")}
    routes.update({path: (200, "<html></html>") for path in site.POLICY_PATHS})
    return routes


# ---- report container ----

def test_report_counts_and_markdown():
    report = Report("Demo", "target")
    report.add("a", "First", "pass", "fine")
    report.add("b", "Second | piped", "warn", "line one\nline two")
    assert report.ok and report.counts["warn"] == 1
    report.add("c", "Third", "fail", "broken")
    assert not report.ok and report.to_dict()["counts"]["fail"] == 1
    text = report.to_markdown()
    assert "| FAIL | Third | broken |" in text and "line one line two" in text
    with pytest.raises(ValueError):
        Check("x", "y", "maybe")


# ---- site ----

def test_site_healthy_with_readiness_fail_closed():
    fetch = make_fetch(healthy_routes())
    report = site.run("https://team47studio.com", "https://www.team47studio.com", fetch=fetch, tls_days=lambda host: 64.0)
    got = statuses(report)
    assert report.ok and got["site.home"] == "pass" and got["site.www"] == "pass" and got["site.tls"] == "pass"
    assert got["site.probe.readyz"] == "info"          # 503 is the intended state while backup and catalog gates are open
    assert got["site.probe.healthz"] == "pass" and got["site.disclaimer"] == "pass" and got["site.header.framing"] == "pass"
    assert got["site.meta.author"] == "info"
    assert "Someone Named" not in json.dumps(report.to_dict())  # the name itself is not copied into the report
    assert {method for method, _, _ in fetch.seen} == {"GET"}  # read-only


def test_site_problems_are_reported():
    routes = healthy_routes()
    routes["https://team47studio.com/"] = (200, "<html><head></head><body>hello</body></html>", {})
    routes["https://www.team47studio.com/"] = (200, "served twice", {})
    routes["/healthz"] = (500, "down")
    del routes["/privacy"]

    def expired(host):
        return -2.0

    got = statuses(site.run("https://team47studio.com", "https://www.team47studio.com", fetch=make_fetch(routes), tls_days=expired))
    assert got["site.title"] == "warn" and got["site.disclaimer"] == "warn" and got["site.header.strict-transport-security"] == "warn"
    assert got["site.www"] == "warn" and got["site.probe.healthz"] == "fail" and got["site.page.privacy"] == "warn" and got["site.tls"] == "fail"


def test_site_unreachable_stops_early_and_tls_errors_are_skipped():
    def dead(url, **kw):
        from t47.util import HttpResponse
        return HttpResponse(url, 0, {}, b"", 3.0, error="URLError: no route")

    report = site.run("https://team47studio.com", "https://www.team47studio.com", fetch=dead)
    assert statuses(report) == {"site.reach": "fail"} and report.notes

    def boom(host):
        raise OSError("blocked")

    got = statuses(site.run("https://team47studio.com", "https://www.team47studio.com", fetch=make_fetch(healthy_routes()), tls_days=boom))
    assert got["site.tls"] == "skipped"


# ---- repository ----

AGENTS_TS = """const AGENTS = {
customer_care:{name:'Account Setup & Customer Care',requested_model:'qwen3.5:4b',task:'support_draft' as TaskType,channel:'portal',external_action:'none'},
gtm_strategy:{name:'Go-to-Market Strategy',requested_model:'gpt-4o',task:null,channel:'internal_brief',external_action:'none',blocked_reason:'requested_model_deprecated'},
};"""
REGISTRY_TS = """const DEEPSEEK_LOCAL = { provider: 'ollama' as const, model: 'deepseek-r1:8b', max_tokens: 1600 };
const QWEN_LOCAL = { provider: 'ollama' as const, model: 'qwen3.5:4b' };
const OLLAMA_VISION = { provider: 'ollama' as const, model: 'llava:latest' };
const OLLAMA_EMBED = { provider: 'ollama' as const, model: 'nomic-embed-text' };
const OPENAI_GPT5_FALLBACK = { provider: 'openai' as const, model: 'gpt-5' };"""


def write(root, rel, text):
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def fixture_repo(root, *, ios=False, internal=True):
    write(root, "package.json", json.dumps({"scripts": {"infra:preflight": "x", "infra:gate": "x", "lint": "x"}}))
    write(root, "apps/api/src/portal/agent-operations.ts", AGENTS_TS)
    write(root, "packages/ai-gateway/src/task-registry.ts", REGISTRY_TS)
    write(root, "infra/portal/env.example", "# AI\nOLLAMA_MODEL_PRIMARY=deepseek-r1:8b\nOLLAMA_MODEL_SECONDARY=qwen3:4b\n"
                                             "OPENCLAW_ENABLED=false\nOLLAMA_CLOUD_ENABLED=false\nHOSTED_OPENAI_ENABLED=false\nlower=skip\n")
    scripts = {"android:preview": "x", "android:production": "x", **({"ios:production": "x"} if ios else {})}
    write(root, "apps/mobile/package.json", json.dumps({"dependencies": {"expo": "~58.0.25", "react-native": "0.88.1"}, "scripts": scripts}))
    write(root, "apps/mobile/app.json", json.dumps({"expo": {"ios": {"bundleIdentifier": "com.team47studio.app"},
                                                             "android": {"package": "com.team47studio.app"}}}))
    write(root, "business/OPERATING-MODEL.md", "# Operating model\n\nPublic-safe notes.\n")
    if internal:
        write(root, "business/INTERNAL-ECONOMICS.md", "# Economics\n\nINTERNAL ONLY. Do not publish or serve.\n")
    write(root, ".github/workflows/verification.yml", "name: verification\n")
    return root


def test_repo_inventory_finds_the_known_issues(tmp_path):
    report = repo.run(str(fixture_repo(tmp_path)), visibility="public")
    got = statuses(report)
    details = {c.id: c.detail for c in report.checks}
    assert got["ai.agents.blocked"] == "warn" and "gtm_strategy" in details["ai.agents.blocked"]
    assert got["ai.registry.mutable"] == "warn" and "llava:latest" in details["ai.registry.mutable"] and "nomic-embed-text" in details["ai.registry.mutable"]
    assert got["ai.registry.deprecated"] == "warn" and "gpt-4o" in details["ai.registry.deprecated"] and "gpt-5" in details["ai.registry.deprecated"]
    assert got["ai.env.drift"] == "warn" and "qwen3:4b" in details["ai.env.drift"]
    assert got["ai.env.defaults"] == "pass" and got["ai.agents.models"] == "pass"
    assert got["mobile.ios_scripts"] == "warn" and got["mobile.ids"] == "pass"
    assert got["repo.internal_docs"] == "fail" and "INTERNAL-ECONOMICS.md" in details["repo.internal_docs"]
    assert got["repo.key_files"] == "warn" and got["repo.ci"] == "info" and got["repo.gate_scripts"] == "info"
    assert not report.ok


def test_repo_inventory_visibility_and_clean_cases(tmp_path):
    private = statuses(repo.run(str(fixture_repo(tmp_path / "a")), visibility="private"))
    assert private["repo.internal_docs"] == "warn"
    clean = statuses(repo.run(str(fixture_repo(tmp_path / "b", ios=True, internal=False)), visibility="public"))
    assert clean["repo.internal_docs"] == "pass" and clean["mobile.ios_scripts"] == "pass"
    assert statuses(repo.run(str(tmp_path / "absent"))) == {"repo.exists": "fail"}


def test_repo_inventory_reads_git_head_when_available(tmp_path):
    root = fixture_repo(tmp_path)
    try:
        subprocess.run(["git", "init", "-q", str(root)], check=True, capture_output=True)
        subprocess.run(["git", "-C", str(root), "add", "-A"], check=True, capture_output=True)
        subprocess.run(["git", "-C", str(root), "-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "-m", "fixture"],
                       check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError):
        pytest.skip("git is not available")
    head = next(c for c in repo.run(str(root)).checks if c.id == "repo.head")
    assert head.status == "info" and len(head.evidence["head"]) == 40 and head.evidence["tracked_files"] >= 8


def test_parsers():
    agents = repo.parse_agents(AGENTS_TS)
    assert [a["id"] for a in agents] == ["customer_care", "gtm_strategy"] and agents[0]["task"] == "support_draft" and agents[1]["task"] is None
    assert agents[1]["blocked_reason"] == "requested_model_deprecated"
    assert {m["const"]: m["model"] for m in repo.parse_models(REGISTRY_TS)}["QWEN_LOCAL"] == "qwen3.5:4b"
    assert repo.parse_env("A=1\n# c\nbad line\nB_2=x=y\n") == {"A": "1", "B_2": "x=y"}
    assert repo.is_mutable_tag("llava:latest") and repo.is_mutable_tag("nomic-embed-text") and not repo.is_mutable_tag("qwen3.5:4b")


# ---- local AI plane ----

def ollama_routes(**override):
    routes = {"/api/version": (200, {"version": "0.40.11"}),
              "/api/tags": (200, {"models": [{"name": "qwen3.5:4b", "size": 3_320_000_000}, {"name": "deepseek-r1:8b", "size": 5_230_000_000},
                                             {"name": "nomic-embed-text:latest", "size": 270_000_000}]}),
              "/api/ps": (200, {"models": [{"name": "qwen3.5:4b", "size": 3_400_000_000, "size_vram": 3_400_000_000}]})}
    routes.update(override)
    return routes


def no_tools(cmd):
    return None


def test_local_ai_healthy(tmp_path):
    report = local_ai.run(Settings(), fetch=make_fetch(ollama_routes()), runner=no_tools, openclaw_home=str(tmp_path))
    got = statuses(report)
    assert report.ok and got["ollama.loopback"] == "pass" and got["ollama.up"] == "pass"
    assert got["ollama.role.drafting"] == "pass" and got["ollama.role.embedding"] == "pass"  # untagged name matches an installed tag
    assert got["ollama.vram"] == "pass" and got["ollama.loaded"] == "pass"
    assert got["gpu"] == "skipped" and got["openclaw.cli"] == "skipped" and got["openclaw.config"] == "skipped"


def test_local_ai_flags_missing_models_cpu_offload_and_exposure(tmp_path):
    routes = ollama_routes(**{"/api/ps": (200, {"models": [{"name": "big:27b", "size": 18_000_000_000, "size_vram": 12_000_000_000}]})})
    settings = Settings(ollama_base_url="http://192.168.1.50:11434", models={"drafting": "gemma4:12b", "reasoning": "deepseek-r1:8b",
                                                                               "embedding": "nomic-embed-text"})
    got = statuses(local_ai.run(settings, fetch=make_fetch(routes), runner=no_tools, openclaw_home=str(tmp_path)))
    assert got["ollama.loopback"] == "fail" and got["ollama.role.drafting"] == "fail" and got["ollama.loaded"] == "warn"


def test_local_ai_down_and_openclaw_config_audited(tmp_path):
    (tmp_path / "openclaw.json").write_text("{ tools: { elevated: { enabled: true } } }", encoding="utf-8")

    def tools(cmd):
        return {"nvidia-smi": "NVIDIA GeForce RTX 5080, 16303 MiB, 4096 MiB, 581.15", "openclaw": "openclaw 2026.11.2"}.get(cmd[0])

    report = local_ai.run(Settings(), fetch=make_fetch({}), runner=tools, openclaw_home=str(tmp_path))
    got = statuses(report)
    assert got["ollama.up"] == "fail" and "ollama.models" not in got and report.notes
    assert got["gpu"] == "info" and got["openclaw.cli"] == "info" and got["claw.elevated"] == "fail"
