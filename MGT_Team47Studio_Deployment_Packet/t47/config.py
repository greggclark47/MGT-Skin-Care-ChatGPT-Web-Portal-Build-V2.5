"""Packet settings. The file holds no secrets: keys are named by environment variable only."""
from __future__ import annotations

import os
import tomllib
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1", "[::1]"}
SECRET_KEY_HINTS = ("api_key", "apikey", "secret", "token", "password")


@dataclass
class Settings:
    site_origin: str = "https://team47studio.com"
    site_www: str = "https://www.team47studio.com"
    ollama_base_url: str = "http://127.0.0.1:11434"
    allow_remote_ollama: bool = False
    num_ctx: int = 8192
    keep_alive: str = "10m"
    request_timeout_s: float = 60.0
    cloud_enabled: bool = False
    cloud_base_url: str = "https://ollama.com"
    cloud_model: str = "deepseek-v4.1-flash"
    cloud_api_key_env: str = "OLLAMA_CLOUD_API_KEY"
    models: dict[str, str] = field(default_factory=lambda: {
        "drafting": "qwen3.5:4b", "reasoning": "deepseek-r1:8b", "embedding": "nomic-embed-text"})
    vram_gb: float = 16.0
    state_dir: str = "~/.t47"
    repo_path: str = ""
    agent_identity: str = "agent:t47-local"
    source: str = "defaults"

    @property
    def state(self) -> Path:
        return Path(os.path.expanduser(self.state_dir))

    @property
    def cloud_api_key(self) -> str | None:
        return os.environ.get(self.cloud_api_key_env) or None

    def validate(self) -> list[str]:
        errors: list[str] = []
        local = urlparse(self.ollama_base_url)
        if local.scheme not in ("http", "https") or not local.hostname:
            errors.append("ollama.base_url must be an http(s) URL")
        elif local.hostname not in LOOPBACK_HOSTS and not self.allow_remote_ollama:
            errors.append("ollama.base_url must be loopback; the local model runtime is never exposed (set ollama.allow_remote=true only for a private broker)")
        if local.path.rstrip("/").endswith("/v1"):
            errors.append("ollama.base_url must be the native API root, without /v1")
        if self.cloud_enabled and urlparse(self.cloud_base_url).scheme != "https":
            errors.append("ollama_cloud.base_url must be https")
        for site in (self.site_origin, self.site_www):
            if urlparse(site).scheme != "https":
                errors.append(f"site URL must be https: {site}")
        if self.vram_gb <= 0:
            errors.append("hardware.vram_gb must be positive")
        for role in ("drafting", "reasoning"):
            if not self.models.get(role):
                errors.append(f"models.{role} is required")
        return errors


def _find_secrets(table: dict, path: str = "") -> list[str]:
    found: list[str] = []
    for key, value in table.items():
        here = f"{path}.{key}" if path else key
        if isinstance(value, dict):
            found += _find_secrets(value, here)
        elif isinstance(value, str) and value and any(h in key.lower() for h in SECRET_KEY_HINTS) and not key.lower().endswith("_env"):
            found.append(here)
    return found


def load_settings(path: str | None = None) -> Settings:
    """Load settings from a TOML file. Order: explicit path, $T47_CONFIG, ./config/t47.toml, defaults."""
    candidate = path or os.environ.get("T47_CONFIG")
    if not candidate and Path("config/t47.toml").is_file():
        candidate = "config/t47.toml"
    settings = Settings()
    if not candidate:
        return settings
    file = Path(os.path.expanduser(candidate))
    if not file.is_file():
        raise FileNotFoundError(f"config file not found: {file}")
    data = tomllib.loads(file.read_text(encoding="utf-8"))
    secrets = _find_secrets(data)
    if secrets:
        raise ValueError("config must not contain secret values; name an environment variable instead: " + ", ".join(secrets))
    site, oll, cloud = data.get("site", {}), data.get("ollama", {}), data.get("ollama_cloud", {})
    settings.site_origin = site.get("origin", settings.site_origin)
    settings.site_www = site.get("www", settings.site_www)
    settings.ollama_base_url = oll.get("base_url", settings.ollama_base_url).rstrip("/")
    settings.allow_remote_ollama = bool(oll.get("allow_remote", False))
    settings.num_ctx = int(oll.get("num_ctx", settings.num_ctx))
    settings.keep_alive = str(oll.get("keep_alive", settings.keep_alive))
    settings.request_timeout_s = float(oll.get("timeout_s", settings.request_timeout_s))
    settings.cloud_enabled = bool(cloud.get("enabled", False))
    settings.cloud_base_url = cloud.get("base_url", settings.cloud_base_url).rstrip("/")
    settings.cloud_model = cloud.get("model", settings.cloud_model)
    settings.cloud_api_key_env = cloud.get("api_key_env", settings.cloud_api_key_env)
    settings.models = {**settings.models, **data.get("models", {})}
    settings.vram_gb = float(data.get("hardware", {}).get("vram_gb", settings.vram_gb))
    paths = data.get("paths", {})
    settings.state_dir = paths.get("state_dir", settings.state_dir)
    settings.repo_path = paths.get("repo", settings.repo_path)
    settings.agent_identity = data.get("operator", {}).get("agent_identity", settings.agent_identity)
    settings.source = str(file)
    return settings
