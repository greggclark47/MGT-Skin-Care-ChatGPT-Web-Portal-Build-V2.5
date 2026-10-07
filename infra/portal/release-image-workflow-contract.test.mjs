import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/release-images.yml", import.meta.url), "utf8");

test("image publication is manual, immutable, and least-privilege", () => {
  assert.match(workflow, /^\s*workflow_dispatch:\s*$/m);
  assert.doesNotMatch(workflow, /^\s*(?:push|pull_request|schedule):\s*$/m);
  assert.match(workflow, /packages:\s*write/);
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /NODE_IMAGE must be an approved immutable digest/);
  assert.doesNotMatch(workflow, /:latest\b/);
});

test("publishes, attests, and records both application images", () => {
  assert.equal((workflow.match(/docker\/build-push-action@v6/g) || []).length, 2);
  assert.equal((workflow.match(/actions\/attest-build-provenance@v2/g) || []).length, 2);
  assert.match(workflow, /infra\/portal\/Dockerfile\.api/);
  assert.match(workflow, /infra\/portal\/Dockerfile\.web/);
  assert.match(workflow, /release-image-manifest\.mjs/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
});
