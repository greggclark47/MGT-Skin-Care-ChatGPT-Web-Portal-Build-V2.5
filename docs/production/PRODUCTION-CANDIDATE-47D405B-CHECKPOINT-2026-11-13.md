# Team 47 Studio production candidate checkpoint

Date: 2026-11-13  
Candidate commit: `47d405bf42f01a8ce5b4a8f044aaf52a681878b4`  
Build: `e4c4f073-c4cd-4204-8d1d-798927a3e618`

## Completed in this checkpoint

- Deployed the theme-aware Team 47 Studio wordmark to production.
- Browser-verified the compact header and large landing lockups in dark and light modes.
- Verified `https://www.team47studio.com/` redirects permanently to the canonical apex.
- Promoted one candidate across the production web, API, worker, and signed alert-receiver runtimes.
- Verified the production API and worker preflight both report PASS.
- Verified `GET /healthz` and `GET /api/hub/session` return HTTP 200 through Cloudflare and the Google load balancer.
- Confirmed the load balancer routes `/healthz`, `/readyz`, `/api/*`, and `/webhooks/*` to the API service while the web service remains the default backend.
- Repaired trailing control bytes in the Supabase service-role and operations-alert tokens by creating sanitized Secret Manager version 2 values. Secret contents were not logged or written to repository files.
- Completed a controlled production worker execution successfully: `team47-production-worker-rp7jr`.
- Re-ran the Stripe subscription, commercial billing, and external-boundary test set: 3/3 passed.
- Updated the Terraform source to match the active GA Cloud Run launch stage and validated the configuration.
- Re-ran the GCP platform and cost-policy contract set: 14/14 passed.

## Immutable runtime artifacts

- API/worker/alert image: `us-east1-docker.pkg.dev/team47studio-production/team47-production-platform/api@sha256:519c6ab5fbb1f41790ddc9c0f293838681e27d29b3a1f763c41a370f663f19a7`
- Web image: `us-east1-docker.pkg.dev/team47studio-production/team47-production-platform/web@sha256:dc1073e708b94909611a97b343ee6a180ea29b7722b0b20bbc4732d18476f621`
- Web revision: `team47-production-web-00004-5bv`
- API revision: `team47-production-api-00003-54n`
- Alert receiver revision: `team47-production-alerts-00003-4l4`

## Remaining production priorities

1. Keep subscriptions disabled until the live Stripe business account, products, prices, meter, webhook endpoint, tax/refund/dispute settings, and approved terms are confirmed.
2. Run the complete Stripe test-mode and controlled live-mode payment matrix with reconciliation evidence.
3. Complete candidate-bound authenticated Supabase OAuth, recovery, deletion, replay rejection, and two-account isolation evidence.
4. Complete an encrypted off-host backup and isolated restore drill with measured RPO/RTO.
5. Complete a deployed WCAG 2.2 AA desktop/mobile audit for this candidate.
6. Confirm named support, incident, alert, accessibility, commerce, data, mobile, and final release approvers.
7. Complete Android signed-build, device, internal-track, Data safety, content-rating, screenshot, and policy evidence.
8. Approve production AI provider/model routing, hosted fallback policy, data retention, spend limits, latency/error budgets, and reconciliation.
9. Complete retail-partner authorization, catalog/claims, referral attribution, settlement, data-sharing, and support acceptance.

## Release position

The candidate is materially healthier than the diagnostic baseline: runtime admission, candidate alignment, route mapping, worker execution, and theme-aware branding are now verified. General-production approval remains HOLD until the remaining commerce, authenticated identity, restore, accessibility, mobile, AI, partner, and owner-signoff evidence is complete.
