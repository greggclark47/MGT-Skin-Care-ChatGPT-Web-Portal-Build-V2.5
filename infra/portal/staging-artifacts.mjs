import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SHA = /^[0-9a-f]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const SAFE_LOCAL_REFERENCE = /^(?:work|infra)\/[A-Za-z0-9._/-]+$/;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;
const SECRET_VALUE = /(?:sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@|(?:OPENAI|SUPABASE|STRIPE)_[A-Z_]*(?:KEY|SECRET)[A-Z_]*\s*=\s*\S+)/i;
const TEXT_EXTENSIONS = new Set([".json", ".log", ".md", ".txt"]);
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export const STAGING_ARTIFACTS_VERSION = "1.0";
export const STAGING_ARTIFACT_IDS = Object.freeze(["deployment", "isolation", "secret_injection", "preflight", "probe", "rollback"]);

function text(value) {
  return String(value || "").trim();
}

function validPastIso(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) && parsed <= Date.now();
}

function validLocalReference(value) {
  const reference = text(value);
  return SAFE_LOCAL_REFERENCE.test(reference) && !reference.includes("..") && !PLACEHOLDER.test(reference);
}

function expectedReferences({ target = {}, attestation = {}, records = [] } = {}) {
  const rollbackReferences = [...new Set((Array.isArray(records) ? records : [])
    .map((record) => text(record?.rollback_reference))
    .filter(Boolean))];
  return {
    deployment: text(target.deployment_reference),
    isolation: text(target.isolation_reference),
    secret_injection: text(target.secret_injection_reference),
    preflight: text(attestation.preflight?.reference),
    probe: text(attestation.probe?.reference),
    rollback: rollbackReferences.length === 1 ? rollbackReferences[0] : ""
  };
}

export function resolveStagingArtifactPath({ root = process.cwd(), reference } = {}) {
  if (!validLocalReference(reference)) throw new Error("Artifact reference must be a non-placeholder work/ or infra/ path without traversal.");
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, reference);
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Artifact reference must remain inside the workspace root.");
  return resolved;
}

export function inspectStagingArtifact({ root = process.cwd(), reference } = {}) {
  const artifactPath = resolveStagingArtifactPath({ root, reference });
  const stat = fs.lstatSync(artifactPath);
  if (!stat.isFile()) throw new Error(`${reference} must be a regular file.`);
  if (stat.size < 1) throw new Error(`${reference} must not be empty.`);
  if (stat.size > MAX_EVIDENCE_BYTES) throw new Error(`${reference} exceeds the ${MAX_EVIDENCE_BYTES}-byte evidence limit.`);
  if (!TEXT_EXTENSIONS.has(path.extname(artifactPath).toLowerCase())) throw new Error(`${reference} must use a text evidence extension.`);
  const content = fs.readFileSync(artifactPath);
  if (content.includes(0)) throw new Error(`${reference} must be UTF-8 text evidence.`);
  const decoded = content.toString("utf8");
  if (!Buffer.from(decoded, "utf8").equals(content)) throw new Error(`${reference} must be valid UTF-8 text evidence.`);
  if (SECRET_VALUE.test(decoded)) throw new Error(`${reference} contains credential-like text and cannot be archived.`);
  return { reference: text(reference), checksum: `sha256:${createHash("sha256").update(content).digest("hex")}`, bytes: content.byteLength };
}

export function createStagingArtifactsTemplate({ candidateCommit } = {}) {
  return {
    version: STAGING_ARTIFACTS_VERSION,
    candidate_commit: candidateCommit || "REPLACE_WITH_40_CHARACTER_COMMIT_SHA",
    generated_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP",
    status: "pending",
    entries: STAGING_ARTIFACT_IDS.map((id) => ({
      id,
      reference: `work/staging/REPLACE_WITH_${id.toUpperCase()}_EVIDENCE.md`,
      checksum: "sha256:REPLACE_WITH_64_HEX_CHECKSUM",
      bytes: null
    }))
  };
}

export function buildStagingArtifacts({ root = process.cwd(), target, attestation, records, now = new Date().toISOString() } = {}) {
  const candidateCommit = text(target?.candidate_commit);
  if (!SHA.test(candidateCommit)) throw new Error("Staging target must identify a 40-character candidate commit before artifacts can be built.");
  const references = expectedReferences({ target, attestation, records });
  const missing = STAGING_ARTIFACT_IDS.filter((id) => !validLocalReference(references[id]));
  if (missing.length) throw new Error(`Artifact references are missing, unsafe, or not locally inspectable: ${missing.join(", ")}.`);
  return {
    version: STAGING_ARTIFACTS_VERSION,
    candidate_commit: candidateCommit,
    generated_at: new Date(now).toISOString(),
    status: "pass",
    entries: STAGING_ARTIFACT_IDS.map((id) => ({ id, ...inspectStagingArtifact({ root, reference: references[id] }) }))
  };
}

