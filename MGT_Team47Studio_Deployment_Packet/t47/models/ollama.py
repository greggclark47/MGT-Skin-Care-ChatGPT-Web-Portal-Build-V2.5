"""Minimal client for the native Ollama API (/api/chat), used for the local runtime and for Ollama Cloud.

The native API is used on purpose: the repository's gateway and OpenClaw's Ollama provider both use it, and the
OpenAI-compatible /v1 path is where tool calling is unreliable.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from typing import Any

from t47.util import Fetch, get_json, http_request, post_json

THINK_RE = re.compile(r"<think>(.*?)</think>", re.S | re.I)


@dataclass
class ChatResult:
    provider: str
    model: str
    content: str
    thinking: str = ""
    tool_calls: list[dict] = field(default_factory=list)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_ms: float = 0.0
    load_ms: float = 0.0
    tokens_per_s: float = 0.0
    done_reason: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class OllamaClient:
    def __init__(self, base_url: str, *, api_key: str | None = None, provider: str = "ollama", timeout: float = 60.0,
                 fetch: Fetch = http_request):
        self.base_url = base_url.rstrip("/")
        self.provider = provider
        self.timeout = timeout
        self._fetch = fetch
        self._headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    def version(self) -> str:
        return get_json(self.base_url + "/api/version", headers=self._headers, fetch=self._fetch).get("version", "?")

    def tags(self) -> list[dict]:
        return get_json(self.base_url + "/api/tags", headers=self._headers, fetch=self._fetch).get("models", [])

    def ps(self) -> list[dict]:
        return get_json(self.base_url + "/api/ps", headers=self._headers, fetch=self._fetch).get("models", [])

    def chat(self, model: str, messages: list[dict], *, temperature: float = 0.3, num_predict: int = 600,
             num_ctx: int | None = 8192, keep_alive: str | None = "10m", think: bool | None = None,
             format: str | dict | None = None, tools: list[dict] | None = None) -> ChatResult:
        options: dict[str, Any] = {"temperature": temperature, "num_predict": num_predict}
        payload: dict[str, Any] = {"model": model, "messages": messages, "stream": False, "options": options}
        if self.provider == "ollama":  # runtime options only make sense for the local server
            if num_ctx:
                options["num_ctx"] = num_ctx
            if keep_alive:
                payload["keep_alive"] = keep_alive
        if think is not None:
            payload["think"] = think
        if format is not None:
            payload["format"] = format
        if tools:
            payload["tools"] = tools
        data = post_json(self.base_url + "/api/chat", payload, headers=self._headers, timeout=self.timeout, fetch=self._fetch)
        message = data.get("message") or {}
        content = message.get("content") or ""
        thinking = message.get("thinking") or ""
        inline = THINK_RE.findall(content)
        if inline:  # older builds return the reasoning trace inline
            thinking = (thinking + "\n" + "\n".join(inline)).strip()
            content = THINK_RE.sub("", content)
        eval_count, eval_ns = int(data.get("eval_count") or 0), int(data.get("eval_duration") or 0)
        return ChatResult(
            provider=self.provider, model=data.get("model", model), content=content.strip(), thinking=thinking.strip(),
            tool_calls=list(message.get("tool_calls") or []), prompt_tokens=int(data.get("prompt_eval_count") or 0),
            completion_tokens=eval_count, total_ms=round(int(data.get("total_duration") or 0) / 1e6, 1),
            load_ms=round(int(data.get("load_duration") or 0) / 1e6, 1),
            tokens_per_s=round(eval_count / (eval_ns / 1e9), 1) if eval_ns else 0.0, done_reason=data.get("done_reason"))

    def embed(self, model: str, text: str) -> list[float]:
        data = post_json(self.base_url + "/api/embed", {"model": model, "input": text}, headers=self._headers,
                         timeout=self.timeout, fetch=self._fetch)
        vectors = data.get("embeddings") or []
        return vectors[0] if vectors else []


def make_clients(settings, *, fetch: Fetch = http_request) -> dict[str, OllamaClient]:
    """Local client always; cloud client only when enabled and its key is present in the environment."""
    clients = {"ollama": OllamaClient(settings.ollama_base_url, timeout=settings.request_timeout_s, fetch=fetch)}
    if settings.cloud_enabled and settings.cloud_api_key:
        clients["ollama_cloud"] = OllamaClient(settings.cloud_base_url, api_key=settings.cloud_api_key, provider="ollama_cloud",
                                               timeout=settings.request_timeout_s, fetch=fetch)
    return clients
