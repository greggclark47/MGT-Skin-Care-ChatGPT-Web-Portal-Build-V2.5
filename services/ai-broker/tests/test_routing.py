import os

os.environ.setdefault("OLLAMA_BASE_URL", "http://ollama.internal:11434")

from app.main import InferenceRequest, Settings, hosted_fallback_allowed, local_model_chain


SETTINGS = Settings(
    ollama_base_url="http://ollama.internal:11434",
    deepseek_model="deepseek-r1:8b",
    qwen_model="qwen3.5:4b",
    openclaw_model="team47-openclaw:v1",
    openai_enabled=True,
    hosted_credential="fixture-test-value",
    openai_model="test-openai-model",
    request_timeout_seconds=1,
)


def request(task_type: str, **overrides) -> InferenceRequest:
    return InferenceRequest(
        task_type=task_type,
        system_prompt="System",
        user_prompt="User",
        **overrides,
    )


def test_explicit_task_registry_selects_auditable_local_chain():
    assert local_model_chain(request("operator_analysis"), SETTINGS) == ["deepseek-r1:8b", "qwen3.5:4b"]
    assert local_model_chain(request("style_color_match"), SETTINGS) == [
        "team47-openclaw:v1", "deepseek-r1:8b", "qwen3.5:4b"
    ]
    assert local_model_chain(request("coach_answer"), SETTINGS) == ["qwen3.5:4b", "deepseek-r1:8b"]


def test_sensitive_data_cannot_enable_hosted_fallback():
    try:
        request("operator_analysis", allow_hosted=True, premium_authorized=True, data_classification="biometric")
        raise AssertionError("biometric hosted request was accepted")
    except ValueError as error:
        assert "local-only" in str(error)


def test_hosted_fallback_requires_explicit_authorization_and_configuration():
    authorized = request(
        "operator_analysis",
        allow_hosted=True,
        premium_authorized=True,
        data_classification="internal",
    )
    assert hosted_fallback_allowed(authorized, SETTINGS)
    assert not hosted_fallback_allowed(request("operator_analysis"), SETTINGS)
    assert not hosted_fallback_allowed(authorized, Settings(**{**SETTINGS.__dict__, "openai_enabled": False}))
