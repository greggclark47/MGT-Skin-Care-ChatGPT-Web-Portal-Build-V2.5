# Team47Studio production candidate `e47aad0` deployment

Date: 2026-11-13 18:07 EST  
Project: `team47studio-production`  
Region: `us-east1`

## Result

Candidate `e47aad07d9807e25ae0f00ae24e2aec560957147` was built from a clean Git archive, passed the complete local verification suite, completed Google Cloud Build successfully, and was deployed using immutable Artifact Registry digests.

Subscriptions remain disabled. No DNS, Cloudflare, TLS, secret, price, or enrollment setting was changed during this deployment.

## Verification before deployment

- Full local verification passed with 1,402 assertions.
- Tracked-source credential scan passed for 920 tracked files.
- Accessibility theme, optimized web build, production proxy journey, and generated public artifact scan passed.
- Mobile strict TypeScript, contracts, production URL validation, Expo dependency alignment, and Android Hermes export passed.
- Signed Android store build remains pending Expo/EAS authentication and is not part of this Cloud Run deployment.

Local verification report:

`work/verification/2026-11-13T19-24-48-771Z/report.md`

## Google build

- Build: `f36995b8-002b-48bf-b442-708d5f65518a`
- Status: `SUCCESS`
- API digest: `sha256:7ca6a599f1c1a3f27bb99554fc76666a81ae036449ebba4bdc45010603cfdaf9`
- Web digest: `sha256:15ed0284e18cbf11bf7071d135995ffd9501c0047db2bed98831bf27176c93e8`

## Deployed targets

- API revision: `team47-production-api-00005-br5`
- Alert receiver revision: `team47-production-alerts-00005-jnm`
- Web revision: `team47-production-web-00006-6fg`
- Worker image updated to the API digest.
- Worker execution `team47-production-worker-wwhv9` completed successfully in 9.14 seconds with one successful task and zero reported failures.

## Live checks

- `https://team47studio.com/healthz`: HTTP 200, `status=ok`.
- `https://team47studio.com/api/hub/session`: HTTP 200; authentication configured; payments and subscription billing remain disabled.
- `https://team47studio.com/api/hub/billing/plans?cycle=monthly`: HTTP 200; Free, Guided, and Studio tiers returned; pricing remains pending and enrollment closed.
- `https://team47studio.com/readyz`: HTTP 503 with only `backup_unhealthy` and `catalog_unready`.

## Remaining production admission work

1. Complete a real encrypted off-host database backup and isolated restore, then attach accepted evidence.
2. Load the approved cleanser, treatment, moisturizer, and sunscreen catalog and independently approve the ingredient rules.
3. Configure and reconcile approved Stripe prices and terms before enabling payments or subscription enrollment.
4. Authenticate Expo/EAS, configure the public production URL environment, create the signed Android App Bundle, and complete store review evidence.

The readiness endpoint must remain fail-closed until the backup and catalog evidence is genuine. Subscription enrollment must remain closed until the Stripe configuration and release evidence are approved.
