import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateEnvironment } from "./preflight.mjs";

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

function text(value) { return String(value || "").trim(); }
function validPastIso(value, now = Date.now()) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) && parsed <= new Date(now).getTime();
}
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
function localReference(root, reference) {
  if (typeof reference !== "string" || !reference || path.isAbsolute(reference) || reference.includes("\\") || reference.split("/").includes("..")) return null;
  const absolute = path.resolve(root, reference);
  const relative = path.relative(root, absolute);
  const normalized = relative.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("..") || path.isAbsolute(normalized) || (!normalized.startsWith("work/") && !normalized.startsWith("infra/"))) return null;
  return { absolute, reference: normalized };
}
function buildLocalEvidence({ root, candidateCommit, checkpointFile = "", verificationFile = "" }) {
  const evidence = { status: "not_evaluated", checkpoint_reference: null, verification_reference: null, candidate_commit: null, errors: [] };
  if (!checkpointFile && !verificationFile) return evidence;
  const checkpoint = checkpointFile ? localReference(root, checkpointFile) : null;
  const verification = verificationFile ? localReference(root, verificationFile) : null;
  if (checkpointFile && (!checkpoint || !fs.existsSync(checkpoint.absolute))) evidence.errors.push("checkpoint evidence must be an existing work/ or infra/ report");
  if (verificationFile && (!verification || !fs.existsSync(verification.absolute))) evidence.errors.push("verification evidence must be an existing work/ or infra/ report");
  if (checkpoint && fs.existsSync(checkpoint.absolute)) {
    evidence.checkpoint_reference = checkpoint.reference;
    const content = fs.readFileSync(checkpoint.absolute, "utf8");
    const commit = content.match(/^\s*- Commit:\s*`([a-f0-9]{40})`\s*$/im)?.[1] || null;
    evidence.candidate_commit = commit;
    if (!SHA.test(text(candidateCommit)) || commit !== text(candidateCommit)) evidence.errors.push("checkpoint evidence must bind the exact candidate commit");
    if (!/^\s*- Local gates:\s*\*\*PASS\*\*\s*$/im.test(content)) evidence.errors.push("checkpoint evidence must report local gates PASS");
  }
  if (verification && fs.existsSync(verification.absolute)) {
    evidence.verification_reference = verification.reference;
    const content = fs.readFileSync(verification.absolute, "utf8");
    if (/\|[^\n|]+\|\s*FAILED\s*\|/i.test(content)) evidence.errors.push("verification evidence must not contain FAILED components");
    if (!/^# Verification evidence/im.test(content)) evidence.errors.push("verification evidence must be a verification report");
  }
  if (!checkpointFile || !verificationFile) evidence.errors.push("checkpoint and verification evidence must be supplied together");
  evidence.status = evidence.errors.length ? "blocked" : "verified";
  return evidence;
}
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
  if (!validPastIso(document.generated_at)) errors.push("prerequisites generated_at must be a past ISO timestamp");
  if (text(document.prerequisites_checksum) !== productionPrerequisitesChecksum(document)) errors.push("prerequisites_checksum must match the complete canonical prerequisites document");
  if (document.status !== "blocked_on_external_prerequisites") errors.push("prerequisites must be explicitly blocked on external prerequisites");
  const config = document.local?.configuration;
  if (config?.status !== "ready_for_live_validation" || !Array.isArray(config.errors) || config.errors.length) errors.push("local configuration must be ready without errors before external prerequisite review");
  const local = document.local;
  const evidence = local?.evidence;
  if (!evidence || !["not_evaluated", "verified"].includes(evidence.status)) errors.push("local evidence must be not_evaluated or verified");
  if (evidence?.status === "not_evaluated" && (local.backend_build !== "not_evaluated" || local.portal_tests !== "not_evaluated")) errors.push("unevaluated local evidence must not claim build or test verification");
  if (evidence?.status === "verified") {
    if (local.backend_build !== "verified_by_checkpoint" || local.portal_tests !== "verified_by_verification") errors.push("verified local evidence must bind backend build and portal tests to their reports");
    if (!/^work\/(?:[^/]+\/)*[^/]+\.md$/.test(text(evidence.checkpoint_reference))) errors.push("checkpoint evidence reference must be a work Markdown report");
    if (!/^work\/(?:[^/]+\/)*[^/]+\.md$/.test(text(evidence.verification_reference))) errors.push("verification evidence reference must be a work Markdown report");
    if (!SHA.test(text(evidence.candidate_commit)) || text(evidence.candidate_commit) !== text(document.candidate_commit)) errors.push("local evidence candidate_commit must match prerequisites");
    if (!Array.isArray(evidence.errors) || evidence.errors.length) errors.push("verified local evidence cannot contain errors");
  }
  const external = Array.isArray(document.external) ? document.external : [];
  if (external.length !== EXTERNAL_REQUIREMENTS.length) errors.push("external prerequisites must contain exactly the required records");
  for (const [id, requirement] of EXTERNAL_REQUIREMENTS) {
    const matches = external.filter((entry) => entry?.id === id);
    if (matches.length !== 1 || matches[0].requirement !== requirement || matches[0].status !== "pending_external_evidence") errors.push(`${id} must retain its requirement and pending external evidence status`);
  }
  return { ok: errors.length === 0, errors };
}

