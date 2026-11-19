import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inspectStagingArtifact } from "./staging-artifacts.mjs";
import { PRODUCTION_GATE_CHECKS, PRODUCTION_GATE_OWNER_ROLES, validateProductionGate } from "./production-gate.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const SAFE_LOCAL_REFERENCE = /^(?:work|infra)\/[A-Za-z0-9._/-]+$/;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;

export const PRODUCTION_EVIDENCE_VERSION = "1.0";

function text(value) {
  return String(value || "").trim();
}

function validLocalReference(value) {
  const reference = text(value);
  return SAFE_LOCAL_REFERENCE.test(reference) && !reference.includes("..") && !PLACEHOLDER.test(reference);
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function productionGateChecksum(gate) {
  return `sha256:${createHash("sha256").update(canonicalize(gate)).digest("hex")}`;
}

function expectedEntries(gate) {
  const checks = Array.isArray(gate?.checks) ? gate.checks : [];
  const approvals = Array.isArray(gate?.approvals) ? gate.approvals : [];
  return [
    { id: "staging_dossier", reference: text(gate?.source_environment_review) },
    ...PRODUCTION_GATE_CHECKS.flatMap((definition) => {
      const check = checks.find((item) => item?.id === definition.id) || {};
      return [
        { id: `evidence:${definition.id}`, reference: text(check.reference), gate_checksum: text(check.checksum) },
        { id: `rollback:${definition.id}`, reference: text(check.rollback_reference) }
      ];
    }),
    ...PRODUCTION_GATE_OWNER_ROLES.map((role) => ({ id: `approval:${role}`, reference: text(approvals.find((item) => item?.role === role)?.reference) })),
    { id: "go_no_go_decision", reference: text(gate?.decision?.reference) }
  ];
}

export function createProductionEvidenceTemplate({ candidateCommit } = {}) {
  return {
    version: PRODUCTION_EVIDENCE_VERSION,
    candidate_commit: candidateCommit || "REPLACE_WITH_40_CHARACTER_COMMIT_SHA",
    gate_checksum: "sha256:REPLACE_WITH_64_HEX_CHECKSUM",
    generated_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP",
    status: "pending",
    entries: [{ id: "staging_dossier", reference: "work/production/REPLACE_WITH_STAGING_DOSSIER.md", checksum: "sha256:REPLACE_WITH_64_HEX_CHECKSUM", bytes: null }]
  };
}

export function buildProductionEvidence({ root = process.cwd(), gate, now = new Date().toISOString() } = {}) {
  const validation = validateProductionGate(gate, { now });
  if (!validation.ok) throw new Error(`Production gate must be complete before evidence can be bound: ${validation.errors.join("; ")}`);
  const entries = expectedEntries(gate);
  const invalid = entries.filter((entry) => !validLocalReference(entry.reference));
  if (invalid.length) throw new Error(`Production evidence must use inspectable local work/ or infra/ references: ${invalid.map((entry) => entry.id).join(", ")}.`);
  const duplicates = entries.filter((entry, index) => entries.findIndex((other) => other.id === entry.id) !== index);
  if (duplicates.length) throw new Error(`Production evidence has duplicate entry identifiers: ${duplicates.map((entry) => entry.id).join(", ")}.`);
  const inspected = entries.map((entry) => ({ ...entry, ...inspectStagingArtifact({ root, reference: entry.reference }) }));
  for (const entry of inspected.filter((item) => item.id.startsWith("evidence:"))) {
    if (entry.gate_checksum !== entry.checksum) throw new Error(`${entry.id} checksum must match the production gate evidence checksum.`);
    delete entry.gate_checksum;
  }
  return {
    version: PRODUCTION_EVIDENCE_VERSION,
    candidate_commit: text(gate.candidate_commit),
    origin: text(gate.origin),
    gate_checksum: productionGateChecksum(gate),
    generated_at: new Date(now).toISOString(),
    status: "pass",
    entries: inspected.map(({ gate_checksum, ...entry }) => entry)
  };
}

export function validateProductionEvidence(evidence, { gate, now = Date.now() } = {}) {
  const errors = [];
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return { ok: false, errors: ["must be an object"] };
  if (evidence.version !== PRODUCTION_EVIDENCE_VERSION) errors.push(`version must be ${PRODUCTION_EVIDENCE_VERSION}`);
  if (!SHA.test(text(evidence.candidate_commit))) errors.push("candidate_commit must be a 40-character commit SHA");
  if (!validLocalReference(evidence.origin) && !/^https:\/\//.test(text(evidence.origin))) errors.push("origin must be recorded");
  if (!CHECKSUM.test(text(evidence.gate_checksum))) errors.push("gate_checksum must be a sha256 checksum");
  if (!Number.isFinite(Date.parse(text(evidence.generated_at))) || Date.parse(text(evidence.generated_at)) > new Date(now).getTime()) errors.push("generated_at must be a past ISO timestamp");
  if (evidence.status !== "pass") errors.push("status must be pass");
  const gateValidation = validateProductionGate(gate, { now });
  if (!gateValidation.ok) errors.push(...gateValidation.errors.map((error) => `gate.${error}`));
  if (text(evidence.candidate_commit) !== text(gate?.candidate_commit)) errors.push("candidate_commit must match the production gate");
  if (text(evidence.origin) !== text(gate?.origin)) errors.push("origin must match the production gate");
  if (text(evidence.gate_checksum) !== productionGateChecksum(gate)) errors.push("gate_checksum must match the canonical production gate");

  const expected = expectedEntries(gate);
  const entries = Array.isArray(evidence.entries) ? evidence.entries : [];
  for (const entry of entries) if (!expected.some((item) => item.id === entry?.id)) errors.push("entries contain an unknown evidence artifact");
  for (const definition of expected) {
    const matches = entries.filter((entry) => entry?.id === definition.id);
    if (matches.length !== 1) {
      errors.push(`${definition.id} must appear exactly once`);
      continue;
    }
    const entry = matches[0];
    if (!validLocalReference(entry.reference)) errors.push(`${definition.id}.reference must be a non-placeholder local work/ or infra/ path`);
    if (text(entry.reference) !== definition.reference) errors.push(`${definition.id}.reference must match the production gate reference`);
    if (!CHECKSUM.test(text(entry.checksum))) errors.push(`${definition.id}.checksum must be a sha256 checksum`);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > 10 * 1024 * 1024) errors.push(`${definition.id}.bytes must be a bounded positive integer`);
    if (definition.id.startsWith("evidence:") && text(entry.checksum) !== definition.gate_checksum) errors.push(`${definition.id}.checksum must match the production gate evidence checksum`);
  }
  return { ok: errors.length === 0, errors };
}

export function verifyProductionEvidence({ root = process.cwd(), evidence } = {}) {
  const errors = [];
  const verified = [];
  for (const entry of Array.isArray(evidence?.entries) ? evidence.entries : []) {
    try {
      const inspected = inspectStagingArtifact({ root, reference: entry.reference });
      if (inspected.checksum !== text(entry.checksum)) errors.push(`${entry.id} checksum does not match its local artifact`);
      if (inspected.bytes !== entry.bytes) errors.push(`${entry.id} byte count does not match its local artifact`);
      if (inspected.checksum === text(entry.checksum) && inspected.bytes === entry.bytes) verified.push(entry.id);
    } catch (error) {
      errors.push(`${entry.id} could not be verified: ${error.message}`);
    }
  }
  return { ok: errors.length === 0, errors, verified };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const gateReference = argumentValue(args, "--gate");
  const output = argumentValue(args, "--output");
  if (!gateReference || !output) {
    console.error("Usage: node infra/portal/production-evidence.mjs --gate work/production/gate.json --output work/production/evidence.json");
    process.exitCode = 1;
  } else {
    try {
      const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const gate = JSON.parse(fs.readFileSync(path.resolve(gateReference), "utf8"));
      const evidence = buildProductionEvidence({ root, gate });
      const destination = path.resolve(output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(evidence, null, 2)}\n`);
      console.log(`Production evidence manifest: ${destination}`);
    } catch (error) {
      console.error(`Unable to build production evidence manifest: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
