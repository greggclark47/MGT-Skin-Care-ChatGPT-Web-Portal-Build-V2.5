import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compose = readFileSync(new URL("./compose.production.yaml", import.meta.url), "utf8");

test("production runtime requires a unique stage-scoped Compose project identifier", () => {
  assert.match(compose, /^name: \$\{MGT_COMPOSE_PROJECT_NAME:\?Set a unique stage-scoped Compose project identifier\}$/m);
});

test("production runtime uses only digest-pinned deployable images", () => {
  assert.equal((compose.match(/image: \$\{API_IMAGE:\?Set the approved immutable API image digest\}/g) || []).length, 2);
  assert.equal((compose.match(/image: \$\{WEB_IMAGE:\?Set the approved immutable web image digest\}/g) || []).length, 1);
  assert.equal((compose.match(/pull_policy: always/g) || []).length, 5);
  assert.doesNotMatch(compose, /^\s+build:/m);
});

test("production runtime exposes only the TLS edge", () => {
  assert.equal((compose.match(/^\s+ports:/gm) || []).length, 1);
  assert.match(compose, /ports:\s*\n\s+- "\$\{MGT_EDGE_HTTP_PORT:\?Set the stage-scoped edge HTTP host port\}:80"\s*\n\s+- "\$\{MGT_EDGE_HTTPS_PORT:\?Set the stage-scoped edge HTTPS host port\}:443"/);
  assert.equal((compose.match(/^\s+expose:/gm) || []).length, 2);
});

test("production runtime materializes configuration and secrets per workload without a shared dotenv anchor", () => {
  const applicationRuntime = compose.slice(compose.indexOf("x-application-runtime:"), compose.indexOf("x-api-runtime-input:"));
  const apiBlock = compose.slice(compose.indexOf("  api:"), compose.indexOf("  worker:"));
  const workerBlock = compose.slice(compose.indexOf("  worker:"), compose.indexOf("  web:"));
  const webBlock = compose.slice(compose.indexOf("  web:"), compose.indexOf("  edge:"));
  const edgeBlock = compose.slice(compose.indexOf("  edge:"), compose.indexOf("  ollama:"));

  assert.doesNotMatch(compose, /env_file:\s*\.env/);
  assert.doesNotMatch(applicationRuntime, /env_file:/);
  assert.equal((compose.match(/^\s+env_file:/gm) || []).length, 3);
  assert.equal((compose.match(/^\s+- \$\{(?:API|WORKER|EDGE)_RUNTIME_(?:CONFIG|SECRETS)_FILE:/gm) || []).length, 6);
  assert.doesNotMatch(compose, /MGT_EDGE_TOKEN:/);
  assert.doesNotMatch(compose, /DATABASE_URL:/);
  assert.match(apiBlock, /<<: \[\*application-runtime, \*api-runtime-input\]/);
  assert.match(workerBlock, /<<: \[\*application-runtime, \*worker-runtime-input\]/);
  assert.match(edgeBlock, /<<: \*edge-runtime-input/);
  assert.match(compose, /API_RUNTIME_CONFIG_FILE:\?Set the noncommitted API non-secret runtime configuration path/);
  assert.match(compose, /WORKER_RUNTIME_CONFIG_FILE:\?Set the noncommitted worker non-secret runtime configuration path/);
  assert.match(compose, /EDGE_RUNTIME_CONFIG_FILE:\?Set the noncommitted edge non-secret runtime configuration path/);
  assert.match(compose, /API_RUNTIME_SECRETS_FILE:\?Set the noncommitted API secret materialization path from the approved secret manager/);
  assert.match(compose, /WORKER_RUNTIME_SECRETS_FILE:\?Set the noncommitted worker secret materialization path from the approved secret manager/);
  assert.match(compose, /EDGE_RUNTIME_SECRETS_FILE:\?Set the noncommitted edge secret materialization path from the approved secret manager/);
  assert.doesNotMatch(webBlock, /env_file:/);
  assert.match(webBlock, /PORTAL_API_ORIGIN: http:\/\/api:3100/);
  assert.doesNotMatch(webBlock, /(?:DATABASE_URL|MGT_EDGE_TOKEN|SUPABASE|STRIPE|WEBHOOK_TOKEN)/);
});

test("production runtime keeps migrations manual and local AI opt-in", () => {
  assert.equal((compose.match(/PORTAL_AUTO_MIGRATE: "false"/g) || []).length, 2);
  assert.match(compose, /ollama:\s*\n\s+image:[\s\S]*?profiles: \["local-ai"\]/);
  assert.doesNotMatch(compose, /(?:OLLAMA|OPENCLAW)_(?:ENABLED|BASE_URL|API_MODE): \$\{/);
  assert.doesNotMatch(compose, /PORTAL_DOMAIN: \$\{/);
  assert.doesNotMatch(compose.slice(compose.indexOf("  api:"), compose.indexOf("  worker:")), /depends_on:\s*\n\s+ollama:/);
});

test("production application processes declare their role while runtime configuration remains role-scoped", () => {
  const apiBlock = compose.slice(compose.indexOf("  api:"), compose.indexOf("  worker:"));
  const workerBlock = compose.slice(compose.indexOf("  worker:"), compose.indexOf("  web:"));
  assert.equal((compose.match(/NODE_ENV: production/g) || []).length, 3);
  assert.equal((compose.match(/DEMO_MODE: "false"/g) || []).length, 2);
  assert.match(apiBlock, /PROCESS_ROLE: api/);
  assert.match(workerBlock, /PROCESS_ROLE: worker/);
  assert.doesNotMatch(compose, /WORKER_(INTERVAL_SECONDS|READINESS_MAX_AGE_SECONDS): \$\{/);
  assert.doesNotMatch(compose, /(?:OLLAMA|OPENCLAW)_ENABLED: \$\{/);
  assert.match(compose, /Number\(a\)\*1000/);
  assert.doesNotMatch(compose, /WORKER_HEALTH_FILE\|\|/);
});

test("production runtime applies reduced privileges, health gates, and bounded resources", () => {
  assert.equal((compose.match(/<<: (?:\*application-runtime|\[\*application-runtime, \*(?:api|worker)-runtime-input\])/g) || []).length, 3);
  assert.equal((compose.match(/no-new-privileges:true/g) || []).length, 3);
  assert.equal((compose.match(/cap_drop:\s*\n\s+- ALL/g) || []).length, 3);
  assert.equal((compose.match(/pids_limit:/g) || []).length, 3);
  assert.equal((compose.match(/mem_limit:/g) || []).length, 5);
  assert.match(compose, /api:\s*[\s\S]*?healthcheck:/);
  assert.match(compose, /worker:\s*[\s\S]*?WORKER_HEALTH_FILE:[\s\S]*?healthcheck:/);
  assert.match(compose, /web:\s*[\s\S]*?condition: service_healthy/);
  assert.match(compose, /edge:\s*[\s\S]*?condition: service_healthy/);
});
