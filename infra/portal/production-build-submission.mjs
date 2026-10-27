import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { productionPrerequisitesChecksum } from "./production-prerequisites.mjs";

const VERSION = "1.0";
const SHA = /^[a-f0-9]{40}$/i;
const EXTERNAL_REQUIREMENTS = Object.freeze([
  ["hosting_target", "Production hosting account, domain, TLS, and edge routing"],
  ["database_target", "Production PostgreSQL/Supabase target with migration and RLS evidence"],
  ["secret_manager", "Approved secret-manager injection and rotation evidence"],
  ["backup_restore", "Encrypted off-host backup and verified restore transcript"],
  ["support_owner", "Named support owner, backup, route, and coverage window"],
  ["accessibility_report", "Deployed accessibility report for the production origin"],
  ["rollback_authority", "Named rollback authority and immutable rollback target"],
  ["launch_approval", "Named go/no-go decision and launch window"],
  ["github_receipt", "Observed GitHub destination receipt for the candidate"],
  ["drive_receipt", "Observed Google Drive destination receipt for the candidate"]
]);
const IMPLEMENTATION_NOW = Object.freeze([
  ["release_images", "Build, attest, and publish the immutable API and web candidate images", "GitHub Actions release-image manifest and image attestations"],
  ["runtime_package", "Prepare the locked API, worker, web, and Caddy runtime package", "Pinned production compose package and image-digest record"],
  ["database_plan", "Prepare the reviewed schema, migration, and row-level-security execution plan", "Candidate-bound migration and RLS runbook"],
  ["identity_scope", "Prepare Supabase identity configuration and callback verification plan", "Approved identity/provider scope record; no Drive scope is implied"],
  ["operations_package", "Prepare health checks, monitoring, alerts, incident response, and support handoff", "Operations runbook and destination verification plan"],
  ["backup_package", "Prepare encrypted backup, retention, and isolated restore-drill procedure", "Backup schedule and restore-test transcript template"],
  ["accessibility_package", "Prepare the deployed-origin accessibility validation plan", "Human/device validation report template"],
  ["release_evidence", "Prepare the candidate-bound release, GitHub, and Drive evidence packet", "Signed release record with exact candidate and archive checksums"]
]);

function text(value) { return String(value || "").trim(); }
function validPastIso(value, now = Date.now()) { const parsed = Date.parse(text(value)); return Number.isFinite(parsed) && parsed <= now; }
function canonicalChecksum(document) {
  const { submission_checksum: _ignored, ...unsigned } = document || {};
  const canonical = JSON.stringify(unsigned, (_key, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]));
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}
function boundedCodes(value) { return Array.isArray(value) && value.every((item) => /^[A-Z_]+$/.test(text(item))) ? [...new Set(value)].sort() : null; }
function expectedExternal(external) {
  if (!Array.isArray(external) || external.length !== EXTERNAL_REQUIREMENTS.length) return false;
  return EXTERNAL_REQUIREMENTS.every(([id, requirement]) => external.filter((entry) => entry?.id === id && entry?.requirement === requirement && entry?.status === "pending_external_evidence").length === 1);
}

export function productionBuildSubmissionChecksum(document) { return canonicalChecksum(document); }

export function validateProductionBuildSubmission(document, { now = Date.now() } = {}) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["submission must be an object"] };
  if (document.version !== VERSION) errors.push(`submission version must be ${VERSION}`);
  if (!SHA.test(text(document.candidate_commit))) errors.push("submission candidate_commit must be a commit SHA");
  if (!validPastIso(document.generated_at, now)) errors.push("submission generated_at must be a past ISO timestamp");
  if (document.status !== "blocked_on_production_inputs") errors.push("submission must preserve the production-input hold");
  if (text(document.statement) !== "Planning and evidence packet only; it does not authorize a deployment, migration, credential provision, customer-data transfer, or traffic change.") errors.push("submission must preserve its non-deployment statement");
  const source = document.source_prerequisites;
  if (!source || source.candidate_commit !== document.candidate_commit || !["blocked_on_configuration", "blocked_on_external_prerequisites"].includes(source.status) || !["blocked", "ready_for_live_validation"].includes(source.configuration_status) || !/^sha256:[a-f0-9]{64}$/.test(text(source.checksum))) errors.push("submission must bind a bounded prerequisite source");
  if (!Array.isArray(document.implementation_now) || document.implementation_now.length !== IMPLEMENTATION_NOW.length) errors.push("submission must retain every repository-ready work item");
  for (const [id, work, evidence] of IMPLEMENTATION_NOW) {
    const matches = (document.implementation_now || []).filter((entry) => entry?.id === id);
    if (matches.length !== 1 || matches[0].work !== work || matches[0].expected_evidence !== evidence || matches[0].status !== "repository_ready") errors.push(`${id} must retain its repository-ready work definition`);
  }
  if (!Array.isArray(document.on_hold)) errors.push("submission on_hold must be an array");
  for (const [id, requirement] of EXTERNAL_REQUIREMENTS) {
    const matches = (document.on_hold || []).filter((entry) => entry?.id === id);
    if (matches.length !== 1 || matches[0].requirement !== requirement || matches[0].status !== "pending_external_evidence") errors.push(`${id} must retain its external-evidence hold`);
  }
  const configuration = (document.on_hold || []).filter((entry) => entry?.id === "production_configuration");
  if (source.configuration_status === "blocked") {
    if (configuration.length !== 1 || configuration[0].status !== "blocked_on_configuration" || !Array.isArray(configuration[0].error_codes) || !boundedCodes(configuration[0].error_codes)) errors.push("blocked configuration must be represented by bounded error codes");
  } else if (configuration.length) errors.push("ready configuration must not be duplicated as an on-hold item");
  if (text(document.submission_checksum) !== productionBuildSubmissionChecksum(document)) errors.push("submission_checksum must match the complete canonical submission");
  return { ok: errors.length === 0, errors };
}

