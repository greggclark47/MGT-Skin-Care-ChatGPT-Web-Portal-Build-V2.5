import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HIGH_CONFIDENCE = Object.freeze([
  ["stripe_secret_key", /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g],
  ["stripe_webhook_secret", /\bwhsec_[A-Za-z0-9]{16,}\b/g],
  ["openai_project_key", /\bsk-proj-[A-Za-z0-9_-]{16,}\b/g],
  ["github_token", /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g],
  ["aws_access_key", /\bAKIA[0-9A-Z]{16}\b/g],
  ["private_key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["credentialed_database_url", /postgres(?:ql)?:\/\/[^\s:@/]+:[^\s@/]+@/gi]
]);
const SENSITIVE_NAME = "(?:OPENAI_API_KEY|SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|NOTIFICATION_WEBHOOK_TOKEN)";
const ASSIGNMENT = new RegExp("\\b(" + SENSITIVE_NAME + ")[ \\t]*=[ \\t]*([^\\s`]+)", "gi");
const JSON_ASSIGNMENT = new RegExp(`["'](${SENSITIVE_NAME})["']\\s*:\\s*["']([^"']+)["']`, "gi");
const SAFE_MARKER = /^(?:["']?)(?:|false|null|undefined|REPLACE(?:_WITH)?\S*|YOUR[_-]\S*|<[^>]+>|\$\{[^}]+\}|process\.env\..+|env\..+)(?:["']?)$/i;
const SAFE_IDENTIFIER = /^[A-Z][A-Z0-9_]*$/;
const FIXTURE_MARKER = /(?:example|dummy|fake|not-for-evidence|not-a-|test-value|anon-test-key|service-test-key)/i;
const DATABASE_FIXTURE = /postgres(?:ql)?:\/\/(?:USER|u|mgt|user):(?:PASSWORD|p|secure|password)@/i;

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

function normalizedValue(value) {
  return String(value || "").trim().replace(/^["']|["';,]$/g, "");
}

export function scanText(text) {
  const findings = [];
  for (const [rule, pattern] of HIGH_CONFIDENCE) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (rule === "credentialed_database_url" && DATABASE_FIXTURE.test(match[0])) continue;
      findings.push({ rule, line: lineNumber(text, match.index || 0) });
    }
  }
  for (const pattern of [ASSIGNMENT, JSON_ASSIGNMENT]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = normalizedValue(match[2]);
      if (!SAFE_MARKER.test(value) && !SAFE_IDENTIFIER.test(value) && !FIXTURE_MARKER.test(value)) findings.push({ rule: "sensitive_assignment", line: lineNumber(text, match.index || 0) });
    }
  }
  return findings;
}

export function trackedFiles(root) {
  const result = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "buffer", windowsHide: true });
  if (result.status !== 0) throw new Error("Unable to enumerate tracked files for credential scanning.");
  return result.stdout.toString("utf8").split("\0").filter(Boolean);
}

export function scanTrackedSource(root) {
  const findings = [];
  for (const relative of trackedFiles(root)) {
    const absolute = path.resolve(root, relative);
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.size > 10 * 1024 * 1024) continue;
    const content = fs.readFileSync(absolute);
    if (content.includes(0)) continue;
    for (const finding of scanText(content.toString("utf8"))) findings.push({ file: relative.replaceAll("\\", "/"), ...finding });
  }
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
  try {
    const findings = scanTrackedSource(root);
    if (findings.length) {
      console.error(`FAIL tracked source credential scan: ${findings.length} potential credential finding(s).`);
      for (const finding of findings) console.error(`${finding.file}:${finding.line} [${finding.rule}]`);
      process.exitCode = 2;
    } else {
      console.log(`PASS tracked source credential scan: ${trackedFiles(root).length} tracked files checked; no high-confidence credential material found.`);
    }
  } catch (error) {
    console.error(`Unable to scan tracked source: ${error.message}`);
    process.exitCode = 1;
  }
}
