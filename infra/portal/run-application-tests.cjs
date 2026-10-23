// Runs application tests one process at a time so server-backed suites do not
// contend for ports, child-process startup, or shared local fixtures.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const apiDirectory = path.join(root, "apps", "api", "test");
const tests = fs.readdirSync(apiDirectory)
  .filter((name) => name.endsWith(".cjs"))
  .sort()
  .map((name) => path.join("apps", "api", "test", name));
tests.push(path.join("apps", "mobile", "test", "contract.cjs"));

if (!tests.length) {
  console.error("No application tests were found.");
  process.exitCode = 1;
} else {
  const failures = [];
  for (const test of tests) {
    console.log(`\n[application-test] ${test}`);
    const result = spawnSync(process.execPath, ["--test", "--test-reporter=spec", test], {
      cwd: root,
      stdio: "inherit",
      windowsHide: true
    });
    if (result.error || result.status !== 0) failures.push(test);
  }

  if (failures.length) {
    console.error(`\nApplication test failures: ${failures.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(`\nApplication tests passed sequentially: ${tests.length}`);
  }
}
