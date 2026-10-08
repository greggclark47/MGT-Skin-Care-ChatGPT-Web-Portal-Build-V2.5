import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const compose = readFileSync(new URL("./compose.yaml", import.meta.url), "utf8");
const apiDockerfile = readFileSync(new URL("./Dockerfile.api", import.meta.url), "utf8");
const webDockerfile = readFileSync(new URL("./Dockerfile.web", import.meta.url), "utf8");
const caddyfile = readFileSync(new URL("./Caddyfile", import.meta.url), "utf8");

test("compose keeps container images immutable and configurable", () => {
  assert.match(compose, /image: \$\{OLLAMA_IMAGE:\?Set the approved Ollama image digest\}/);
  assert.match(compose, /image: \$\{CADDY_IMAGE:\?Set the approved Caddy image digest\}/);
  assert.doesNotMatch(compose, /ollama\/ollama:(latest|\w+)/);
  assert.doesNotMatch(compose, /caddy:\d/);
});

test("compose exposes controlled local compute sync and persistent edge config", () => {
  assert.match(compose, /model-sync:/);
  assert.match(compose, /profiles: \["model-sync"\]/);
  assert.match(compose, /ollama pull/);
  assert.match(compose, /OLLAMA_NUM_PARALLEL/);
  assert.match(compose, /caddy_config:\/config/);
  assert.match(compose, /caddy.*validate/s);
  assert.match(compose, /OLLAMA_ENABLED: \$\{OLLAMA_ENABLED:-false\}/);
  assert.doesNotMatch(compose, /OLLAMA_ENABLED: "true"/);
  const apiBlock = compose.slice(compose.indexOf("  api:"), compose.indexOf("  worker:"));
  assert.doesNotMatch(apiBlock, /depends_on:\s*\n\s+ollama:/);
});

test("application images consume the immutable Node build input", () => {
  assert.equal((compose.match(/NODE_IMAGE:\s+\$\{NODE_IMAGE:\?Set the approved Node image digest\}/g) || []).length, 3);
  assert.match(apiDockerfile, /ARG NODE_IMAGE\s+FROM \$\{NODE_IMAGE\}/);
  assert.match(webDockerfile, /ARG NODE_IMAGE\s+FROM \$\{NODE_IMAGE\}/);
  assert.match(apiDockerfile, /CMD \["sh","-c","node \/app\/infra\/portal\/preflight\.mjs && exec node dist\/portal\/server\.js"\]/);
  assert.match(compose, /command: \["sh", "-c", "node \/app\/infra\/portal\/preflight\.mjs && exec node dist\/portal\/worker\.js"\]/);
});

test("edge applies browser security policy and suppresses server identity", () => {
  assert.match(caddyfile, /Strict-Transport-Security "max-age=31536000; includeSubDomains"/);
  assert.match(caddyfile, /Content-Security-Policy "[^"]*default-src 'self'/);
  assert.match(caddyfile, /Content-Security-Policy "[^"]*object-src 'none'/);
  assert.match(caddyfile, /Content-Security-Policy "[^"]*frame-ancestors 'none'/);
  assert.match(caddyfile, /X-Frame-Options "DENY"/);
  assert.match(caddyfile, /Cross-Origin-Opener-Policy "same-origin"/);
  assert.match(caddyfile, /Cross-Origin-Resource-Policy "same-origin"/);
  assert.equal((caddyfile.match(/header_up X-MGT-Client-IP \{remote_host\}/g) || []).length, 2);
  assert.match(caddyfile, /-Server/);
});

test("application containers use a read-only reduced-privilege runtime", () => {
  assert.equal((compose.match(/read_only: true/g) || []).length, 4);
  assert.equal((compose.match(/no-new-privileges:true/g) || []).length, 4);
  assert.equal((compose.match(/cap_drop:\s*\n\s*- ALL/g) || []).length, 4);
  assert.equal((compose.match(/\/tmp:rw,noexec,nosuid,size=64m/g) || []).length, 3);
  const edgeBlock = compose.slice(compose.indexOf("  edge:"), compose.lastIndexOf("\nvolumes:"));
  assert.match(edgeBlock, /\/tmp:rw,noexec,nosuid,size=32m/);
  assert.match(edgeBlock, /cap_add:\s*\n\s*- NET_BIND_SERVICE/);
});
