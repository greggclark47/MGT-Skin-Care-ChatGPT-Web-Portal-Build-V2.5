"""Static audit of an OpenClaw config file against the Team 47 Studio agent policy.

Schema-tolerant on purpose: a key that is absent is reported as not set, never guessed. Secret values are never
printed; only the path of a key that appears to hold one. This complements, and does not replace, OpenClaw's own
`openclaw doctor` and security audit.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from t47.config import LOOPBACK_HOSTS
from t47.diagnostics.checks import Report

RECOMMENDED_DENY = ("exec", "browser")
SECRET_HINT = re.compile(r"(token|apikey|api_key|secret|password)", re.I)
MISSING = object()


def parse_json5(text: str) -> Any:
    """Parse the JSON5 subset OpenClaw configs use: comments, bare keys, single quotes, trailing commas."""
    out: list[str] = []
    i, n = 0, len(text)

    def last_significant() -> int:
        j = len(out) - 1
        while j >= 0 and out[j].strip() == "":
            j -= 1
        return j

    while i < n:
        ch = text[i]
        if text.startswith("//", i):
            end = text.find("\n", i)
            i = n if end == -1 else end
        elif text.startswith("/*", i):
            end = text.find("*/", i + 2)
            i = n if end == -1 else end + 2
        elif ch in "\"'":
            j, buf = i + 1, []
            while j < n and text[j] != ch:
                if text[j] == "\\" and j + 1 < n:
                    buf.append("'" if text[j + 1] == "'" else text[j:j + 2])
                    j += 2
                else:
                    buf.append('\\"' if text[j] == '"' else text[j])
                    j += 1
            out.append('"' + "".join(buf) + '"')
            i = j + 1
        elif ch.isalpha() or ch in "_$":
            j = i
            while j < n and (text[j].isalnum() or text[j] in "_$-"):
                j += 1
            word, k = text[i:j], j
            while k < n and text[k] in " \t\r\n":
                k += 1
            out.append(f'"{word}"' if k < n and text[k] == ":" else word)
            i = j
        elif ch in "}]":
            j = last_significant()
            if j >= 0 and out[j] == ",":
                out.pop(j)
            out.append(ch)
            i += 1
        else:
            out.append(ch)
            i += 1
    return json.loads("".join(out))


def dig(obj: Any, path: str) -> Any:
    for part in path.split("."):
        if not isinstance(obj, dict) or part not in obj:
            return MISSING
        obj = obj[part]
    return obj


def _secret_paths(obj: Any, path: str = "") -> list[str]:
    hits: list[str] = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            here = f"{path}.{key}" if path else str(key)
            if isinstance(value, str) and SECRET_HINT.search(str(key)):
                literal = len(value) >= 20 and not value.startswith("${") and not re.fullmatch(r"[A-Z][A-Z0-9_]*", value)
                if literal:
                    hits.append(here)
            else:
                hits += _secret_paths(value, here)
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            hits += _secret_paths(value, f"{path}[{index}]")
    return hits


def audit_config(config: dict, target: str = "openclaw config") -> Report:
    report = Report("OpenClaw policy audit", target)
    report.notes.append("Static check of the file only. Run `openclaw doctor` and OpenClaw's security audit as well.")

    base = dig(config, "models.providers.ollama.baseUrl")
    if base is MISSING:
        report.add("claw.provider", "Ollama provider endpoint", "info", "not set in the file (implicit local discovery)")
    else:
        host = urlparse(str(base)).hostname or ""
        report.add("claw.provider", "Ollama provider endpoint is loopback", "pass" if host in LOOPBACK_HOSTS else "warn",
                   f"host {host}" if host in LOOPBACK_HOSTS else f"host {host}: confirm this is a private, authenticated route")
        native = not str(base).rstrip("/").endswith("/v1") and dig(config, "models.providers.ollama.api") in (MISSING, "ollama")
        report.add("claw.provider.native", "Native Ollama API (no /v1)", "pass" if native else "fail",
                   "native" if native else "the /v1 OpenAI-compatible path makes tool calling unreliable")

    elevated = dig(config, "tools.elevated.enabled")
    report.add("claw.elevated", "Elevated execution is off", "fail" if elevated is True else "pass",
               "tools.elevated.enabled is true" if elevated is True else "off or not set")

    deny = dig(config, "tools.deny")
    deny_list = deny if isinstance(deny, list) else []
    missing = [t for t in RECOMMENDED_DENY if t not in deny_list]
    report.add("claw.deny", "Command execution and browser are denied", "pass" if not missing else "warn",
               "denied" if not missing else "not in tools.deny: " + ", ".join(missing))

    mode = dig(config, "agents.defaults.sandbox.mode")
    report.add("claw.sandbox", "Sessions are sandboxed by default", "pass" if mode == "all" else "warn",
               f"agents.defaults.sandbox.mode = {mode!r}" if mode is not MISSING else "not set")

    auto = dig(config, "tools.openclaw.autoApproveChanges")
    report.add("claw.autoapprove", "Config changes need human approval", "fail" if auto is True else "pass" if auto is False else "info",
               "auto-approve is on" if auto is True else "off" if auto is False else "not set in the file")

    bind = dig(config, "gateway.bind")
    if bind is MISSING:
        report.add("claw.gateway.bind", "Gateway bind address", "info", "not set in the file; confirm loopback with the security audit")
    else:
        local = str(bind) in ("loopback", "127.0.0.1", "localhost", "::1")
        report.add("claw.gateway.bind", "Gateway is bound to loopback", "pass" if local else "fail", f"gateway.bind = {bind!r}")
    auth = dig(config, "gateway.auth")
    report.add("claw.gateway.auth", "Gateway authentication configured", "info" if auth is MISSING else "pass",
               "not set in the file" if auth is MISSING else "present (value not shown)")

    secrets = _secret_paths(config)
    report.add("claw.secrets", "No literal secrets in the config file", "warn" if secrets else "pass",
               ("literal values at: " + ", ".join(secrets[:8]) + "; move them to environment references") if secrets else "none found")

    entries = dig(config, "agents.entries")
    ours = [k for k in entries if str(k).startswith("t47")] if isinstance(entries, dict) else []
    report.add("claw.agents", "Team 47 Studio agents defined", "pass" if ours else "info", ", ".join(ours) or "none; see `t47 openclaw render`")
    for agent_id in ours:
        tools = entries[agent_id].get("tools", {}) if isinstance(entries[agent_id], dict) else {}
        agent_deny = tools.get("deny", [])
        loose = tools.get("profile") in ("full", "coding") or any(t not in agent_deny + deny_list for t in RECOMMENDED_DENY)
        report.add(f"claw.agent.{agent_id}", f"Agent {agent_id} is least-privilege", "warn" if loose else "pass",
                   "broad tool profile or missing denies" if loose else f"profile {tools.get('profile', 'default')}")
    server = dig(config, "mcp.servers.t47")
    report.add("claw.mcp", "t47 MCP server registered", "pass" if server is not MISSING else "info",
               "registered" if server is not MISSING else "not registered")
    return report


def audit_file(path: str) -> Report:
    file = Path(path).expanduser()
    try:
        config = parse_json5(file.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        report = Report("OpenClaw policy audit", str(file))
        report.add("claw.parse", "Config file parsed", "fail", f"{type(exc).__name__}: {exc}"[:200])
        return report
    if not isinstance(config, dict):
        report = Report("OpenClaw policy audit", str(file))
        report.add("claw.parse", "Config file parsed", "fail", "top level is not an object")
        return report
    return audit_config(config, str(file))
