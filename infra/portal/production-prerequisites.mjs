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

export function buildProductionPrerequisites({ env = process.env, candidateCommit = "", envFile = "" } = {}) {
  const merged = { ...parseEnvFile(envFile), ...env };
  const preflight = validateEnvironment(merged);
  const config = { status: preflight.ok ? "ready_for_live_validation" : "blocked", errors: preflight.errors, warnings: preflight.warnings };
  return {
    version: VERSION,
    candidate_commit: text(candidateCommit) || null,
    generated_at: new Date().toISOString(),
    local: { backend_build: "verified_by_ci_build", portal_tests: "verified_by_local_suite", configuration: config },
    external: externalRequirements(),
    status: preflight.ok ? "blocked_on_external_prerequisites" : "blocked_on_configuration",
    next_action: preflight.ok ? "Collect the named live evidence and approvals, then run the production gate." : "Populate a production environment outside source control and rerun the preflight."
  };
}

function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2); const envFile = argumentValue(args, "--env-file"); const output = argumentValue(args, "--output"); const candidateCommit = argumentValue(args, "--candidate-commit");
  if (!output) { console.error("Usage: node infra/portal/production-prerequisites.mjs --candidate-commit <sha> --output work/production/prerequisites.json [--env-file infra/portal/.env]"); process.exitCode = 1; } else { const document = buildProductionPrerequisites({ env: process.env, envFile: envFile ? path.resolve(envFile) : "", candidateCommit }); const destination = path.resolve(output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Production prerequisites: ${destination}`); }
}
