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
  assert.equal((workflow.match(/docker\/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc/g) || []).length, 2);
  assert.equal((workflow.match(/actions\/attest@1e69f48acb82d1966a394da916b4c1698aa569d6/g) || []).length, 2);
  assert.match(workflow, /infra\/portal\/Dockerfile\.api/);
  assert.match(workflow, /infra\/portal\/Dockerfile\.web/);
  assert.match(workflow, /release-image-manifest\.mjs/);
  assert.match(workflow, /actions\/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9/);
  assert.equal((workflow.match(/create-storage-record:\s*false/g) || []).length, 2);
});

test("every workflow action is pinned to a reviewed commit", () => {
  const uses = [...workflow.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
  assert.ok(uses.length >= 8);
  assert.ok(uses.every((value) => /@[a-f0-9]{40}$/.test(value)));
});
