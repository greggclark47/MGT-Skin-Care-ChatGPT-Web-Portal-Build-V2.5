"""Read-only checks of the local AI plane: Ollama, GPU and OpenClaw. Run this on the workstation."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse

from t47.config import LOOPBACK_HOSTS, Settings
from t47.diagnostics.checks import Report
from t47.util import Fetch, HttpError, get_json, http_request


def _run(cmd: list[str]) -> str | None:
    if not shutil.which(cmd[0]):
        return None
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        return out.stdout.strip() if out.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        return None


def model_base(name: str) -> str:
    return name.split(":")[0]


def run(settings: Settings, *, fetch: Fetch = http_request, runner=_run, openclaw_home: str | None = None) -> Report:
    base = settings.ollama_base_url.rstrip("/")
    report = Report("Local AI plane", base)

    host = urlparse(base).hostname or ""
    report.add("ollama.loopback", "Ollama endpoint is loopback-only", "pass" if host in LOOPBACK_HOSTS else "fail",
               f"host {host}" + ("" if host in LOOPBACK_HOSTS else ": the local runtime must not be reachable from the network"))

    try:
        version = get_json(base + "/api/version", fetch=fetch).get("version", "?")
        report.add("ollama.up", "Ollama is running", "pass", f"version {version}", version=version)
    except (HttpError, ValueError) as exc:
        report.add("ollama.up", "Ollama is running", "fail", str(exc))
        report.notes.append("Start Ollama, then rerun. Model checks were skipped.")
        version = None

    installed: dict[str, dict] = {}
    if version:
        tags = get_json(base + "/api/tags", fetch=fetch).get("models", [])
        installed = {m["name"]: m for m in tags}
        report.add("ollama.models", "Installed models", "info", f"{len(installed)} models", names=sorted(installed))
        for role, model in settings.models.items():
            hit = model in installed or (":" not in model and any(model_base(n) == model for n in installed))
            report.add(f"ollama.role.{role}", f"Model for role '{role}'", "pass" if hit else "fail",
                       f"{model} {'installed' if hit else 'is not installed; pull it or change [models]'}")
        chosen = [installed[m] for m in set(settings.models.values()) if m in installed and "embed" not in m]
        total_gb = sum(m.get("size", 0) for m in chosen) / 1e9
        fits = total_gb <= settings.vram_gb * 0.85
        report.add("ollama.vram", "Configured models fit the GPU together", "pass" if fits else "warn",
                   f"{total_gb:.1f} GB of weights against {settings.vram_gb:.0f} GB VRAM (context memory is extra; measured, not modelled)",
                   weights_gb=round(total_gb, 2))
        try:
            loaded = get_json(base + "/api/ps", fetch=fetch).get("models", [])
            offloaded = [m["name"] for m in loaded if m.get("size_vram", 0) < m.get("size", 0)]
            report.add("ollama.loaded", "Loaded models run fully on the GPU", "pass" if not offloaded else "warn",
                       "nothing loaded" if not loaded else ("partly on CPU: " + ", ".join(offloaded) if offloaded else
                                                             ", ".join(m["name"] for m in loaded)))
        except (HttpError, ValueError) as exc:
            report.add("ollama.loaded", "Loaded models run fully on the GPU", "skipped", str(exc))

    gpu = runner(["nvidia-smi", "--query-gpu=name,memory.total,memory.used,driver_version", "--format=csv,noheader"])
    report.add("gpu", "GPU visible", "info" if gpu else "skipped", gpu or "nvidia-smi not available")

    claw_version = runner(["openclaw", "--version"])
    report.add("openclaw.cli", "OpenClaw CLI on PATH", "info" if claw_version else "skipped", claw_version or "not found on PATH")
    home = Path(openclaw_home).expanduser() if openclaw_home else Path.home() / ".openclaw"
    config = next((p for p in (home / "openclaw.json", home / "openclaw.json5") if p.is_file()), None)
    if config:
        from t47.openclaw.audit import audit_file

        for check in audit_file(str(config)).checks:
            report.checks.append(check)
    else:
        report.add("openclaw.config", "OpenClaw config found", "skipped", f"no openclaw.json under {home}")
    return report
