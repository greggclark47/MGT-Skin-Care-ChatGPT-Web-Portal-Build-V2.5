"""Static inventory of the Team 47 Studio monorepo. Reads files only; runs no build and no network."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

from t47.diagnostics.checks import Report

AGENT_RE = re.compile(
    r"(\w+):\{name:'([^']*)',requested_model:'([^']*)',task:(null|'[^']*')(?: as TaskType)?,channel:'([^']*)',"
    r"external_action:'([^']*)'(?:,blocked_reason:'([^']*)')?\}")
MODEL_RE = re.compile(r"const (\w+)\s*=\s*\{\s*provider:\s*'([^']+)' as const,\s*model:\s*'([^']+)'")
# Hosted models the repository's own documents record as deprecated or scheduled for removal.
DEPRECATED = {"gpt-4o": "blocked in agent-operations.ts (requested_model_deprecated)",
              "gpt-5": "removal listed for 2026-12-11 in LOCAL-AI-SUPABASE-ACTIVATION-2026-11-06.md"}
KEY_FILES = {
    "tracker": "docs/PROJECT-TODO-2026-11-14.md",
    "preflight": "infra/portal/preflight.mjs",
    "production_gate": "infra/portal/production-gate.mjs",
    "secret_scan": "infra/portal/tracked-secret-scan.mjs",
    "backup_policy": "infra/portal/GOOGLE-DRIVE-ENCRYPTED-BACKUP.md",
    "agent_operations": "apps/api/src/portal/agent-operations.ts",
    "task_registry": "packages/ai-gateway/src/task-registry.ts",
    "env_example": "infra/portal/env.example",
    "ai_broker": "services/ai-broker/app/main.py",
    "mobile_app_config": "apps/mobile/app.json",
    "mobile_eas": "apps/mobile/eas.json",
    "play_data_safety_draft": "apps/mobile/PLAY-DATA-SAFETY-DRAFT.md",
}


def _git(root: Path, *args: str) -> str | None:
    try:
        out = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True, timeout=20)
        return out.stdout.strip() if out.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        return None


def parse_agents(source: str) -> list[dict]:
    return [{"id": m[0], "name": m[1], "requested_model": m[2], "task": None if m[3] == "null" else m[3].strip("'"),
             "channel": m[4], "external_action": m[5], "blocked_reason": m[6] or None} for m in AGENT_RE.findall(source)]


def parse_models(source: str) -> list[dict]:
    return [{"const": c, "provider": p, "model": m} for c, p, m in MODEL_RE.findall(source)]


def parse_env(source: str) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in source.splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            if re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
                env[key] = value
    return env


def is_mutable_tag(model: str) -> bool:
    return ":" not in model or model.endswith(":latest")


def run(repo: str, *, visibility: str = "unknown") -> Report:
    root = Path(repo)
    report = Report("Repository inventory", str(root))
    if not root.is_dir():
        report.add("repo.exists", "Repository checkout found", "fail", f"not a directory: {root}")
        return report

    head, branch = _git(root, "rev-parse", "HEAD"), _git(root, "rev-parse", "--abbrev-ref", "HEAD")
    tracked = _git(root, "ls-files")
    report.add("repo.head", "Candidate commit", "info" if head else "skipped", f"{(head or 'git unavailable')[:12]} on {branch or '?'}",
               head=head, branch=branch, tracked_files=len(tracked.splitlines()) if tracked else None)

    missing = [name for name, rel in KEY_FILES.items() if not (root / rel).is_file()]
    report.add("repo.key_files", "Key release and AI files present", "pass" if not missing else "warn",
               "all present" if not missing else "missing: " + ", ".join(missing), checked=len(KEY_FILES))

    package = root / "package.json"
    if package.is_file():
        scripts = json.loads(package.read_text(encoding="utf-8")).get("scripts", {})
        gates = [s for s in scripts if s.startswith("infra:")]
        report.add("repo.gate_scripts", "Release gate scripts", "info",
                   f"{len(gates)} infra:* scripts; `t47 release status` gives one view over them", count=len(gates))

    agents_file, registry_file, env_file = (root / KEY_FILES[k] for k in ("agent_operations", "task_registry", "env_example"))
    agents = parse_agents(agents_file.read_text(encoding="utf-8")) if agents_file.is_file() else []
    models = parse_models(registry_file.read_text(encoding="utf-8")) if registry_file.is_file() else []
    env = parse_env(env_file.read_text(encoding="utf-8")) if env_file.is_file() else {}
    registry_models = {m["model"] for m in models}

    report.add("ai.agents", "Agent roster", "info" if agents else "warn",
               ", ".join(f"{a['id']}={a['requested_model']}" for a in agents) or "no agents parsed", agents=agents)
    blocked = [a for a in agents if a["blocked_reason"]]
    report.add("ai.agents.blocked", "Blocked agents", "warn" if blocked else "pass",
               "; ".join(f"{a['id']} ({a['blocked_reason']}, model {a['requested_model']})" for a in blocked) or "none")
    outside = [a["id"] for a in agents if not a["blocked_reason"] and a["requested_model"] not in registry_models]
    report.add("ai.agents.models", "Agent models exist in the task registry", "pass" if not outside else "warn",
               "consistent" if not outside else "not in registry: " + ", ".join(outside))

    report.add("ai.registry", "Task registry models", "info" if models else "warn",
               ", ".join(sorted({f"{m['provider']}:{m['model']}" for m in models})) or "none parsed", models=models)
    mutable = sorted({m["model"] for m in models if m["provider"] == "ollama" and is_mutable_tag(m["model"])})
    report.add("ai.registry.mutable", "Local model tags are pinned", "warn" if mutable else "pass",
               ("unpinned or :latest: " + ", ".join(mutable)) if mutable else "all pinned",
               note="infra/gcp/phase3-ai rejects mutable :latest tags at plan time")
    deprecated = sorted({m["model"] for m in models if m["model"] in DEPRECATED} | {a["requested_model"] for a in agents if a["requested_model"] in DEPRECATED})
    report.add("ai.registry.deprecated", "No deprecated hosted models referenced", "warn" if deprecated else "pass",
               "; ".join(f"{m}: {DEPRECATED[m]}" for m in deprecated) or "none")

    expected = {"OLLAMA_MODEL_PRIMARY": "DEEPSEEK_LOCAL", "OLLAMA_MODEL_SECONDARY": "QWEN_LOCAL", "OLLAMA_MODEL_EMBEDDING": "OLLAMA_EMBED"}
    by_const = {m["const"]: m["model"] for m in models}
    drift = [f"{key}={env[key]} vs registry {by_const[const]}" for key, const in expected.items()
             if key in env and const in by_const and env[key] != by_const[const]]
    report.add("ai.env.drift", "env.example matches the task registry", "pass" if not drift else "warn", "; ".join(drift) or "consistent")
    switches = {k: env.get(k) for k in ("OPENCLAW_ENABLED", "OLLAMA_CLOUD_ENABLED", "HOSTED_OPENAI_ENABLED") if k in env}
    off = all(v == "false" for v in switches.values())
    report.add("ai.env.defaults", "Hosted and OpenClaw routes default to off", "pass" if off else "warn", json.dumps(switches))

    mobile_pkg = root / "apps/mobile/package.json"
    if mobile_pkg.is_file():
        pkg = json.loads(mobile_pkg.read_text(encoding="utf-8"))
        deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
        scripts = pkg.get("scripts", {})
        report.add("mobile.toolchain", "Mobile toolchain", "info",
                   f"expo {deps.get('expo', '?')}, react-native {deps.get('react-native', '?')}", scripts=sorted(scripts))
        has_ios = any("ios" in name for name in scripts)
        report.add("mobile.ios_scripts", "iOS build and submit scripts", "pass" if has_ios else "warn",
                   "present" if has_ios else "none defined: only Android preview, production and internal-submit scripts exist")
    app_json = root / KEY_FILES["mobile_app_config"]
    if app_json.is_file():
        expo = json.loads(app_json.read_text(encoding="utf-8")).get("expo", {})
        ids = {"ios": expo.get("ios", {}).get("bundleIdentifier"), "android": expo.get("android", {}).get("package")}
        report.add("mobile.ids", "Store identifiers declared", "pass" if all(ids.values()) else "warn", json.dumps(ids), **ids)

    internal = []
    for path in list(root.glob("business/*.md")) + list(root.glob("docs/**/*.md")):
        try:
            head_text = path.read_text(encoding="utf-8", errors="replace")[:400]
        except OSError:
            continue
        if re.search(r"INTERNAL ONLY|DO NOT PUBLISH", head_text, re.I):
            internal.append(str(path.relative_to(root)))
    status = "pass" if not internal else ("fail" if visibility == "public" else "warn")
    report.add("repo.internal_docs", "Internal-only documents in the repository", status,
               (f"{len(internal)} file(s) marked internal in a {visibility} repository: " + ", ".join(internal)) if internal else "none",
               files=internal, visibility=visibility)

    workflows = sorted(p.name for p in (root / ".github/workflows").glob("*.yml")) if (root / ".github/workflows").is_dir() else []
    report.add("repo.ci", "CI workflows", "info" if workflows else "warn", ", ".join(workflows) or "none found")
    return report
