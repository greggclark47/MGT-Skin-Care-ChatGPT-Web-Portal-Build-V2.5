from __future__ import annotations

import asyncio
import os
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator


LOCAL_ONLY_CLASSIFICATIONS = {"sensitive", "biometric"}
COMPLEX_TASKS = {
    "routine_optimization_deep",
    "operator_analysis",
    "premium_consultation",
}
DOMAIN_TASKS = {
    "anti_aging_explanation",
    "anti_aging_search",
    "anti_aging_comparison",
    "anti_aging_provider_summary",
    "complexion_profile_summary",
    "style_color_match",
}


@dataclass(frozen=True)
class Settings:
    ollama_base_url: str
    deepseek_model: str
    qwen_model: str
    openclaw_model: str | None
    openai_enabled: bool
    hosted_credential: str | None
    openai_model: str | None
    request_timeout_seconds: float

    @staticmethod
    def from_env(env: Mapping[str, str] = os.environ) -> "Settings":
        enabled = env.get("HOSTED_OPENAI_ENABLED") == "true"
        key = env.get("OPENAI_API_KEY")
        model = env.get("OPENAI_MODEL")
        if enabled and (not key or not model):
            raise RuntimeError("Hosted OpenAI requires OPENAI_API_KEY and OPENAI_MODEL")
        return Settings(
            ollama_base_url=env.get("OLLAMA_BASE_URL", "").rstrip("/"),
            deepseek_model=env.get("OLLAMA_DEEPSEEK_MODEL", "deepseek-r1:8b"),
            qwen_model=env.get("OLLAMA_QWEN_MODEL", "qwen3.5:4b"),
            openclaw_model=env.get("OLLAMA_OPENCLAW_MODEL") or None,
            openai_enabled=enabled,
            hosted_credential=key,
            openai_model=model,
            request_timeout_seconds=float(env.get("AI_PROVIDER_TIMEOUT_SECONDS", "45")),
        )


class InferenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_type: str = Field(min_length=1, max_length=80, pattern=r"^[a-z][a-z0-9_]*$")
    system_prompt: str = Field(min_length=1, max_length=12_000)
    user_prompt: str = Field(min_length=1, max_length=48_000)
    max_output_tokens: int = Field(default=900, ge=1, le=4_096)
    temperature: float = Field(default=0.2, ge=0, le=1)
    data_classification: Literal["public", "internal", "personal", "sensitive", "biometric"] = "personal"
    allow_hosted: bool = False
    premium_authorized: bool = False

    @model_validator(mode="after")
    def hosted_policy(self) -> "InferenceRequest":
        if self.allow_hosted and not self.premium_authorized:
            raise ValueError("Hosted routing requires premium or operator authorization")
        if self.allow_hosted and self.data_classification in LOCAL_ONLY_CLASSIFICATIONS:
            raise ValueError("Sensitive and biometric inputs are local-only")
        return self


class InferenceResponse(BaseModel):
    ok: bool
    text: str | None
    provider: Literal["ollama", "openai"] | None
    model: str | None
    attempts: int
    used_fallback: bool
    latency_ms: int
    failure_reason: str | None


def local_model_chain(request: InferenceRequest, settings: Settings) -> list[str]:
    if request.task_type in COMPLEX_TASKS:
        candidates = [settings.deepseek_model, settings.qwen_model]
    elif request.task_type in DOMAIN_TASKS and settings.openclaw_model:
        candidates = [settings.openclaw_model, settings.deepseek_model, settings.qwen_model]
    else:
        candidates = [settings.qwen_model, settings.deepseek_model]
    return list(dict.fromkeys(model for model in candidates if model))


def hosted_fallback_allowed(request: InferenceRequest, settings: Settings) -> bool:
    return (
        request.allow_hosted
        and request.premium_authorized
        and request.data_classification not in LOCAL_ONLY_CLASSIFICATIONS
        and settings.openai_enabled
        and bool(settings.hosted_credential)
        and bool(settings.openai_model)
    )


