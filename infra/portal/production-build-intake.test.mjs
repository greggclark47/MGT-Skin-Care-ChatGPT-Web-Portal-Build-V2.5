import test from "node:test";
import assert from "node:assert/strict";
import { buildProductionBuildSubmission } from "./production-build-submission.mjs";
import { productionPrerequisitesChecksum } from "./production-prerequisites.mjs";
import { buildProductionBuildIntake, productionBuildIntakeChecksum, validateProductionBuildIntake } from "./production-build-intake.mjs";

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const EXTERNAL = [["hosting_target", "Production hosting account, domain, TLS, and edge routing"], ["database_target", "Production PostgreSQL/Supabase target with migration and RLS evidence"], ["secret_manager", "Approved secret-manager injection and rotation evidence"], ["backup_restore", "Encrypted off-host backup and verified restore transcript"], ["support_owner", "Named support owner, backup, route, and coverage window"], ["accessibility_report", "Deployed accessibility report for the production origin"], ["policy_publication_approval", "Approved Privacy Notice, Terms of Use, and AI Disclosure publication record for the production origin"], ["rollback_authority", "Named rollback authority and immutable rollback target"], ["launch_approval", "Named go/no-go decision and launch window"], ["github_receipt", "Observed GitHub destination receipt for the candidate"], ["drive_receipt", "Observed Google Drive destination receipt for the candidate"]];
function submission() { const prerequisites = { version: "1.0", candidate_commit: COMMIT, generated_at: "2026-01-01T00:00:00.000Z", status: "blocked_on_configuration", local: { configuration: { status: "blocked", error_codes: ["PRODUCTION_FIELD_INVALID"] } }, external: EXTERNAL.map(([id, requirement]) => ({ id, requirement, status: "pending_external_evidence" })) }; prerequisites.prerequisites_checksum = productionPrerequisitesChecksum(prerequisites); return buildProductionBuildSubmission({ prerequisites, now: "2026-01-02T00:00:00.000Z" }); }
test("creates a candidate-bound secret-free operator intake", () => { const result = buildProductionBuildIntake({ submission: submission(), now: "2026-01-03T00:00:00.000Z" }); assert.equal(result.status, "awaiting_operator_inputs"); assert.equal(result.candidate_commit, COMMIT); assert.equal(result.required_evidence.length, 12); assert.equal(result.required_evidence.find((entry) => entry.id === "policy_publication_approval")?.requirement, "Approved Privacy Notice, Terms of Use, and AI Disclosure publication record for the production origin"); assert.equal(result.secret_references_only.database_url_secret_name, null); assert.equal(result.secret_references_only.mgt_edge_token_secret_name, null); assert.equal(result.secret_references_only.operations_alert_webhook_token_secret_name, null); assert.equal(result.secret_references_only.backup_attestation_secret_name_if_enabled, null); assert.equal(Object.keys(result.secret_references_only).length, 11); assert.equal(result.approvals.primary_accountable_owner, "Gregg Clark of MGT"); assert.equal(result.approvals.release_execution_owner, "Gregg Clark of MGT"); assert.equal(result.approvals.go_no_go_owner, "Gregg Clark of MGT"); assert.equal(result.approvals.approved_launch_window_iso, null); assert.equal(validateProductionBuildIntake(result, { now: Date.parse("2026-01-04T00:00:00.000Z") }).ok, true); });
test("requires every evidence item exactly once", () => { const result = buildProductionBuildIntake({ submission: submission(), now: "2026-01-03T00:00:00.000Z" }); const policyIndex = result.required_evidence.findIndex((entry) => entry.id === "policy_publication_approval"); result.required_evidence[policyIndex] = { ...result.required_evidence[policyIndex - 1] }; result.intake_checksum = productionBuildIntakeChecksum(result); const errors = validateProductionBuildIntake(result, { now: Date.parse("2026-01-04T00:00:00.000Z") }).errors.join("; "); assert.match(errors, /policy_publication_approval must retain its exact awaiting-reference requirement/); });
test("rejects a secret-like value or changed source binding", () => { const result = buildProductionBuildIntake({ submission: submission(), now: "2026-01-03T00:00:00.000Z" }); result.secret_references_only.database_url_secret_name = "postgresql://user:password@db.example"; result.intake_checksum = "sha256:" + "a".repeat(64); assert.equal(validateProductionBuildIntake(result, { now: Date.parse("2026-01-04T00:00:00.000Z") }).ok, false); assert.throws(() => buildProductionBuildIntake({ submission: { ...submission(), candidate_commit: "not-a-sha" } }), /submission is invalid/); });
test("rejects whitespace and control characters in secret-manager references", () => {
  const result = buildProductionBuildIntake({ submission: submission(), now: "2026-01-03T00:00:00.000Z" });
  result.non_secret_inputs.staging_secret_manager_namespace_reference = "mgt-skin-care/staging\n";
  result.intake_checksum = productionBuildIntakeChecksum(result);
  assert.match(validateProductionBuildIntake(result, { now: Date.parse("2026-01-04T00:00:00.000Z") }).errors.join("; "), /non_secret_inputs must retain its exact safe field set/);
});
test("keeps staging and production secret-manager references isolated", () => {
  const result = buildProductionBuildIntake({ submission: submission(), now: "2026-01-03T00:00:00.000Z" });
  result.non_secret_inputs.staging_secret_manager_namespace_reference = "mgt-skin-care/staging";
  result.non_secret_inputs.production_secret_manager_namespace_reference = "mgt-skin-care/staging";
  result.intake_checksum = productionBuildIntakeChecksum(result);
  assert.match(validateProductionBuildIntake(result, { now: Date.parse("2026-01-04T00:00:00.000Z") }).errors.join("; "), /namespaces must remain distinct/);

  result.non_secret_inputs.production_secret_manager_namespace_reference = "mgt-skin-care/production";
  result.non_secret_inputs.staging_workload_identity_reference = "workload/staging";
  result.non_secret_inputs.production_workload_identity_reference = "workload/production";
  result.secret_references_only.mgt_edge_token_secret_name = "mgt-skin-care/staging/shared-token";
  result.secret_references_only.operations_alert_webhook_token_secret_name = "mgt-skin-care/staging/shared-token";
  result.intake_checksum = productionBuildIntakeChecksum(result);
  assert.match(validateProductionBuildIntake(result, { now: Date.parse("2026-01-04T00:00:00.000Z") }).errors.join("; "), /secret names or paths distinct/);
});
test("keeps the designated owner exact without turning it into a launch decision", () => {
  const result = buildProductionBuildIntake({ submission: submission(), now: "2026-01-03T00:00:00.000Z" });
  result.approvals.security_and_privacy_owner = "Gregg Clark";
  result.intake_checksum = productionBuildIntakeChecksum(result);
  assert.match(validateProductionBuildIntake(result, { now: Date.parse("2026-01-04T00:00:00.000Z") }).errors.join("; "), /approvals\.security_and_privacy_owner must equal Gregg Clark of MGT/);
  assert.equal(result.required_evidence.find((entry) => entry.id === "launch_approval").status, "awaiting_reference");
});
