import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { productionPrerequisitesChecksum } from "./production-prerequisites.mjs";
import { buildProductionBuildSubmission, validateProductionBuildSubmission } from "./production-build-submission.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const EXTERNAL = [["hosting_target", "Production hosting account, domain, TLS, and edge routing"], ["database_target", "Production PostgreSQL/Supabase target with migration and RLS evidence"], ["secret_manager", "Approved secret-manager injection and rotation evidence"], ["backup_restore", "Encrypted off-host backup and verified restore transcript"], ["support_owner", "Named support owner, backup, route, and coverage window"], ["accessibility_report", "Deployed accessibility report for the production origin"], ["rollback_authority", "Named rollback authority and immutable rollback target"], ["launch_approval", "Named go/no-go decision and launch window"], ["github_receipt", "Observed GitHub destination receipt for the candidate"], ["drive_receipt", "Observed Google Drive destination receipt for the candidate"]];
function prerequisites(configuration = "blocked") {
  const document = { version: "1.0", candidate_commit: COMMIT, generated_at: "2026-01-01T00:00:00.000Z", status: configuration === "blocked" ? "blocked_on_configuration" : "blocked_on_external_prerequisites", local: { configuration: { status: configuration, error_codes: configuration === "blocked" ? ["PRODUCTION_FIELD_INVALID"] : [] } }, external: EXTERNAL.map(([id, requirement]) => ({ id, requirement, status: "pending_external_evidence" })) };
  return { ...document, prerequisites_checksum: productionPrerequisitesChecksum(document) };
}
test("creates a redacted, candidate-bound submission for blocked configuration", () => {
  const result = buildProductionBuildSubmission({ prerequisites: prerequisites(), now: "2026-01-02T00:00:00.000Z" });
  assert.equal(result.status, "blocked_on_production_inputs");
  assert.equal(result.implementation_now.length, 8);
  assert.equal(result.on_hold[0].id, "production_configuration");
  assert.deepEqual(result.on_hold[0].error_codes, ["PRODUCTION_FIELD_INVALID"]);
  assert.equal(validateProductionBuildSubmission(result, { now: Date.parse("2026-01-03T00:00:00.000Z") }).ok, true);
});
test("does not put ready configuration on hold", () => {
  const result = buildProductionBuildSubmission({ prerequisites: prerequisites("ready_for_live_validation"), now: "2026-01-02T00:00:00.000Z" });
  assert.equal(result.on_hold.some((item) => item.id === "production_configuration"), false);
  assert.equal(result.on_hold.length, 10);
});
test("rejects a tampered prerequisite packet or submission", () => {
  const packet = prerequisites(); packet.external[0].requirement = "unsafe replacement";
  packet.prerequisites_checksum = productionPrerequisitesChecksum(packet);
  assert.throws(() => buildProductionBuildSubmission({ prerequisites: packet }), /external requirements/);
  const result = buildProductionBuildSubmission({ prerequisites: prerequisites(), now: "2026-01-02T00:00:00.000Z" });
  result.implementation_now.pop();
  assert.equal(validateProductionBuildSubmission(result, { now: Date.parse("2026-01-03T00:00:00.000Z") }).ok, false);
});
test("CLI creates an evidence file without copying prerequisite values", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-production-submission-"));
  try {
    const input = path.join(root, "prerequisites.json"); const output = path.join(root, "submission.json");
    fs.writeFileSync(input, JSON.stringify(prerequisites()));
    const script = path.resolve("infra/portal/production-build-submission.mjs");
    const result = spawnSync(process.execPath, [script, "--prerequisites", input, "--output", output, "--generated-at", "2026-01-02T00:00:00.000Z"], { cwd: process.cwd(), encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(validateProductionBuildSubmission(JSON.parse(fs.readFileSync(output, "utf8")), { now: Date.parse("2026-01-03T00:00:00.000Z") }).ok, true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
