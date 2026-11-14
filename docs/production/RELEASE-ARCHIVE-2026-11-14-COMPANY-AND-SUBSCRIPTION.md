# Team47Studio release archive — 2026-11-14

Candidate branch: `codex/reconcile-main-2026-09-20`  
Candidate source commit before this archive: `4ac9f09`  
Archive class: source, local-verification, and release-hold record only

## Included major updates

- Refreshed the Team47Studio landing, care, support, partner, company, and mobile experience copy.
- Standardized the shared membership model as Free, Guided, and Studio; added an explicit Free entry path; preserved end-of-period changes and eligible annual-upgrade credit behavior.
- Added review-gated Stripe subscription readiness controls, secret-reference-only configuration, and asynchronous Checkout event handling.
- Moved Company from primary navigation to the footer on every portal page.
- Updated the public leadership profile to **Gregg Clark — Co-Founder · Owner · Operator**. Public CEO, CTO, and CFO title language is absent from the portal source.

## Local verification

- Portal production build passed after the Company-navigation/profile update.
- Mobile type and membership-contract checks passed after the three-tier update.
- Subscription readiness gate passed.
- Focused billing regression, including delayed Checkout-event coverage, passed.
- Full application regression passed: 40 sequential test groups.
- Credential scan passed.

## Current production hold

This archive does not authorize deployment. `team47studio.com` remains governed by the existing production hold because real backup/restore evidence, approved catalog evidence, secure target configuration, production Supabase/RLS evidence, deployed accessibility evidence, provider-side Stripe setup, and named release approvals are incomplete.

Subscriptions remain disabled, no Stripe secret or price identifier is included here, and no payment enrollment, DNS/TLS, database, or traffic action is recorded by this archive.

## Backup references

- GitHub repository: `greggclark47/MGT-Skin-Care-ChatGPT-Web-Portal-Build-V2.5`
- Branch: `codex/reconcile-main-2026-09-20`
- Related production tracker: `docs/PROJECT-TODO-2026-11-14.md`
- Related activation guide: `infra/portal/STRIPE-ACCOUNT-DEPLOYMENT-REVIEW.md`
