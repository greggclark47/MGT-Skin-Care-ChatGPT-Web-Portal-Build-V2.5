// Executes every portal contract test in a deterministic order.
// Keeping discovery here prevents newly added release-control tests from being
// omitted from the local checkpoint or hosted verification workflow.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const testDirectory = path.join(root, "infra", "portal");
const tests = fs.readdirSync(testDirectory)
  .filter((name) => name.endsWith(".test.mjs"))
  .sort()
  .map((name) => path.join("infra", "portal", name));

if (!tests.length) {
  console.error("No portal contract tests were found.");
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ["--test", ...tests], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true
  });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
