# Team 47 Studio AI Broker

This FastAPI service is the private network broker between the existing TypeScript AI policy
gateway and model providers. The TypeScript gateway remains authoritative for entitlements,
budgets, response schemas, citations, and customer-facing telemetry. This broker owns provider
connectivity and a second fail-closed routing boundary.

## Routing contract

- General and conversational tasks: Qwen, then DeepSeek.
- Complex reasoning tasks: DeepSeek, then Qwen.
- Approved domain tasks: an optional imported OpenClaw Ollama model, then DeepSeek, then Qwen.
- OpenAI: last resort only when hosted routing is enabled, the request is explicitly authorized,
  and the data classification is neither `sensitive` nor `biometric`.

The broker never classifies prompts by scanning their text. Callers provide a bounded `task_type`,
and the checked-in registry maps that task to a reviewable route.

## Required runtime configuration

| Variable | Purpose |
|---|---|
| `OLLAMA_BASE_URL` | Private Ollama VM URL, including port 11434 |
| `OLLAMA_DEEPSEEK_MODEL` | Evaluated immutable DeepSeek tag |
| `OLLAMA_QWEN_MODEL` | Evaluated immutable Qwen tag |
| `OLLAMA_OPENCLAW_MODEL` | Optional imported custom model tag |
| `HOSTED_OPENAI_ENABLED` | Exact `true` to permit an authorized hosted fallback |
| `OPENAI_MODEL` | Approved, pinned Responses API model ID |
| `OPENAI_API_KEY` | Secret Manager injection; never a build argument or tracked file |

Build with an approved immutable Python base image:

```sh
docker build --build-arg PYTHON_IMAGE=python:3.12-slim@sha256:APPROVED_DIGEST -t ai-broker .
```

Production callers must pass through Google API Gateway with an accepted JWT. Cloud Run grants
`roles/run.invoker` only to the API Gateway service account.

The repository includes `models/openclaw.Modelfile.example`, but no OpenClaw weights. Import is
blocked until the GGUF license, source, cryptographic hash, security scan, and evaluation are
approved. Never download an arbitrary community model during instance startup.
