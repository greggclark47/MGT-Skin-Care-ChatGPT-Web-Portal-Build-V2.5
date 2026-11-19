# Phase 3 multi-model backend implementation

Status: implementation scaffold complete; billable infrastructure not provisioned.

## Implemented

- Added a fail-closed FastAPI inference broker under `services/ai-broker`.
- Preserved the established TypeScript AI gateway as the policy authority for entitlements,
  budgets, validation, citations, and routing telemetry.
- Added explicit, auditable routing for Qwen general chat, DeepSeek complex reasoning, optional
  OpenClaw domain tasks, and authorized OpenAI fallback.
- Prevented hosted routing for sensitive or biometric-classified inputs.
- Added Google Cloud Terraform for a private GPU VM, retained model disk, Cloud NAT, restricted
  firewall, Cloud Run broker, Secret Manager, and JWT-protected API Gateway.
- Kept port 11434 private and granted Cloud Run invocation only to the API Gateway service account.
- Required immutable container digests and rejected mutable `:latest` model tags.

## Deliberately pending

- GPU instance creation, because project, region, quota, cost approval, and machine benchmark are
  external production decisions.
- OpenClaw model import, because no reviewed GGUF file, license, hash, or Modelfile was supplied.
- OpenAI activation, because a project service account, approved model, spend limits, and secret
  version are external inputs.
- Application cutover to the broker, which follows staging endpoint, authentication, quality, and
  fallback verification.

## Production acceptance evidence

- GPU and disk quota approval.
- Source image and container vulnerability reports.
- Model license, artifact hash, Ollama manifest digest, and benchmark report for each route.
- Anonymous access denial at Cloud Run and JWT denial/acceptance tests at API Gateway.
- Outage tests for Qwen, DeepSeek, OpenClaw, OpenAI, and the entire GPU VM.
- Spend caps, rate limits, key rotation, no-secret logging, and request-ID telemetry.
- Same-input evaluation proving route quality, schema compliance, latency, and cost per success.
