import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const plan = readFileSync(new URL("./FULL-SHIP-PLAN.md", import.meta.url), "utf8");

test("full ship plan contains the required publish controls", () => {
  for (const phrase of [
    "Candidate freeze",
    "Staging environment and data",
    "Support, accessibility and customer journeys",
    "Operations, backups and runtime qualification",
    "Final readiness packet and go/no-go",
    "Publish sequence",
    "Rollback and incident response",
    "Post-publish monitoring and closeout"
  ]) assert.match(plan, new RegExp(phrase));
});

test("full ship plan keeps deployment fail-closed", () => {
  assert.match(plan, /pnpm infra:readiness -- --require-ready/);
  assert.match(plan, /pnpm release:checkpoint -- --require-production/);
  assert.match(plan, /PORTAL_AUTO_MIGRATE=false/);
  assert.match(plan, /Do not use floating tags/);
  assert.match(plan, /Do not reverse database migrations automatically/);
});

test("full ship plan names every readiness evidence flag", () => {
  for (const key of [
    "SUPPORT_WORKFLOW",
    "ACCESSIBILITY_DEPLOYED",
    "DATABASE_RLS",
    "BACKUP_RESTORE",
    "STRIPE_SANDBOX",
    "CONTAINER_STARTUP",
    "AI_PROVIDER"
  ]) assert.match(plan, new RegExp(`RELEASE_EVIDENCE_${key}=true`));
});