export function buildProductionPrerequisites({ root = process.cwd(), env = process.env, candidateCommit = "", envFile = "", checkpointFile = "", verificationFile = "", now = new Date().toISOString() } = {}) {
  const merged = { ...parseEnvFile(envFile), ...env };
  const preflight = validateEnvironment(merged);
  const config = { status: preflight.ok ? "ready_for_live_validation" : "blocked", errors: preflight.errors, warnings: preflight.warnings };
  const evidence = buildLocalEvidence({ root, candidateCommit, checkpointFile, verificationFile });
  const document = {
    version: VERSION,
    candidate_commit: text(candidateCommit) || null,
    generated_at: new Date(now).toISOString(),
    local: { backend_build: evidence.status === "verified" ? "verified_by_checkpoint" : "not_evaluated", portal_tests: evidence.status === "verified" ? "verified_by_verification" : "not_evaluated", evidence, configuration: config },
    external: externalRequirements(),
    status: preflight.ok && evidence.status !== "blocked" ? "blocked_on_external_prerequisites" : "blocked_on_configuration",
    next_action: !preflight.ok ? "Populate a production environment outside source control and rerun the preflight." : evidence.status === "blocked" ? "Supply matching candidate-bound checkpoint and verification reports, then regenerate the prerequisite packet." : "Collect the named live evidence and approvals, then run the production gate."
  };
  return { ...document, prerequisites_checksum: productionPrerequisitesChecksum(document) };
}

function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2); const envFile = argumentValue(args, "--env-file"); const output = argumentValue(args, "--output"); const candidateCommit = argumentValue(args, "--candidate-commit"); const checkpointFile = argumentValue(args, "--checkpoint"); const verificationFile = argumentValue(args, "--verification"); const generatedAt = argumentValue(args, "--generated-at");
  if (!output) { console.error("Usage: node infra/portal/production-prerequisites.mjs --candidate-commit <sha> --output work/production/prerequisites.json [--env-file infra/portal/.env] [--generated-at <ISO timestamp>] [--checkpoint work/checkpoints/.../report.md --verification work/verification/.../report.md]"); process.exitCode = 1; } else { const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url))); const document = buildProductionPrerequisites({ root, env: process.env, envFile: envFile ? path.resolve(envFile) : "", candidateCommit, checkpointFile, verificationFile, now: generatedAt || new Date().toISOString() }); if (!validPastIso(document.generated_at)) throw new Error("generated_at must be a past ISO timestamp"); const destination = path.resolve(output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Production prerequisites: ${destination}`); }
}
