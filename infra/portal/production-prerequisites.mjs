import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateEnvironment } from "./preflight.mjs";

const VERSION = "1.0";
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

function text(value) { return String(value || "").trim(); }
function parseEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !match[2].startsWith("#")) values[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}
function externalRequirements() { return EXTERNAL_REQUIREMENTS.map(([id, requirement]) => ({ id, requirement, status: "pending_external_evidence" })); }
export function productionPrerequisitesChecksum(document) {
  const { prerequisites_checksum: _ignored, ...unsigned } = document || {};
  // A replacer array filters keys at EVERY depth. Sort each object instead so
  // nested configuration and external requirements remain in the digest.
  const canonical = JSON.stringify(unsigned, (_key, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]));
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export function validateProductionPrerequisites(document) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["prerequisites must be an object"] };
  if (document.version !== VERSION) errors.push(`prerequisites version must be ${VERSION}`);
  if (!/^[a-f0-9]{40}$/i.test(text(document.candidate_commit))) errors.push("prerequisites candidate_commit must be a commit SHA");
  if (text(document.prerequisites_checksum) !== productionPrerequisitesChecksum(document)) errors.push("prerequisites_checksum must match the complete canonical prerequisites document");
  if (document.status !== "blocked_on_external_prerequisites") errors.push("prerequisites must be explicitly blocked on external prerequisites");
  const config = document.local?.configuration;
  if (config?.status !== "ready_for_live_validation" || !Array.isArray(config.errors) || config.errors.length) errors.push("local configuration must be ready without errors before external prerequisite review");
  const external = Array.isArray(document.external) ? document.external : [];
  if (external.length !== EXTERNAL_REQUIREMENTS.length) errors.push("external prerequisites must contain exactly the required records");
  for (const [id, requirement] of EXTERNAL_REQUIREMENTS) {
    const matches = external.filter((entry) => entry?.id === id);
    if (matches.length !== 1 || matches[0].requirement !== requirement || matches[0].status !== "pending_external_evidence") errors.push(`${id} must retain its requirement and pending external evidence status`);
  }
  return { ok: errors.length === 0, errors };
}

export function buildProductionPrerequisites({ env = process.env, candidateCommit = "", envFile = "" } = {}) {
  const merged = { ...parseEnvFile(envFile), ...env };
  const preflight = validateEnvironment(merged);
  const config = { status: preflight.ok ? "ready_for_live_validation" : "blocked", errors: preflight.errors, warnings: preflight.warnings };
  const document = {
    version: VERSION,
    candidate_commit: text(candidateCommit) || null,
    generated_at: new Date().toISOString(),
    local: { backend_build: "not_evaluated", portal_tests: "not_evaluated", configuration: config },
    external: externalRequirements(),
    status: preflight.ok ? "blocked_on_external_prerequisites" : "blocked_on_configuration",
    next_action: preflight.ok ? "Collect the named live evidence and approvals, then run the production gate." : "Populate a production environment outside source control and rerun the preflight."
  };
  return { ...document, prerequisites_checksum: productionPrerequisitesChecksum(document) };
}

function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2); const envFile = argumentValue(args, "--env-file"); const output = argumentValue(args, "--output"); const candidateCommit = argumentValue(args, "--candidate-commit");
  if (!output) { console.error("Usage: node infra/portal/production-prerequisites.mjs --candidate-commit <sha> --output work/production/prerequisites.json [--env-file infra/portal/.env]"); process.exitCode = 1; } else { const document = buildProductionPrerequisites({ env: process.env, envFile: envFile ? path.resolve(envFile) : "", candidateCommit }); const destination = path.resolve(output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Production prerequisites: ${destination}`); }
}
