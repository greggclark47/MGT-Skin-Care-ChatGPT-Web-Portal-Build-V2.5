import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const checkpoint = readFileSync(new URL("./local-checkpoint.cjs", import.meta.url), "utf8");
const prerequisites = readFileSync(new URL("./production-prerequisites.mjs", import.meta.url), "utf8");

test("deployment commands require injected runtime context instead of a repository-adjacent shared dotenv", () => {
  for (const name of ["infra:preflight", "infra:readiness", "infra:ship-packet", "infra:create-ship-packet", "infra:database-audit"]) {
    assert.ok(packageJson.scripts[name]);
    assert.doesNotMatch(packageJson.scripts[name], /--env-file-if-exists=infra\/portal\/\.env/);
  }
  assert.equal(packageJson.scripts["infra:secret-injection-admission"], "node infra/portal/secret-injection-admission.mjs");
  assert.match(checkpoint, /MGT_DEPLOYMENT_VALIDATION_ENV_FILE/);
  assert.doesNotMatch(checkpoint, /infra\/portal\/\.env/);
  assert.match(checkpoint, /approved secret-manager workflow/);
  assert.doesNotMatch(prerequisites, /infra\/portal\/\.env/);
  assert.match(prerequisites, /PRIVATE_DEPLOYMENT_VALIDATION_ENV/);
});
