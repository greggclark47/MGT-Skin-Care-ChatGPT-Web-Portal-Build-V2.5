import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceFiles = {
  plans: "apps/api/src/portal/plans.ts",
  membership: "packages/shared/src/membership.ts",
  preflight: "infra/portal/preflight.mjs",
  server: "apps/api/src/portal/server.ts",
  coach: "apps/web/src/app/coach/page.tsx",
  support: "apps/web/src/app/support/page.tsx",
  adminAnalysis: "apps/web/src/app/admin/analysis/page.tsx",
  account: "apps/web/src/app/account/page.tsx",
  migration: "infra/db/migrations/0007_compliance_release_controls.sql",
};

export function readComplianceSources(root) {
  return Object.fromEntries(
    Object.entries(sourceFiles).map(([name, file]) => [name, readFileSync(path.join(root, file), "utf8")]),
  );
}

export function validateComplianceContract(sources) {
  const checks = [];
  const add = (id, ok, message) => checks.push({ id, ok, message });
  const source = (name) => typeof sources[name] === "string" ? sources[name] : "";
  const plans = source("plans");
  const membership = source("membership");
  const catalog = membership.match(/export const MEMBERSHIP_TIER_CONTENT[\s\S]*?\] as const;/)?.[0] ?? "";
  const planIds = [...catalog.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]);

  add(
    "membership_catalog",
    planIds.length === 3 && planIds[0] === "free" && planIds[1] === "premium" && planIds[2] === "studio"
      && plans.includes("MEMBERSHIP_TIER_CONTENT")
      && /env_prefix:\s*plan\.id\s*===\s*'premium'\s*\?\s*'PREMIUM'\s*:\s*'STUDIO'/.test(plans),
    "The shared cross-platform catalog must contain Free, Guided (the continuity-safe premium ID), and Studio while the API maps separate paid price prefixes.",
  );
  add(
    "premium_price_contract",
    ["STRIPE_LIVE_MODE", "STRIPE_PREMIUM_PRODUCT_ID", "STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_ANNUAL_PRICE_ID", "STRIPE_STUDIO_MONTHLY_PRICE_ID", "STRIPE_STUDIO_ANNUAL_PRICE_ID"].every((key) => source("preflight").includes(key))
      && !source("preflight").includes("STRIPE_PREMIUM_PRICE_ID"),
    "Production preflight must bind Stripe mode, the shared Product, and complete Guided and Studio price pairs, never a retired single-price variable.",
  );

  const server = source("server");
  const reviewedStart = server.indexOf("const reviewedAnswer");
  const reviewedEnd = server.indexOf("post('/coach'", reviewedStart);
  const reviewedRoute = reviewedStart >= 0 && reviewedEnd > reviewedStart ? server.slice(reviewedStart, reviewedEnd) : "";
  const answerCall = reviewedRoute.indexOf("coach.answer(");
  const disclosureBeforeAnswer = reviewedRoute.indexOf("requireAiDisclosure(");
  const disclosureAfterAnswer = reviewedRoute.indexOf("requireAiDisclosure(", answerCall + 1);
  const operatorStart = server.indexOf("post('/admin/ai/analyze'");
  const operatorEnd = server.indexOf("get('/admin/ai/reservations'", operatorStart);
  const operatorRoute = operatorStart >= 0 && operatorEnd > operatorStart ? server.slice(operatorStart, operatorEnd) : "";
  add(
    "durable_ai_disclosure",
    server.includes("AI_DISCLOSURE_VERSION")
      && server.includes("captured_at")
      && server.includes("revoked_at")
      && server.includes("version===AI_DISCLOSURE_VERSION")
      && server.includes("granted===true")
      && server.includes("!disclosure.revoked_at")
      && disclosureBeforeAnswer >= 0
      && answerCall > disclosureBeforeAnswer
      && disclosureAfterAnswer > answerCall
      && operatorRoute.includes("requireAiDisclosure(")
      && !server.includes("ai_consent"),
    "Reviewed customer analysis must check durable disclosure before and after generation, operator analysis must check it before use, and request-body consent cannot bypass it.",
  );
  add(
    "deferred_partner_surface",
    server.includes("feature_deferred")
      && ["/api/hub/partners", "/api/hub/admin/partner", "/api/hub/admin/payout"].every((route) => server.includes(route))
      && !["stripe.accounts.", "stripe.accountLinks.", "stripe.transfers.", "stripe.refunds."].some((operation) => server.includes(operation))
      && !["post('/partners/onboard'", "get('/partners/me'", "post('/admin/partner/approve'", "post('/admin/payout'", "post('/admin/refund'", "post('/admin/fulfill'"].some((route) => server.includes(route)),
    "Partner, fulfillment, refund, connected-account, and payout APIs must remain explicitly deferred and absent from the compiled server until their release evidence is approved.",
  );
  add(
    "retired_billing_paths_removed",
    !server.includes("STRIPE_PREMIUM_PRICE_ID")
      && !["post('/checkout'", "post('/membership/checkout'", "post('/membership/portal'", "post('/webhooks/stripe'"]
        .some((route) => server.includes(route)),
    "Retired product-checkout and single-price billing handlers must not remain compiled beside the Premium billing module.",
  );

  const hasConsentBefore = (name, request) => {
    const page = source(name);
    return page.indexOf("hub('/account/consents'") >= 0
      && page.indexOf("hub('/account/consents'") < page.indexOf(request);
  };
  add(
    "customer_consent_controls",
    source("account").includes("hub('/account/consents'")
      && hasConsentBefore("coach", "hub('/coach'")
      && hasConsentBefore("support", "hub('/assistant'")
      && hasConsentBefore("adminAnalysis", "hub('/admin/ai/analyze'"),
    "Account, Coach, Support, and operator analysis controls must save the disclosure before a reviewed request.",
  );

  const migration = source("migration");
  add(
    "database_compliance_controls",
    [
      "consents_one_active_type_per_user",
      "alter table consents enable row level security",
      "create policy consents_owner_read",
      "prevent_mutation",
      "skin_match_answers",
      "subscription_events",
      "append-only",
    ].every((term) => migration.includes(term)),
    "The compliance migration must enforce active-consent uniqueness, consent RLS, and append-only audit targets.",
  );

  const errors = checks.filter((check) => !check.ok).map(({ id, message }) => `${id}: ${message}`);
  return { ok: errors.length === 0, checks, errors };
}

export function validateComplianceRepository(root) {
  return validateComplianceContract(readComplianceSources(root));
}

const entrypoint = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href;
if (entrypoint === import.meta.url) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const result = validateComplianceRepository(root);
  for (const check of result.checks) console.log(`${check.ok ? "PASS" : "FAIL"} ${check.id}: ${check.message}`);
  process.exitCode = result.ok ? 0 : 1;
}
