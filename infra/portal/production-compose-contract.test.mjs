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
  assert.match(compose, /OLLAMA_ENABLED: \$\{OLLAMA_ENABLED:-false\}/);
  assert.doesNotMatch(compose.slice(compose.indexOf("  api:"), compose.indexOf("  worker:")), /depends_on:\s*\n\s+ollama:/);
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