async def ollama_complete(client: httpx.AsyncClient, settings: Settings, request: InferenceRequest, model: str) -> str:
    response = await client.post(
        f"{settings.ollama_base_url}/api/chat",
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_prompt},
            ],
            "stream": False,
            "keep_alive": "10m",
            "options": {"num_predict": request.max_output_tokens, "temperature": request.temperature},
        },
    )
    response.raise_for_status()
    payload = response.json()
    text = payload.get("message", {}).get("content") or payload.get("response")
    if not isinstance(text, str) or not text.strip():
        raise RuntimeError("ollama_response_incomplete")
    return text


async def openai_complete(client: httpx.AsyncClient, settings: Settings, request: InferenceRequest) -> str:
    if not settings.hosted_credential or not settings.openai_model:
        raise RuntimeError("openai_not_configured")
    response = await client.post(
        "https://api.openai.com/v1/responses",
        headers={"authorization": f"Bearer {settings.hosted_credential}"},
        json={
            "model": settings.openai_model,
            "instructions": request.system_prompt,
            "input": request.user_prompt,
            "max_output_tokens": request.max_output_tokens,
            "store": False,
        },
    )
    response.raise_for_status()
    payload = response.json()
    parts = []
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        parts.extend(part.get("text", "") for part in item.get("content", []) if part.get("type") == "output_text")
    text = "".join(parts)
    if payload.get("status") != "completed" or not text.strip():
        raise RuntimeError("openai_response_incomplete")
    return text


async def route_inference(
    request: InferenceRequest,
    configured: Settings,
    transport: httpx.AsyncBaseTransport | None = None,
) -> InferenceResponse:
    started = time.monotonic()
    attempts = 0
    last_reason = "no_candidate"
    chain = local_model_chain(request, configured)
    timeout = httpx.Timeout(configured.request_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout, transport=transport, trust_env=False) as client:
        for model in chain:
            attempts += 1
            try:
                text = await ollama_complete(client, configured, request, model)
                return InferenceResponse(
                    ok=True, text=text, provider="ollama", model=model, attempts=attempts,
                    used_fallback=attempts > 1, latency_ms=int((time.monotonic() - started) * 1000), failure_reason=None,
                )
            except (httpx.HTTPError, RuntimeError, asyncio.TimeoutError) as error:
                last_reason = type(error).__name__

        if hosted_fallback_allowed(request, configured):
            attempts += 1
            try:
                text = await openai_complete(client, configured, request)
                return InferenceResponse(
                    ok=True, text=text, provider="openai", model=configured.openai_model, attempts=attempts,
                    used_fallback=True, latency_ms=int((time.monotonic() - started) * 1000), failure_reason=None,
                )
            except (httpx.HTTPError, RuntimeError, asyncio.TimeoutError) as error:
                last_reason = type(error).__name__

    return InferenceResponse(
        ok=False, text=None, provider=None, model=None, attempts=attempts,
        used_fallback=attempts > 1, latency_ms=int((time.monotonic() - started) * 1000), failure_reason=last_reason,
    )


def create_app(settings: Settings | None = None, transport: httpx.AsyncBaseTransport | None = None) -> FastAPI:
    configured = settings or Settings.from_env()
    if not configured.ollama_base_url:
        raise RuntimeError("OLLAMA_BASE_URL is required")

    application = FastAPI(title="Team 47 Studio AI Broker", version="1.0.0", docs_url=None, redoc_url=None)

    @application.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/readyz")
    async def readyz() -> dict[str, object]:
        try:
            async with httpx.AsyncClient(timeout=5, transport=transport, trust_env=False) as client:
                response = await client.get(f"{configured.ollama_base_url}/api/tags")
                response.raise_for_status()
                installed = {entry.get("name") or entry.get("model") for entry in response.json().get("models", [])}
            required = {configured.deepseek_model, configured.qwen_model}
            if configured.openclaw_model:
                required.add(configured.openclaw_model)
            missing = sorted(required - installed)
            if missing:
                raise HTTPException(status_code=503, detail={"status": "not_ready", "missing_models": missing})
            return {"status": "ready", "required_model_count": len(required)}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=503, detail={"status": "not_ready"}) from None

    @application.post("/v1/inference", response_model=InferenceResponse)
    async def inference(request: InferenceRequest) -> InferenceResponse:
        return await route_inference(request, configured, transport)

    return application


app = create_app()
