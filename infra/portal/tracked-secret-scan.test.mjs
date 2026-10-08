import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { scanGitCommit, scanText } from "./tracked-secret-scan.mjs";

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
  const privateKeyHeader = ["-----BEGIN ", "PRIVATE KEY-----"].join("");
  const databaseUrl = ["postgresql://owner:", "actual-password", "@db.internal/app"].join("");
  const tokenAssignment = ["NOTIFICATION_WEBHOOK_TOKEN", "=", "production-token-material"].join("");
  const findings = scanText([
    privateKeyHeader,
    databaseUrl,
    tokenAssignment
  ].join("\n"));
  assert.deepEqual(new Set(findings.map((finding) => finding.rule)), new Set(["private_key", "credentialed_database_url", "sensitive_assignment"]));
});

test("scans the candidate commit rather than a sanitized working tree", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-secret-commit-"));
  const secretName = ["STRIPE", "SECRET", "KEY"].join("_");
  const secret = [`${secretName}=sk_live_`, "x".repeat(24)].join("");
  fs.writeFileSync(path.join(root, "config.txt"), `${secret}\n`);
  for (const args of [
    ["init", "-q"],
    ["add", "."],
    ["-c", "user.name=MGT Test", "-c", "user.email=test@invalid.local", "commit", "-qm", "fixture"]
  ]) assert.equal(spawnSync("git", args, { cwd: root, windowsHide: true }).status, 0);
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true }).stdout.trim();
  fs.writeFileSync(path.join(root, "config.txt"), `${secretName}=\n`);
  const findings = scanGitCommit(root, commit);
  assert.ok(findings.some((finding) => finding.file === "config.txt" && finding.rule === "stripe_secret_key"));
  assert.equal(JSON.stringify(findings).includes(secret), false);
});
