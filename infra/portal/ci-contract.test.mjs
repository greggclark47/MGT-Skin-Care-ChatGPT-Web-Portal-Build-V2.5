import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/verification.yml", import.meta.url), "utf8");

test("continuous verification is triggered for review and protected branch changes", () => {
  assert.match(workflow, /^\s*pull_request:\s*$/m);
  assert.match(workflow, /^\s*push:\s*$/m);
  assert.match(workflow, /^\s*- main\s*$/m);
});

test("continuous verification is read-only and runs the local release gate", () => {
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /pnpm install --frozen-lockfile/);
  assert.match(workflow, /pnpm test:infra && pnpm test:compose-contract && pnpm test:lineage/);
  assert.match(workflow, /pnpm test:verification/);
  assert.doesNotMatch(workflow, /^\s*run:\s*.*\b(?:deploy|publish)\b/im);
  assert.doesNotMatch(workflow, /^\s*secrets\s*:/m);
});

test("pnpm is installed before setup-node configures its store cache", () => {
  const packageManager = workflow.indexOf("uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413");
  const nodeCache = workflow.indexOf("uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020");
  assert.ok(packageManager >= 0);
  assert.ok(nodeCache > packageManager);
  assert.match(workflow, /version:\s*9\.0\.0/);
  assert.match(workflow, /cache:\s*pnpm/);
});

test("third-party workflow actions are pinned to reviewed commits", () => {
  const uses = [...workflow.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)].map((match) => match[1]);
  assert.ok(uses.length >= 3);
  assert.ok(uses.every((value) => /@[a-f0-9]{40}$/.test(value)));
});
