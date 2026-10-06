import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SHA = /^[0-9a-f]{40}$/i;
const DIGEST = /^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$/;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;
const SECRET_VALUE = /(?:sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@|(?:OPENAI|SUPABASE|STRIPE)_[A-Z_]*(?:KEY|SECRET)[A-Z_]*\s*=\s*\S+)/i;

export const PRODUCTION_GATE_VERSION = "1.0";
export const PRODUCTION_GATE_OWNER_ROLES = Object.freeze(["release", "platform", "data", "support", "accessibility"]);
export const PRODUCTION_GATE_CHECKS = Object.freeze([
  { id: "target_identity", owner_role: "platform", requirement: "The approved production origin and target account are identified without exposing credentials." },
  { id: "candidate_continuity", owner_role: "release", requirement: "The exact candidate commit and immutable image digests are continuous from the approved staging dossier." },
  { id: "production_preflight", owner_role: "platform", requirement: "Production configuration preflight passes from the approved secret injection boundary." },
  { id: "production_readiness", owner_role: "platform", requirement: "Production health, readiness, edge, worker, backup, and TLS evidence passes." },
  { id: "customer_smoke", owner_role: "release", requirement: "The approved customer smoke journey passes without changing customer data beyond the test protocol." },
  { id: "data_rls_backup", owner_role: "data", requirement: "Production migrations, RLS isolation, retention, backup, and restore evidence pass." },
  { id: "support_accessibility", owner_role: "support", requirement: "Support ownership and deployed accessibility evidence pass for the production origin." },
  { id: "rollback_monitoring", owner_role: "release", requirement: "Rollback, incident routing, launch window, and post-release monitoring are staffed and rehearsed." }
]);

function text(value) {
  return String(value || "").trim();
}

function validPastIso(value, now = Date.now()) {
  const parsed = Date.parse(text(value));
  const nowMs = new Date(now).getTime();
  return Number.isFinite(parsed) && Number.isFinite(nowMs) && parsed <= nowMs;
}

