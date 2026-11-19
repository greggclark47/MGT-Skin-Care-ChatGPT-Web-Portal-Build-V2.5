# Team 47 Studio Google Cloud production platform

This module implements the approved Cloudflare + Google Cloud production design.
It is intentionally two-stage so creating a project foundation cannot accidentally
launch public services before credentials, immutable images and runtime evidence exist.

## Provisioned foundation

- required Google APIs;
- one private Artifact Registry Docker repository;
- separate least-privilege identities for web, API, worker, scheduler and backups;
- Secret Manager containers without secret values;
- non-public, versioned Cloud Storage buckets for customer media and encrypted backups;
- optional project-scoped monthly budget thresholds; and
- optional GitHub OIDC federation without a downloadable service-account key.

When `deploy_application=true`, the module also provisions:

- separate Cloud Run web and API services;
- load-balancer-only Cloud Run ingress and disabled default service URLs (the URL-disable
  control is currently a Google Cloud preview feature and must pass staging before production);
- a one-sweep Cloud Run Job scheduled by Cloud Scheduler;
- serverless network endpoint groups;
- Global External HTTPS Load Balancing with apex canonicalization;
- a Google-managed certificate, modern TLS policy and fixed global IP;
- Cloud CDN for public web content only;
- Cloud Armor SQL-injection and XSS rules, initially in preview for tuning;
- preview-first per-client API and webhook throttling; and
- optional HTTPS readiness monitoring with a critical operations alert.

## Required operator sequence

1. Create separate staging and production GCP projects and attach approved billing.
2. Run `infra/gcp/bootstrap` once per project, migrate its local bootstrap state to the
   protected bucket, and initialize this module's GCS backend with the emitted prefix.
3. Install Terraform 1.9+ and authenticate with an administrator identity using MFA.
4. Copy `terraform.tfvars.example` to an untracked environment-specific file.
5. Keep `deploy_application=false`; run `terraform init`, `fmt -check`, `validate` and `plan`.
6. Review cost, IAM, data location, retention and deletion protection; apply the foundation.
7. Add secret **versions** directly in Secret Manager. Terraform creates only containers;
   runtime mappings must pin positive numeric versions and never use `latest`. When enabling
   Stripe, add `STRIPE_SECRET_KEY` to `stripe_api_secret_environment`; subscription Checkout
   also requires `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`. The plan rejects an incomplete
   Supabase database/identity path or a partial Stripe binding before deployment.
8. Configure the GitHub environment with the emitted workload-identity provider and service account.
9. Build and qualify the application, then push digest-addressed images to the emitted registry.
10. Complete the non-secret runtime maps and run the repository preflight against the same values.
11. Set `deploy_application=true`, save a Terraform plan and obtain production-owner approval.
12. Apply staging, capture the load-balancer IP and apply `infra/cloudflare` with proxying disabled.
13. Wait for both Google-managed certificate domains to become `ACTIVE`.
14. Supply the approved operations mailbox and billing cap, then enable monitoring and the
    project budget. Verify the notification channel and perform a test incident.
15. Enable Cloudflare proxying and Full (strict), then run redirects, TLS, headers, OAuth,
    Stripe signature, accessibility, restore and rollback tests.
16. Review Cloud Armor logs before moving WAF or rate rules out of preview.
17. Repeat from a reviewed production plan in the separate production project.

## Secret boundary

No secret value belongs in Terraform, tfvars, GitHub repository variables, build arguments,
Google Drive, container layers or release evidence. Add secret versions through an approved
interactive or automated Secret Manager workflow. Reference an explicit version in the runtime
map and rotate through a reviewed plan; keep optional secret containers empty until their feature
has been reviewed and enabled.

## Monitoring and cost boundary

Monitoring is disabled by default so initial certificate provisioning cannot create noisy alerts.
Enable it only after DNS and TLS are healthy and the operations mailbox is approved. The uptime
policy checks `/readyz`, validates TLS and alerts after a sustained failure. The budget is also
optional and project-scoped, with 50%, 80% and 100% thresholds. Budgets notify; they do not stop
services or replace quota and scaling controls.

Cloud Armor throttling begins in preview and is for abuse mitigation, not subscription metering.
Tune the threshold from staging logs before enforcement because upstream proxy behavior and
legitimate bursts can affect per-client aggregation.

## Data boundary

The media bucket is private and intended for production account and photo-journal objects.
The backup bucket is private, versioned and retention protected. Google Drive remains for
human-reviewed operational documents and export packets—not as the production object store.

Do not lock the backup-bucket retention policy until an isolated restore and deletion-policy
exercise passes; a locked policy cannot be shortened or removed.

## Local AI boundary

This module does not expose local Ollama. Production traffic reaches AI only through the
reviewed broker architecture in `infra/gcp/phase3-ai`. Local RTX 5080 qualification remains
loopback-only and is covered by `scripts/Test-Team47LocalAI.ps1`.
