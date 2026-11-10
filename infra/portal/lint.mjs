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

function run(command, args, label) {
  const executable = process.platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command;
  const result = spawnSync(executable, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32", windowsHide: true });
  if (result.status !== 0) {
    console.error(`Lint failed: ${label}`);
    process.exit(result.status || 1);
  }
}

for (const [directory, config] of projects) {
  const bin = path.join(root, directory, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
  if (!fs.existsSync(bin)) {
    console.error(`Lint failed: TypeScript compiler is missing for ${directory}.`);
    process.exit(1);
  }
  run(bin, ["-p", path.resolve(root, directory, config), "--noEmit"], `TypeScript ${directory}/${config}`);
}
run("pnpm", ["test:mobile-contract"], "mobile contract");
run("pnpm", ["test:strict-json"], "strict JSON contract");
run("pnpm", ["test:credential-scan"], "tracked credential scan");
run("git", ["diff", "--check"], "whitespace check");
console.log(`Lint passed: ${projects.length} TypeScript projects plus mobile and repository hygiene checks.`);
