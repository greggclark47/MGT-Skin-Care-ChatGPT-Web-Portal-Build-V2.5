import assert from "node:assert/strict";
import { test } from "node:test";
import { scanText } from "./tracked-secret-scan.mjs";

test("detects high-confidence credentials without returning their values", () => {
  const secret = `sk_live_${"a".repeat(24)}`;
  const findings = scanText(`prefix\nSTRIPE_SECRET_KEY=${secret}\n`);
  assert.ok(findings.some((finding) => finding.rule === "stripe_secret_key"));
  assert.ok(findings.some((finding) => finding.rule === "sensitive_assignment"));
  assert.equal(JSON.stringify(findings).includes(secret), false);
});

test("allows empty, indirect, and explicit fixture configuration", () => {
  const findings = scanText([
    "OPENAI_API_KEY=",
    "SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}",
    "STRIPE_SECRET_KEY=sk-test-value",
    '"SUPABASE_ANON_KEY": "anon-test-key"'
  ].join("\n"));
  assert.deepEqual(findings, []);
});

test("detects private keys, credentialed database URLs, and unknown sensitive assignments", () => {
  const findings = scanText([
    "-----BEGIN PRIVATE KEY-----",
    "postgresql://owner:actual-password@db.internal/app",
    "NOTIFICATION_WEBHOOK_TOKEN=production-token-material"
  ].join("\n"));
  assert.deepEqual(new Set(findings.map((finding) => finding.rule)), new Set(["private_key", "credentialed_database_url", "sensitive_assignment"]));
});
