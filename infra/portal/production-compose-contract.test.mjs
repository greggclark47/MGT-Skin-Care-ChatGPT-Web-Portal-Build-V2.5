import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compose = readFileSync(new URL("./compose.production.yaml", import.meta.url), "utf8");

test("production runtime uses only digest-pinned deployable images", () => {
  assert.equal((compose.match(/image: \$\{API_IMAGE:\?Set the approved immutable API image digest\}/g) || []).length, 2);
  assert.equal((compose.match(/image: \$\{WEB_IMAGE:\?Set the approved immutable web image digest\}/g) || []).length, 1);
  assert.equal((compose.match(/pull_policy: always/g) || []).length, 5);
  assert.doesNotMatch(compose, /^\s+build:/m);
});

test("production runtime exposes only the TLS edge", () => {
  assert.equal((compose.match(/^\s+ports:/gm) || []).length, 1);
  assert.match(compose, /ports:\s*\n\s+- "80:80"\s*\n\s+- "443:443"/);
  assert.equal((compose.match(/^\s+expose:/gm) || []).length, 2);
});

test("production runtime keeps migrations manual and local AI opt-in", () => {
  assert.equal((compose.match(/PORTAL_AUTO_MIGRATE: "false"/g) || []).length, 2);
  assert.match(compose, /ollama:\s*\n\s+image:[\s\S]*?profiles: \["local-ai"\]/);
  assert.match(compose, /OLLAMA_ENABLED: \$\{OLLAMA_ENABLED:\?Set the reviewed Ollama enablement\}/);
  assert.match(compose, /OPENCLAW_ENABLED: \$\{OPENCLAW_ENABLED:\?Set the reviewed OpenClaw enablement\}/);
  assert.match(compose, /OLLAMA_BASE_URL: \$\{OLLAMA_BASE_URL:-\}/);
  assert.match(compose, /OPENCLAW_BASE_URL: \$\{OPENCLAW_BASE_URL:-\}/);
  assert.match(compose, /OPENCLAW_API_MODE: \$\{OPENCLAW_API_MODE:-\}/);
  assert.doesNotMatch(compose, /OLLAMA_BASE_URL: \$\{OLLAMA_BASE_URL:-http:\/\/ollama:11434\}/);
  assert.doesNotMatch(compose, /OPENCLAW_BASE_URL: \$\{OPENCLAW_BASE_URL:-http:\/\/ollama:11434\}/);
  assert.doesNotMatch(compose.slice(compose.indexOf("  api:"), compose.indexOf("  worker:")), /depends_on:\s*\n\s+ollama:/);
});

test("production application processes declare their mode and share the configured worker readiness window", () => {
  assert.equal((compose.match(/NODE_ENV: production/g) || []).length, 3);
  assert.equal((compose.match(/DEMO_MODE: "false"/g) || []).length, 2);
  assert.equal((compose.match(/WORKER_INTERVAL_SECONDS: \$\{WORKER_INTERVAL_SECONDS:\?Set the reviewed worker interval\}/g) || []).length, 2);
  assert.equal((compose.match(/WORKER_READINESS_MAX_AGE_SECONDS: \$\{WORKER_READINESS_MAX_AGE_SECONDS:\?Set the reviewed worker readiness age\}/g) || []).length, 2);
  assert.doesNotMatch(compose, /WORKER_(INTERVAL_SECONDS|READINESS_MAX_AGE_SECONDS): \$\{[^}]+:-/);
  assert.doesNotMatch(compose, /(?:OLLAMA|OPENCLAW)_ENABLED: \$\{[^}]+:-/);
  assert.match(compose, /Number\(a\)\*1000/);
  assert.doesNotMatch(compose, /WORKER_HEALTH_FILE\|\|/);
});

test("production runtime applies reduced privileges, health gates, and bounded resources", () => {
  assert.equal((compose.match(/<<: \*application-runtime/g) || []).length, 3);
  assert.equal((compose.match(/no-new-privileges:true/g) || []).length, 3);
  assert.equal((compose.match(/cap_drop:\s*\n\s+- ALL/g) || []).length, 3);
  assert.equal((compose.match(/pids_limit:/g) || []).length, 3);
  assert.equal((compose.match(/mem_limit:/g) || []).length, 5);
  assert.match(compose, /api:\s*[\s\S]*?healthcheck:/);
  assert.match(compose, /worker:\s*[\s\S]*?WORKER_HEALTH_FILE:[\s\S]*?healthcheck:/);
  assert.match(compose, /web:\s*[\s\S]*?condition: service_healthy/);
  assert.match(compose, /edge:\s*[\s\S]*?condition: service_healthy/);
});
