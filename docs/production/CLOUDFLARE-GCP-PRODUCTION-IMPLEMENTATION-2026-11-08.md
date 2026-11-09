# Cloudflare + Google Cloud implementation checkpoint

Date: 2026-11-08

## Implemented in source

- two-stage Google Cloud Terraform foundation and application deployment;
- Artifact Registry, service identities and keyless GitHub OIDC federation;
- private, versioned media and backup buckets with public access prevention;
- Secret Manager containers with values intentionally excluded;
- Cloud Run web/API services restricted to the load balancer, with default service URLs
  disabled through Google's preview control and an explicit staging acceptance gate;
- Cloud Run one-shot operations job and Cloud Scheduler trigger;
- Global External HTTPS Load Balancer, managed certificate, fixed IP and canonical redirect;
- Cloud Armor managed WAF rules in preview for staging tuning;
- preview-first API/webhook rate protection;
- pinned numeric Secret Manager runtime versions with no mutable `latest` references;
- optional public readiness monitoring, operations email alerts and project budget thresholds;
- protected per-environment GCS Terraform state bootstrap with versioning and state locking;
- Cloudflare apex/`www` DNS and DNSSEC Terraform;
- application-owned browser security headers for the Caddy-free Cloud Run path;
- local RTX 5080/Ollama qualification script and loopback-only policy.

## Local verification completed

- Google Cloud Terraform validated with Terraform 1.9.8 and Google provider 7.46.2;
- Cloudflare Terraform validated with Terraform 1.9.8 and Cloudflare provider 5.28.1;
- 1,162 infrastructure contracts passed;
- 39 sequential application suites passed;
- the optimized 44-route Next.js production build passed;
- local Ollama health and synthetic DeepSeek/Qwen inference passed on the RTX 5080; and
- the expanded changed-file credential scan checked 41 files with no findings.

The evidence packet is local-only. No Google Cloud, Cloudflare, Supabase, Stripe or
production DNS changes were applied without account credentials and owner approval.

## External authorization still required

1. Google Cloud staging and production project IDs and billing association.
2. Approved deployment region after Supabase location and privacy review.
3. Cloudflare API token scoped only to DNS/DNSSEC for `team47studio.com`.
4. Secret Manager values for database, Supabase, Stripe and approved alert endpoints.
5. Immutable Artifact Registry image digests produced by a passing release workflow.
6. Cloudflare plan-dependent WAF, bot and rate-limit selections.
7. Owner approval of storage retention, customer-image privacy and deletion policy.
8. Staging accessibility evidence, restore drill and operational alert receiver.
9. Stripe live-mode products, prices and webhook signing secret before billing activation.
10. Hosted AI processing approval before Ollama Cloud or OpenAI fallback is enabled.

No production traffic should be enabled until the repository production gate and staging
verification packet both pass against the exact candidate commit and image digests.
