import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceFiles = {
  plans: "apps/api/src/portal/plans.ts",
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
  const catalog = plans.match(/export const PLAN_DEFINITIONS[\s\S]*?\] as const;/)?.[0] ?? "";
  const planIds = [...catalog.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]);

  add(
    "premium_catalog",
    planIds.length === 1 && planIds[0] === "premium" && /env_prefix:\s*'PREMIUM'/.test(catalog),
    "The published catalog must contain exactly one Premium plan with the PREMIUM price prefix.",
  );
  add(
    "premium_price_contract",
    ["STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_ANNUAL_PRICE_ID"].every((key) => source("preflight").includes(key))
      && !source("preflight").includes("STRIPE_PREMIUM_PRICE_ID"),
    "Production preflight must require the monthly and annual Premium Price IDs, never a retired single-price variable.",
  );

  const server = source("server");
  const disclosureCalls = (server.match(/requireAiDisclosure\(/g) || []).length;
  add(
    "durable_ai_disclosure",
    server.includes("AI_DISCLOSURE_VERSION")
      && server.includes("captured_at")
      && server.includes("revoked_at")
      && server.includes("version===AI_DISCLOSURE_VERSION")
      && server.includes("granted===true")
      && server.includes("!disclosure.revoked_at")
      && disclosureCalls >= 3
      && !server.includes("ai_consent"),
    "Reviewed customer and operator analysis must require a current, durable AI disclosure; request-body consent cannot bypass it.",
  );
  add(
    "deferred_partner_surface",
    server.includes("feature_deferred")
      && ["/api/hub/partners", "/api/hub/admin/partner", "/api/hub/admin/payout"].every((route) => server.includes(route)),
    "Partner onboarding and payout APIs must remain explicitly deferred until their release evidence is approved.",
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
