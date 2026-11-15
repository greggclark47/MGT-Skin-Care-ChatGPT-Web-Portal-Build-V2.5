"""Shared fixtures. No test touches the network, a real model or a real OpenClaw install."""
from __future__ import annotations

import json

import pytest

from t47.agents.queue import Store
from t47.config import Settings
from t47.models.ollama import ChatResult
from t47.util import HttpError, HttpResponse


@pytest.fixture
def settings(tmp_path):
    return Settings(state_dir=str(tmp_path / "state"), source="test")


@pytest.fixture
def store(settings):
    queue = Store(settings.state / "queue.sqlite3")
    yield queue
    queue.close()


class FakeClient:
    """Stands in for OllamaClient. `replies` maps a model name to text, a ChatResult, or an exception to raise."""

    def __init__(self, replies: dict, provider: str = "ollama"):
        self.replies, self.provider, self.base_url, self.calls = replies, provider, "http://127.0.0.1:11434", []

    def chat(self, model, messages, **options):
        self.calls.append({"model": model, "messages": messages, **options})
        reply = self.replies.get(model, self.replies.get("*"))
        if callable(reply):
            reply = reply(model, messages, options)
        if isinstance(reply, Exception):
            raise reply
        if isinstance(reply, ChatResult):
            return reply
        if reply is None:
            raise HttpError(404, f"model '{model}' not found")
        return ChatResult(provider=self.provider, model=model, content=reply, total_ms=1200.0, tokens_per_s=40.0, completion_tokens=50)


@pytest.fixture
def fake_client():
    return FakeClient


def make_fetch(routes: dict):
    """Build a fetch function from {url or path suffix: (status, body, headers)}. Unknown URLs answer 404."""
    seen = []

    def fetch(url, *, method="GET", headers=None, data=None, timeout=15.0, follow_redirects=False, max_bytes=2_000_000):
        seen.append((method, url, data))
        for key, value in routes.items():
            if url == key or url.endswith(key):
                if callable(value):
                    value = value(url, data)
                status, body, hdrs = (value + ({},))[:3] if len(value) == 2 else value
                if isinstance(body, (dict, list)):
                    body = json.dumps(body)
                return HttpResponse(url, status, {k.lower(): v for k, v in hdrs.items()}, body.encode("utf-8"), 12.0)
        return HttpResponse(url, 404, {}, b"not found", 5.0)

    fetch.seen = seen
    return fetch


@pytest.fixture
def fetch_factory():
    return make_fetch
