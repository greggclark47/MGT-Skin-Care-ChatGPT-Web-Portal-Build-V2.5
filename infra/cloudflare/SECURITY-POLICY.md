# Cloudflare production edge policy

This folder owns authoritative DNS and DNSSEC. Account- and plan-dependent WAF
controls remain an explicit dashboard/API approval because Terraform must not
guess a Cloudflare plan or silently enable rules that could block Stripe,
Supabase OAuth, Google certificate issuance, accessibility tools, or support.

Apply these controls in staging before production:

1. SSL/TLS mode: **Full (strict)** after the Google-managed origin certificate is active.
2. Always Use HTTPS: enabled; minimum TLS 1.2; TLS 1.3 enabled.
3. Managed WAF: Cloudflare Managed Ruleset and OWASP rules in log mode first.
4. Rate limits: login, session creation, password recovery, image upload, AI requests,
   checkout creation and administrative routes. Exempt verified Stripe webhook requests
   only after application signature validation is confirmed.
5. Bot controls: challenge abusive automation, not ordinary accessibility tooling.
6. Turnstile: registration, account recovery and high-risk support submissions.
7. Cache bypass: `/api/*`, `/webhooks/*`, authenticated account pages and responses
   containing `Set-Cookie`. Cache only versioned public assets.
8. Origin protection: never publish a Cloud Run URL. The Google load balancer is the
   only origin, and Cloud Run ingress remains restricted to load balancing.
9. Security headers: retain the application headers; do not create conflicting edge
   copies unless the application test suite is updated at the same time.
10. Logging: redact cookies, authorization values, query-string tokens and uploaded
    image bodies before any export.

The initial Cloudflare apply intentionally uses DNS-only records so Google can issue
the managed certificate. Enable proxying only after both apex and `www` are active.