export function buildProductionBuildSubmission({ prerequisites, now = new Date().toISOString() } = {}) {
  if (!prerequisites || typeof prerequisites !== "object" || Array.isArray(prerequisites)) throw new Error("prerequisites must be an object");
  if (!SHA.test(text(prerequisites.candidate_commit))) throw new Error("prerequisites candidate_commit must be a commit SHA");
  if (!['blocked_on_configuration', 'blocked_on_external_prerequisites'].includes(prerequisites.status)) throw new Error("prerequisites must retain a production hold");
  if (text(prerequisites.prerequisites_checksum) !== productionPrerequisitesChecksum(prerequisites)) throw new Error("prerequisites_checksum must match before submission");
  if (!expectedExternal(prerequisites.external)) throw new Error("prerequisites external requirements must be complete and bounded");
  const configuration = prerequisites.local?.configuration;
  if (!configuration || !['blocked', 'ready_for_live_validation'].includes(configuration.status)) throw new Error("prerequisites must provide a bounded configuration status");
  const codes = boundedCodes(configuration.error_codes);
  if (!codes) throw new Error("prerequisites configuration error_codes must be bounded");
  const onHold = [
    ...EXTERNAL_REQUIREMENTS.map(([id, requirement]) => ({ id, requirement, status: "pending_external_evidence" }))
  ];
  if (configuration.status === "blocked") onHold.unshift({ id: "production_configuration", requirement: "Reviewed production configuration must pass preflight before live validation.", status: "blocked_on_configuration", error_codes: codes });
  const document = {
    version: VERSION,
    candidate_commit: text(prerequisites.candidate_commit),
    generated_at: new Date(now).toISOString(),
    status: "blocked_on_production_inputs",
    statement: "Planning and evidence packet only; it does not authorize a deployment, migration, credential provision, customer-data transfer, or traffic change.",
    source_prerequisites: { candidate_commit: text(prerequisites.candidate_commit), status: prerequisites.status, checksum: text(prerequisites.prerequisites_checksum), configuration_status: configuration.status },
    implementation_now: IMPLEMENTATION_NOW.map(([id, work, expected_evidence]) => ({ id, work, expected_evidence, status: "repository_ready" })),
    on_hold: onHold,
    next_action: configuration.status === "blocked" ? "Submit approved production configuration through the designated secret manager and rerun production preflight." : "Collect the named external evidence and approvals, then run the production gate."
  };
  return { ...document, submission_checksum: productionBuildSubmissionChecksum(document) };
}

function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2); const prerequisitesFile = argumentValue(args, "--prerequisites"); const output = argumentValue(args, "--output"); const generatedAt = argumentValue(args, "--generated-at");
  if (!prerequisitesFile || !output) { console.error("Usage: node infra/portal/production-build-submission.mjs --prerequisites work/production/prerequisites.json --output work/production/submission.json [--generated-at <ISO timestamp>]"); process.exitCode = 1; }
  else {
    const prerequisites = JSON.parse(fs.readFileSync(path.resolve(prerequisitesFile), "utf8"));
    const document = buildProductionBuildSubmission({ prerequisites, now: generatedAt || new Date().toISOString() });
    const result = validateProductionBuildSubmission(document);
    if (!result.ok) throw new Error(result.errors.join("; "));
    const destination = path.resolve(output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Production build submission: ${destination}`);
  }
}
