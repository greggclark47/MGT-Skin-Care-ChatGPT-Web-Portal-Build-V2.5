import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const projects = [
  ["apps/api", "tsconfig.json"],
  ["apps/web", "tsconfig.json"],
  ["packages/ai-gateway", "tsconfig.json"],
  ["packages/analytics-sdk", "tsconfig.json"],
  ["packages/domain", "tsconfig.json"],
  ["packages/shared", "tsconfig.json"]
];

function run(command, args, label, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) {
    console.error(`Lint failed: ${label}`);
    process.exit(result.status || 1);
  }
}

for (const [directory, config] of projects) {
  const bin = path.join(root, directory, "node_modules", "typescript", "bin", "tsc");
  if (!fs.existsSync(bin)) {
    console.error(`Lint failed: TypeScript compiler is missing for ${directory}.`);
    process.exit(1);
  }
  run(process.execPath, [bin, "-p", config, "--noEmit"], `TypeScript ${directory}/${config}`, path.join(root, directory));
}
run(process.execPath, ["--test", "apps/mobile/test/contract.cjs", "apps/mobile/test/production-config.cjs"], "mobile contract");
run(process.execPath, ["--test", "infra/portal/strict-json.test.mjs"], "strict JSON contract");
run(process.execPath, ["--test", "infra/portal/tracked-secret-scan.test.mjs"], "tracked credential scan");
run("git", ["diff", "--check"], "whitespace check");
console.log(`Lint passed: ${projects.length} TypeScript projects plus mobile and repository hygiene checks.`);
