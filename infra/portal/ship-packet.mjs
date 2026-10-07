import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildReleaseReadiness, liveEvidenceFromEnvironment } from "./release-readiness.mjs";
import { validateStagingEvidence } from "./staging-evidence.mjs";

export const SHIP_PACKET_VERSION = "1.2";

const OWNER_KEYS = Object.freeze(["release", "support", "data", "platform", "accessibility"]);
const APPROVAL_KEYS = OWNER_KEYS;
const REQUIRED_EVIDENCE = Object.freeze([
  ["support_workflow", "F73"],
  ["accessibility_deployed", "F74"],
  ["database_rls", "F75"],
  ["backup_restore", "F76"],
  ["container_startup", "F78"]
]);
const EVIDENCE_PHASES = Object.freeze(Object.fromEntries([...REQUIRED_EVIDENCE, ["stripe_sandbox", "F77"], ["ai_provider", "F79"]]));
const SHA = /^[0-9a-f]{40}$/i;
const DIGEST = /^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$/;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;

function text(value) {
  return String(value || "").trim();
}

function validPastIso(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) && parsed <= Date.now();
}

function validFutureIso(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) && parsed > Date.now();
}

function validEvidenceReference(value) {
  const reference = text(value);
  return (/^https:\/\//.test(reference) || /^(?:work|infra)\//.test(reference)) && !PLACEHOLDER.test(reference);
}

function validOwner(value) {
  const owner = text(value);
  return owner.length >= 2 && !PLACEHOLDER.test(owner);
}

function phaseStatus(readiness, id) {
  return readiness?.phases?.find((phase) => phase.id === id)?.status;
}

function addRequiredEvidence(errors, packet, key, phaseId) {
  const matches = Array.isArray(packet.evidence) ? packet.evidence.filter((entry) => entry.id === key) : [];
  const item = matches[0];
  if (!item) {
    errors.push(`${key} evidence is required for ${phaseId}.`);
    return;
  }
  if (matches.length > 1) errors.push(`${key} evidence must appear only once.`);
  if (item.phase !== phaseId) errors.push(`${key} evidence must declare phase ${phaseId}.`);
  if (item.status !== "pass") errors.push(`${key} evidence must have status pass.`);
  if (!validEvidenceReference(item.reference)) errors.push(`${key} evidence must reference a non-placeholder HTTPS or repository report.`);
  if (!validPastIso(item.reviewed_at)) errors.push(`${key} evidence must have a past reviewed_at timestamp.`);
  if (!validOwner(item.reviewer)) errors.push(`${key} evidence must name a reviewer.`);
}

export function validateShipPacket(packet, { readiness, env = {} } = {}) {
  const errors = [];
  const warnings = [];
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) return { ok: false, errors: ["Ship packet must be a JSON object."], warnings };
  if (packet.version !== SHIP_PACKET_VERSION) errors.push(`Ship packet version must be ${SHIP_PACKET_VERSION}.`);

  if (!validPastIso(packet.generated_at)) errors.push("generated_at must be a past ISO timestamp.");
  if (!validFutureIso(packet.expires_at)) errors.push("expires_at must be a future ISO timestamp.");

  const candidate = packet.candidate || {};
  if (!SHA.test(text(candidate.commit))) errors.push("candidate.commit must be a 40-character commit SHA.");
  if (!validOwner(candidate.branch)) errors.push("candidate.branch must identify the source branch.");
  for (const key of ["checkpoint_report", "verification_report"]) {
    if (!validEvidenceReference(candidate[key])) errors.push(`candidate.${key} must reference a non-placeholder HTTPS or repository report.`);
  }
  if (!/^https:\/\//.test(text(candidate.hosted_ci_url))) errors.push("candidate.hosted_ci_url must be an HTTPS hosted verification URL.");

  const owners = packet.owners || {};
  for (const key of OWNER_KEYS) if (!validOwner(owners[key])) errors.push(`owners.${key} must identify an accountable owner.`);

  const approvals = Array.isArray(packet.approvals) ? packet.approvals : [];
  for (const role of APPROVAL_KEYS) {
    const matches = approvals.filter((approval) => approval.role === role);
    if (matches.length !== 1) {
      errors.push(`approvals must contain exactly one ${role} decision.`);
      continue;
    }
    const approval = matches[0];
    if (approval.decision !== "go") errors.push(`${role} approval must have decision go.`);
    if (!validOwner(approval.approver)) errors.push(`${role} approval must name an approver.`);
    if (!validPastIso(approval.reviewed_at)) errors.push(`${role} approval must have a past reviewed_at timestamp.`);
    if (!validEvidenceReference(approval.reference)) errors.push(`${role} approval must reference its decision record.`);
  }

  const images = packet.images || {};
  for (const key of ["node", "api", "web", "ollama", "caddy"]) if (!DIGEST.test(text(images[key]))) errors.push(`images.${key} must be an immutable @sha256 digest.`);
  for (const [envKey, packetKey] of [["NODE_IMAGE", "node"], ["API_IMAGE", "api"], ["WEB_IMAGE", "web"], ["OLLAMA_IMAGE", "ollama"], ["CADDY_IMAGE", "caddy"]]) {
    if (DIGEST.test(text(env[envKey])) && text(images[packetKey]) !== text(env[envKey])) errors.push(`images.${packetKey} must match ${envKey} from the deployment environment.`);
  }

  const stagingEvidence = validateStagingEvidence(packet.staging_evidence, { candidateCommit: candidate.commit, images, owners });
  errors.push(...stagingEvidence.errors.map((error) => `staging_evidence.${error}`));

  const requiredEvidence = [...REQUIRED_EVIDENCE];
  if (phaseStatus(readiness, "F77") === "pass") requiredEvidence.push(["stripe_sandbox", "F77"]);
  if (phaseStatus(readiness, "F79") === "pass") requiredEvidence.push(["ai_provider", "F79"]);
  for (const [key, phaseId] of requiredEvidence) addRequiredEvidence(errors, packet, key, phaseId);

  const rollback = packet.rollback || {};
  if (!validOwner(rollback.previous_release)) errors.push("rollback.previous_release must identify the last approved release.");
  if (!validEvidenceReference(rollback.reference)) errors.push("rollback.reference must point to the rehearsed rollback evidence.");
  if (!validPastIso(rollback.verified_at)) errors.push("rollback.verified_at must be a past ISO timestamp.");

  const monitoring = packet.monitoring || {};
  if (!validOwner(monitoring.owner)) errors.push("monitoring.owner must identify the launch monitor.");
  if (!validOwner(monitoring.incident_channel)) errors.push("monitoring.incident_channel must identify the incident route.");
  if (!Number.isFinite(Date.parse(text(monitoring.launch_window_start)))) errors.push("monitoring.launch_window_start must be an ISO timestamp.");
  for (const checkpoint of ["15m", "1h", "24h", "7d"]) if (!Array.isArray(monitoring.checks) || !monitoring.checks.includes(checkpoint)) errors.push(`monitoring.checks must include ${checkpoint}.`);

  if (!readiness?.release_ready) errors.push("The F71-F80 readiness packet must be release-ready before publication.");
  if (readiness?.preflight?.warnings?.length) warnings.push(...readiness.preflight.warnings);
  return { ok: errors.length === 0, errors, warnings };
}

function readPacket(file) {
  const resolved = path.resolve(file);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifestPath = process.argv.find((value, index) => index > 1 && !value.startsWith("--"));
  if (!manifestPath) {
    console.error("Usage: node infra/portal/ship-packet.mjs <ship-packet.json> [--require-ready]");
    process.exitCode = 1;
  } else {
    try {
      const packet = readPacket(manifestPath);
      const readiness = buildReleaseReadiness({ env: process.env, localGates: process.env.RELEASE_LOCAL_GATES === "true", liveEvidence: liveEvidenceFromEnvironment(process.env) });
      const validation = validateShipPacket(packet, { readiness, env: process.env });
      console.log(JSON.stringify({ version: SHIP_PACKET_VERSION, valid: validation.ok, release_ready: readiness.release_ready, candidate_commit: packet.candidate?.commit || null, errors: validation.errors, warnings: validation.warnings, phases: readiness.phases }, null, 2));
      if (process.argv.includes("--require-ready") && !validation.ok) process.exitCode = 2;
    } catch (error) {
      console.error(`Unable to read ship packet: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