function validReference(value) {
  const reference = text(value);
  return (/^https:\/\//.test(reference) || /^(?:work|infra)\//.test(reference)) && !PLACEHOLDER.test(reference);
}

function validOrigin(value) {
  try {
    const origin = new URL(text(value));
    return origin.protocol === "https:" && origin.pathname === "/" && !origin.search && !origin.hash && !PLACEHOLDER.test(origin.hostname) && !/staging/i.test(origin.hostname);
  } catch {
    return false;
  }
}

function validOwner(value) {
  return text(value).length >= 2 && !PLACEHOLDER.test(text(value));
}

function recordTemplate(definition) {
  return {
    id: definition.id,
    owner_role: definition.owner_role,
    owner: `REPLACE_WITH_${definition.owner_role.toUpperCase()}_OWNER`,
    requirement: definition.requirement,
    status: "pending",
    captured_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP",
    actual_result: "REPLACE_WITH_ACTUAL_RESULT",
    reference: `work/production/REPLACE_WITH_${definition.id.toUpperCase()}_EVIDENCE.md`,
    checksum: "sha256:REPLACE_WITH_64_HEX_CHECKSUM",
    rollback_reference: "work/production/REPLACE_WITH_ROLLBACK_EVIDENCE.md"
  };
}

export function createProductionGateTemplate({ candidateCommit, images = {} } = {}) {
  return {
    version: PRODUCTION_GATE_VERSION,
    environment: "production",
    candidate_commit: candidateCommit || "REPLACE_WITH_40_CHARACTER_COMMIT_SHA",
    origin: "https://REPLACE_WITH_PRODUCTION_ORIGIN",
    source_environment_review: "work/production/REPLACE_WITH_STAGING_DOSSIER_REVIEW.md",
    images: {
      node: images.node || "node@sha256:REPLACE_WITH_64_HEX_DIGEST",
      ollama: images.ollama || "ollama/ollama@sha256:REPLACE_WITH_64_HEX_DIGEST",
      caddy: images.caddy || "caddy@sha256:REPLACE_WITH_64_HEX_DIGEST"
    },
    owners: Object.fromEntries(PRODUCTION_GATE_OWNER_ROLES.map((role) => [role, `REPLACE_WITH_${role.toUpperCase()}_OWNER`])),
    checks: PRODUCTION_GATE_CHECKS.map(recordTemplate),
    approvals: PRODUCTION_GATE_OWNER_ROLES.map((role) => ({ role, decision: "pending", approver: `REPLACE_WITH_${role.toUpperCase()}_APPROVER`, reviewed_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP", reference: `work/production/approvals/${role}.md` })),
    decision: { status: "pending", decision: "hold", decider: "REPLACE_WITH_RELEASE_DECIDER", reviewed_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP", reference: "work/production/REPLACE_WITH_GO_NO_GO_DECISION.md" }
  };
}

export function validateProductionGate(gate, { candidateCommit, images = {}, now = Date.now() } = {}) {
  const errors = [];
  if (!gate || typeof gate !== "object" || Array.isArray(gate)) return { ok: false, errors: ["must be an object"] };
  if (gate.version !== PRODUCTION_GATE_VERSION) errors.push(`version must be ${PRODUCTION_GATE_VERSION}`);
  if (gate.environment !== "production") errors.push("environment must be production");
  if (!SHA.test(text(gate.candidate_commit))) errors.push("candidate_commit must be a 40-character commit SHA");
  if (SHA.test(text(candidateCommit)) && text(gate.candidate_commit) !== text(candidateCommit)) errors.push("candidate_commit must match the approved candidate");
  if (!validOrigin(gate.origin)) errors.push("origin must be a non-placeholder HTTPS production origin");
  if (!validReference(gate.source_environment_review)) errors.push("source_environment_review must be a non-placeholder evidence reference");
  for (const key of ["node", "ollama", "caddy"]) {
    if (!DIGEST.test(text(gate.images?.[key]))) errors.push(`images.${key} must be an immutable @sha256 digest`);
    if (DIGEST.test(text(images[key])) && text(gate.images?.[key]) !== text(images[key])) errors.push(`images.${key} must match the approved candidate image`);
  }
  const owners = gate.owners || {};
  for (const role of PRODUCTION_GATE_OWNER_ROLES) if (!validOwner(owners[role])) errors.push(`owners.${role} must name an accountable owner`);

  const checks = Array.isArray(gate.checks) ? gate.checks : [];
  for (const check of checks) if (!PRODUCTION_GATE_CHECKS.some((definition) => definition.id === check?.id)) errors.push("checks contain an unknown production gate");
  for (const definition of PRODUCTION_GATE_CHECKS) {
    const matches = checks.filter((check) => check?.id === definition.id);
    if (matches.length !== 1) {
      errors.push(`${definition.id} must appear exactly once`);
      continue;
    }
    const check = matches[0];
    if (check.owner_role !== definition.owner_role) errors.push(`${definition.id}.owner_role must be ${definition.owner_role}`);
    if (!validOwner(check.owner)) errors.push(`${definition.id}.owner must name an accountable owner`);
    if (validOwner(owners[definition.owner_role]) && text(check.owner) !== text(owners[definition.owner_role])) errors.push(`${definition.id}.owner must match owners.${definition.owner_role}`);
    if (check.requirement !== definition.requirement) errors.push(`${definition.id}.requirement must preserve the gate requirement`);
    if (!["pass", "pending", "blocked"].includes(check.status)) errors.push(`${definition.id}.status is invalid`);
    if (!validPastIso(check.captured_at, now)) errors.push(`${definition.id}.captured_at must be a past ISO timestamp`);
    if (!validOwner(check.actual_result)) errors.push(`${definition.id}.actual_result must be recorded`);
    if (!validReference(check.reference)) errors.push(`${definition.id}.reference must be a non-placeholder evidence reference`);
    if (!CHECKSUM.test(text(check.checksum))) errors.push(`${definition.id}.checksum must be a sha256 checksum`);
    if (!validReference(check.rollback_reference)) errors.push(`${definition.id}.rollback_reference must identify rollback evidence`);
  }

  const approvals = Array.isArray(gate.approvals) ? gate.approvals : [];
  for (const role of PRODUCTION_GATE_OWNER_ROLES) {
    const matches = approvals.filter((approval) => approval?.role === role);
    if (matches.length !== 1) {
      errors.push(`approvals must contain exactly one ${role} decision`);
      continue;
    }
    const approval = matches[0];
    if (![`pending`, `go`, `hold`].includes(approval.decision)) errors.push(`${role} approval decision is invalid`);
    if (!validOwner(approval.approver)) errors.push(`${role} approval must name an approver`);
    if (!validPastIso(approval.reviewed_at, now)) errors.push(`${role} approval must have a past timestamp`);
    if (!validReference(approval.reference)) errors.push(`${role} approval must reference a decision record`);
  }

  const decision = gate.decision || {};
  if (!["pending", "go", "hold"].includes(decision.decision)) errors.push("decision.decision must be pending, go, or hold");
  if (!validOwner(decision.decider)) errors.push("decision.decider must name the release decider");
  if (!validPastIso(decision.reviewed_at, now)) errors.push("decision.reviewed_at must be a past timestamp");
  if (!validReference(decision.reference)) errors.push("decision.reference must identify the go/no-go record");
  if (decision.decision === "go") {
    if (checks.some((check) => check.status !== "pass")) errors.push("go decision requires every production evidence check to pass");
    if (approvals.some((approval) => approval.decision !== "go")) errors.push("go decision requires every production owner approval to be go");
  }
  if (SECRET_VALUE.test(JSON.stringify(gate))) errors.push("must not contain credential-like values");
  return { ok: errors.length === 0, errors };
}

export function evaluateProductionGate(gate, options = {}) {
  const validation = validateProductionGate(gate, options);
  if (!validation.ok) return { status: "blocked", errors: validation.errors };
  if (gate.decision.decision === "go") return { status: "go_recorded", errors: [] };
  if (gate.decision.decision === "hold") return { status: "held", errors: [] };
  return { status: "pending_human_go_no_go", errors: [] };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const input = argumentValue(args, "--gate");
  const output = argumentValue(args, "--output");
  if (!input || !output) {
    console.error("Usage: node infra/portal/production-gate.mjs --gate work/production/gate.json --output work/production/gate-review.json");
    process.exitCode = 1;
  } else {
    try {
      const gate = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
      const evaluation = evaluateProductionGate(gate);
      const result = { version: PRODUCTION_GATE_VERSION, reviewed_at: new Date().toISOString(), status: evaluation.status, candidate_commit: SHA.test(text(gate.candidate_commit)) ? text(gate.candidate_commit) : null, origin: validOrigin(gate.origin) ? text(gate.origin) : null, errors: evaluation.errors };
      const destination = path.resolve(output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(result, null, 2)}\n`);
      console.log(`Production gate review: ${destination}`);
      if (evaluation.status === "blocked") process.exitCode = 2;
    } catch (error) {
      console.error(`Unable to review production gate: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