export function validateStagingArtifacts(artifacts, { candidateCommit, target, attestation, records } = {}) {
  const errors = [];
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)) return { ok: false, errors: ["must be an object"] };
  if (artifacts.version !== STAGING_ARTIFACTS_VERSION) errors.push(`version must be ${STAGING_ARTIFACTS_VERSION}`);
  if (!SHA.test(text(artifacts.candidate_commit))) errors.push("candidate_commit must be a 40-character commit SHA");
  if (SHA.test(text(candidateCommit)) && text(artifacts.candidate_commit) !== text(candidateCommit)) errors.push("candidate_commit must match the ship candidate");
  if (!validPastIso(artifacts.generated_at)) errors.push("generated_at must be a past ISO timestamp");
  if (artifacts.status !== "pass") errors.push("status must be pass");

  const references = expectedReferences({ target, attestation, records });
  const rollbackReferences = [...new Set((Array.isArray(records) ? records : []).map((record) => text(record?.rollback_reference)).filter(Boolean))];
  if (rollbackReferences.length !== 1) errors.push("all staging records must identify one shared rollback artifact");
  const entries = Array.isArray(artifacts.entries) ? artifacts.entries : [];
  for (const entry of entries) if (!STAGING_ARTIFACT_IDS.includes(entry?.id)) errors.push("entries contain an unknown artifact");
  for (const id of STAGING_ARTIFACT_IDS) {
    const matches = entries.filter((entry) => entry?.id === id);
    if (matches.length !== 1) {
      errors.push(`${id} must appear exactly once`);
      continue;
    }
    const entry = matches[0];
    if (!validLocalReference(entry.reference)) errors.push(`${id}.reference must be a non-placeholder local work/ or infra/ path`);
    if (validLocalReference(references[id]) && text(entry.reference) !== references[id]) errors.push(`${id}.reference must match the staging evidence reference`);
    if (!CHECKSUM.test(text(entry.checksum))) errors.push(`${id}.checksum must be a sha256 checksum`);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > MAX_EVIDENCE_BYTES) errors.push(`${id}.bytes must be a bounded positive integer`);
  }
  for (const id of ["preflight", "probe"]) {
    const entry = entries.find((item) => item?.id === id);
    const expectedChecksum = text(attestation?.[id]?.checksum);
    if (CHECKSUM.test(expectedChecksum) && text(entry?.checksum) !== expectedChecksum) errors.push(`${id}.checksum must match the attestation`);
  }
  if (SECRET_VALUE.test(JSON.stringify(artifacts))) errors.push("must not contain credential-like values");
  return { ok: errors.length === 0, errors };
}

export function verifyStagingArtifacts({ root = process.cwd(), artifacts } = {}) {
  const errors = [];
  const verified = [];
  const entries = Array.isArray(artifacts?.entries) ? artifacts.entries : [];
  for (const id of STAGING_ARTIFACT_IDS) {
    const entry = entries.find((item) => item?.id === id);
    if (!entry) {
      errors.push(`${id} is missing from the artifact manifest`);
      continue;
    }
    try {
      const inspected = inspectStagingArtifact({ root, reference: entry.reference });
      if (inspected.checksum !== text(entry.checksum)) errors.push(`${id} checksum does not match its local artifact`);
      if (inspected.bytes !== entry.bytes) errors.push(`${id} byte count does not match its local artifact`);
      if (inspected.checksum === text(entry.checksum) && inspected.bytes === entry.bytes) verified.push(id);
    } catch (error) {
      errors.push(`${id} could not be verified: ${error.message}`);
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
  const ledgerPath = argumentValue(args, "--ledger");
  const output = argumentValue(args, "--output");
  if (!ledgerPath || !output) {
    console.error("Usage: node infra/portal/staging-artifacts.mjs --ledger path/to/staging-evidence.json --output work/staging/artifacts.json");
    process.exitCode = 1;
  } else {
    try {
      const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const document = JSON.parse(fs.readFileSync(path.resolve(ledgerPath), "utf8"));
      const ledger = document.staging_evidence || document;
      const artifacts = buildStagingArtifacts({ root, target: ledger.target, attestation: ledger.attestation, records: ledger.records });
      const destination = path.resolve(output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify({ ...ledger, artifacts }, null, 2)}\n`);
      console.log(`Staging evidence ledger with artifact manifest: ${destination}`);
    } catch (error) {
      console.error(`Unable to build staging artifact manifest: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
