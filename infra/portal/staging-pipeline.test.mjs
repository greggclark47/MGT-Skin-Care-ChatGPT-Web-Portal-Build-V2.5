import assert from "node:assert/strict";
import test from "node:test";
import { validateStagingAttestation } from "./staging-attestation.mjs";
import { runStagingProbe, validateStagingProbe } from "./staging-probe.mjs";
import { validateStagingTarget } from "./staging-target.mjs";

const candidateCommit = "a".repeat(40);
const images = {
  node: `node@sha256:${"c".repeat(64)}`,
  api: `ghcr.io/mgt/api@sha256:${"d".repeat(64)}`,
  web: `ghcr.io/mgt/web@sha256:${"e".repeat(64)}`,
  ollama: `ollama/ollama@sha256:${"a".repeat(64)}`,
  caddy: `caddy@sha256:${"b".repeat(64)}`
};
const origin = "https://staging.mgtskincare.test";
const target = {
  version: "1.0",
  environment: "staging",
  candidate_commit: candidateCommit,
  origin,
  deployment_reference: "work/staging/2026-09-30/deployment.md",
  isolation_reference: "work/staging/2026-09-30/isolation.md",
  secret_injection_reference: "work/staging/2026-09-30/secret-injection.md",
  images
};

function response(status, body) {
  return { status, json: async () => body };
}

test("records a safe health and readiness probe without retaining response bodies", async () => {
  let tick = Date.parse("2026-09-30T00:00:00.000Z");
  const probe = await runStagingProbe({
    origin,
    now: () => (tick += 5),
    fetchImpl: async (url) => response(200, url.endsWith("/healthz") ? { status: "ok", internal: "not-retained" } : { status: "ok", storage: "postgres" })
  });
  assert.equal(probe.status, "pass");
  assert.equal(JSON.stringify(probe).includes("not-retained"), false);
  assert.equal(validateStagingProbe(probe, { origin }).ok, true);
});

test("rejects a failed probe and conflicting target or attestation", async () => {
  const failed = await runStagingProbe({ origin, fetchImpl: async () => response(503, { status: "not_ready" }) });
  assert.equal(failed.status, "fail");
  assert.equal(validateStagingProbe(failed, { origin }).ok, false);

  const targetResult = validateStagingTarget({ ...target, candidate_commit: "b".repeat(40), secret_injection_reference: "postgresql://user:password@db.example" }, { candidateCommit, images });
  assert.equal(targetResult.ok, false);
  assert.ok(targetResult.errors.some((error) => error.includes("candidate_commit must match")));
  assert.ok(targetResult.errors.some((error) => error.includes("credential-like")));

  const attestation = {
    version: "1.0",
    candidate_commit: candidateCommit,
    target_origin: origin,
    images,
    generated_at: "2026-09-30T00:00:00.000Z",
    status: "pass",
    preflight: { status: "pass", reference: "work/staging/2026-09-30/preflight.md", checksum: `sha256:${"e".repeat(64)}` },
    probe: { status: "pass", reference: "work/staging/2026-09-30/probe.json", checksum: `sha256:${"f".repeat(64)}` }
  };
  assert.equal(validateStagingAttestation(attestation, { candidateCommit, origin, images }).ok, true);
  assert.equal(validateStagingAttestation({ ...attestation, images: { ...images, node: "node:latest" } }, { candidateCommit, origin, images }).ok, false);
});
