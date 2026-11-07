# Phase 3 — Google Cloud multi-model backend

This Terraform module prepares, but does not automatically approve, the billable Phase 3
infrastructure:

- a private VPC, subnet, Cloud NAT, and Direct VPC egress from Cloud Run;
- a GPU Compute Engine VM with no public address;
- an independently retained persistent disk for Ollama model weights;
- private firewall access to port 11434 only from the tagged Cloud Run broker;
- a Cloud Run FastAPI inference broker using a dedicated service account;
- Secret Manager containers for the OpenAI credential and, when approved, the Ollama Cloud Pro key; and
- a JWT-protected Google API Gateway whose backend identity is the only Cloud Run invoker.

## Security and lifecycle decisions

1. No model API port is exposed to the public internet.
2. Terraform creates secret containers but never receives or stores secret values. The Ollama Cloud container is created only when its reviewed fallback is enabled.
3. The operator adds the secret version outside Terraform, then enables `openai_model` in a later
   reviewed apply.
4. GPU source images, Python images, Ollama images, broker images, and model tags require an
   approved immutable release identity. Mutable `:latest` model tags fail planning.
5. Customer images and biometric-classified prompts are local-only.
6. The model disk is separate from the VM boot disk so replacement does not discard downloaded
   weights. Production deletion protection remains enabled on the Cloud Run broker.

## Required external inputs

- Google Cloud project ID and billing association;
- approved region and GPU-capable zone;
- confirmed GPU quota for the selected accelerator;
- benchmark-approved machine type, accelerator count, disk size, and concurrency;
- reviewed GPU image containing Docker and the NVIDIA container runtime;
- immutable Ollama and AI broker container digests;
- Supabase/JWT issuer, JWKS URI, and audience;
- approved model tags plus the custom OpenClaw Modelfile/model tag, if used;
- approved Ollama Pro plan, hosted-processing decision, API key, model, and spend limit if the cloud fallback is enabled;
- approved OpenAI project service account, model ID, rate limit, spend limit, and data policy.

## Controlled rollout

1. Copy `terraform.tfvars.example` to an untracked environment-specific tfvars file.
2. Leave `openai_model` empty and `ollama_cloud_enabled=false` for the first staging apply.
3. Run `terraform init`, `terraform fmt -check`, `terraform validate`, and `terraform plan`.
4. Obtain cost, quota, security, and production-owner approval for the saved plan.
5. Apply to staging and verify the GPU driver, persistent disk, Ollama container, model digests,
   `/readyz`, JWT enforcement, and denied anonymous Cloud Run access.
6. Add approved hosted-provider keys as separate Secret Manager versions without printing them.
7. Enable one approved hosted fallback at a time, apply again, and test only synthetic non-customer prompts.
8. Run same-case quality, latency, failure, spend, and fallback evaluation before production.

The OpenAI key should belong to a project service account rather than a developer and should have
an expiration and rotation process. The production application must retain OpenAI request IDs for
support diagnostics without logging prompts, keys, or customer data.
