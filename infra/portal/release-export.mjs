import { createHash } from "node:crypto";
import { matchesDriveFileIdentity } from "./drive-file-identity.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { productionPrerequisitesChecksum } from "./production-prerequisites.mjs";
import { scanGitCommit } from "./tracked-secret-scan.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const REFERENCE = /^(?:work|infra)\/[A-Za-z0-9._/-]+$|^(?:README\.md|NEXT-PHASE-IMPLEMENTATION-PLAN\.md)$/;
const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;
const SECRET_VALUE = /(?:sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+|postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@|(?:OPENAI|SUPABASE|STRIPE)_[A-Z_]*(?:KEY|SECRET)[A-Z_]*\s*=\s*\S+)/i;
const TEXT_EXTENSIONS = new Set([".json", ".log", ".md", ".txt"]);
const PACKAGE_EXTENSIONS = new Set([".json", ".log", ".md", ".txt", ".zip"]);
const MAX_EXPORT_BYTES = 50 * 1024 * 1024;

export const RELEASE_EXPORT_VERSION = "1.0";
export const RELEASE_EXPORT_DESTINATIONS = Object.freeze(["github", "google_drive"]);
export const DEFAULT_EXPORT_REFERENCES = Object.freeze([
  "README.md",
  "NEXT-PHASE-IMPLEMENTATION-PLAN.md",
  "infra/portal/README.md",
  "infra/portal/RELEASE-CHECKPOINT.md"
]);

function text(value) {
  return String(value || "").trim();
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function releaseExportChecksum(manifest) {
  const { bundle_checksum: _ignored, ...unsigned } = manifest || {};
  // The backup receipt mirrors both its own artifact checksum and the final
  // bundle checksum. Exclude only those mirrored fields from the unsigned
  // input to avoid a self-referential hash; the receipt remains bound by
  // artifact and manifest field checks below.
  if (unsigned.backup_status) {
    unsigned.backup_status = {
      ...unsigned.backup_status,
      checksum: null,
      bundle_checksum: null,
      ...(unsigned.backup_status.archive ? { archive: { ...unsigned.backup_status.archive, bundle_checksum: null } } : {})
    };
  }
  return `sha256:${createHash("sha256").update(canonicalize(unsigned)).digest("hex")}`;
}

function validReference(reference) {
  const value = text(reference);
  return REFERENCE.test(value) && !value.includes("..") && !PLACEHOLDER.test(value);
}

export function resolveReleaseReference({ root = process.cwd(), reference } = {}) {
  if (!validReference(reference)) throw new Error("Export reference must be a safe repository-relative README, work/, or infra/ path without traversal.");
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, reference);
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Export reference must remain inside the workspace root.");
  return resolved;
}

export function inspectReleaseArtifact({ root = process.cwd(), reference } = {}) {
  const artifactPath = resolveReleaseReference({ root, reference });
  const stat = fs.lstatSync(artifactPath);
  if (!stat.isFile()) throw new Error(`${reference} must be a regular file.`);
  if (stat.size < 1) throw new Error(`${reference} must not be empty.`);
  if (stat.size > MAX_EXPORT_BYTES) throw new Error(`${reference} exceeds the ${MAX_EXPORT_BYTES}-byte export limit.`);
  const extension = path.extname(artifactPath).toLowerCase();
  if (!PACKAGE_EXTENSIONS.has(extension)) throw new Error(`${reference} must use a supported export extension.`);
  const content = fs.readFileSync(artifactPath);
  if (TEXT_EXTENSIONS.has(extension)) {
    if (content.includes(0)) throw new Error(`${reference} must be UTF-8 text.`);
    const decoded = content.toString("utf8");
    if (!Buffer.from(decoded, "utf8").equals(content)) throw new Error(`${reference} must be valid UTF-8 text.`);
    if (SECRET_VALUE.test(decoded)) throw new Error(`${reference} contains credential-like text and cannot be exported.`);
  }
  return {
    reference: text(reference),
    kind: extension === ".zip" ? "archive" : "text",
    checksum: `sha256:${createHash("sha256").update(content).digest("hex")}`,
    bytes: content.byteLength
  };
}

function inspectPrerequisitePacket({ root, reference, candidateCommit }) {
  const artifact = inspectReleaseArtifact({ root, reference });
  if (path.extname(artifact.reference).toLowerCase() !== ".json") throw new Error("production prerequisite evidence must be a JSON file.");
  let document;
  try {
    document = JSON.parse(fs.readFileSync(resolveReleaseReference({ root, reference }), "utf8"));
  } catch {
    throw new Error("production prerequisite evidence must be valid JSON.");
  }
  if (document?.version !== "1.0") throw new Error("production prerequisite evidence must use version 1.0.");
  if (text(document?.candidate_commit) !== text(candidateCommit)) throw new Error("production prerequisite evidence must bind the exact candidate commit.");
  if (!["blocked_on_configuration", "blocked_on_external_prerequisites"].includes(document?.status)) throw new Error("production prerequisite evidence must remain blocked until live prerequisites are supplied.");
  if (text(document?.prerequisites_checksum) !== productionPrerequisitesChecksum(document)) throw new Error("production prerequisite evidence checksum is invalid.");
  if (!document?.local?.evidence || !["not_evaluated", "verified", "blocked"].includes(document.local.evidence.status)) throw new Error("production prerequisite evidence must include a bounded local evidence status.");
  return {
    ...artifact,
    status: document.status,
    evidence_status: document.local.evidence.status,
    candidate_commit: text(document.candidate_commit)
  };
}

function inspectBackupStatus({ root, reference, candidateCommit }) {
  const artifact = inspectReleaseArtifact({ root, reference });
  if (path.extname(artifact.reference).toLowerCase() !== ".json") throw new Error("backup status evidence must be a JSON file.");
  let document;
  try {
    document = JSON.parse(fs.readFileSync(resolveReleaseReference({ root, reference }), "utf8"));
  } catch {
    throw new Error("backup status evidence must be valid JSON.");
  }
  if (text(document?.candidate_commit) !== text(candidateCommit)) throw new Error("backup status evidence must bind the exact candidate commit.");
  if (document?.github?.status !== "verified" || !Array.isArray(document.github.repositories) || !document.github.repositories.length) throw new Error("backup status evidence must report verified GitHub destinations.");
  for (const repository of document.github.repositories) {
    if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(text(repository?.url))) throw new Error("backup status evidence contains an invalid GitHub repository URL.");
    if (text(repository?.sha) !== text(candidateCommit)) throw new Error("backup status evidence must bind every GitHub repository to the candidate commit.");
  }
  if (document?.google_drive?.status !== "verified" || !/^[A-Za-z0-9_-]{10,}$/.test(text(document.google_drive.folder_id)) || !/^https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+$/.test(text(document.google_drive.folder_url))) throw new Error("backup status evidence must report a verified designated Google Drive folder.");
  if (!CHECKSUM.test(text(document?.archive?.sha256)) || !CHECKSUM.test(text(document?.archive?.bundle_sha256))) throw new Error("backup status evidence must include archive and bundle checksums.");
  if (document?.production_status !== "NOT_READY") throw new Error("backup status evidence must preserve the production hold.");
  return {
    ...artifact,
    github_repositories: document.github.repositories.length,
    google_drive_folder_id: text(document.google_drive.folder_id),
    archive_checksum: text(document.archive.sha256),
    bundle_checksum: text(document.archive.bundle_sha256),
    production_status: document.production_status,
    candidate_commit: text(document.candidate_commit)
  };
}

export function createReleaseArchive({ root = process.cwd(), candidateCommit = "", reference = "" } = {}) {
  const commit = text(candidateCommit) || gitValue(root, ["rev-parse", "HEAD"]);
  if (!SHA.test(commit)) throw new Error("candidate_commit must be a 40-character commit SHA.");
  const archiveReference = text(reference);
  if (!/^work\/exports\/[A-Za-z0-9._/-]+\.zip$/.test(archiveReference) || archiveReference.includes("..")) {
    throw new Error("Archive output must be a safe work/exports/*.zip reference without traversal.");
  }
  const expectedChecksum = gitArchiveChecksum(root, commit);
  const destination = resolveReleaseReference({ root, reference: archiveReference });
  if (fs.existsSync(destination)) {
    const existing = inspectReleaseArtifact({ root, reference: archiveReference });
    if (existing.checksum !== expectedChecksum) throw new Error(`${archiveReference} already exists and does not reproduce candidate commit ${commit}.`);
    return { ...existing, candidate_commit: commit, created: false };
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const result = spawnSync("git", ["archive", "--format=zip", `--output=${destination}`, commit], { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.status !== 0 || !fs.existsSync(destination)) throw new Error("Unable to create the candidate archive from Git.");
  const created = inspectReleaseArtifact({ root, reference: archiveReference });
  if (created.checksum !== expectedChecksum) throw new Error(`${archiveReference} does not reproduce candidate commit ${commit}.`);
  return { ...created, candidate_commit: commit, created: true };
}

function gitValue(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? text(result.stdout) : "";
}

function gitRemotes(root) {
  const output = gitValue(root, ["remote", "-v"]);
  return [...new Set(output.split(/\r?\n/).map((line) => line.match(/^\S+\s+(\S+)\s+\(fetch\)$/)?.[1]).filter(Boolean))];
}

function gitArchiveChecksum(root, commit) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-release-archive-"));
  const archive = path.join(temporary, "candidate.zip");
  try {
    const result = spawnSync("git", ["archive", "--format=zip", `--output=${archive}`, commit], { cwd: root, encoding: "utf8", windowsHide: true });
    if (result.status !== 0 || !fs.existsSync(archive)) throw new Error("Unable to reproduce the candidate archive from Git.");
    return `sha256:${createHash("sha256").update(fs.readFileSync(archive)).digest("hex")}`;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function destinationTemplate({ root, candidateCommit, branch } = {}) {
  return {
    github: {
      status: "pending_push",
      repository: gitRemotes(root),
      branch: branch || gitValue(root, ["branch", "--show-current"]),
      commit: candidateCommit
    },
    google_drive: {
      status: "pending_upload",
      file_name: `MGT-Skin-Care-v2-${candidateCommit.slice(0, 12)}-export.zip`,
      folder_id: null,
      file_id: null,
      web_url: null
    }
  };
}

export function buildReleaseExport({ root = process.cwd(), candidateCommit = "", branch = "", references = DEFAULT_EXPORT_REFERENCES, archiveReference = "", prerequisitesReference = "", backupStatusReference = "", now = new Date().toISOString() } = {}) {
  const commit = text(candidateCommit) || gitValue(root, ["rev-parse", "HEAD"]);
  if (!SHA.test(commit)) throw new Error("candidate_commit must be a 40-character commit SHA.");
  const chosen = [...new Set([...references, archiveReference].map(text).filter(Boolean))];
  if (!chosen.length) throw new Error("At least one export reference is required.");
  const errors = [];
  const entries = [];
  for (const reference of chosen) {
    try {
      entries.push({ id: reference.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase(), ...inspectReleaseArtifact({ root, reference }) });
    } catch (error) {
      errors.push(`${reference}: ${error.message}`);
    }
  }
  let prerequisites = null;
  if (prerequisitesReference) {
    try {
      prerequisites = inspectPrerequisitePacket({ root, reference: prerequisitesReference, candidateCommit: commit });
    } catch (error) {
      errors.push(`${prerequisitesReference}: ${error.message}`);
    }
  }
  let backup_status = null;
  if (backupStatusReference) {
    try {
      backup_status = inspectBackupStatus({ root, reference: backupStatusReference, candidateCommit: commit });
    } catch (error) {
      errors.push(`${backupStatusReference}: ${error.message}`);
    }
  }
  if (archiveReference) {
    const archive = entries.find((entry) => entry.reference === archiveReference);
    try {
      if (archive?.checksum !== gitArchiveChecksum(root, commit)) errors.push(`${archiveReference}: archive must exactly reproduce candidate commit ${commit}`);
    } catch (error) {
      errors.push(`${archiveReference}: ${error.message}`);
    }
  }
  const manifest = {
    version: RELEASE_EXPORT_VERSION,
    candidate_commit: commit,
    branch: text(branch) || gitValue(root, ["branch", "--show-current"]),
    generated_at: new Date(now).toISOString(),
    status: errors.length ? "blocked" : "ready_for_export",
    destinations: destinationTemplate({ root, candidateCommit: commit, branch }),
    entries,
    prerequisites,
    backup_status,
    errors
  };
  if (manifest.backup_status) manifest.backup_status.bundle_checksum = releaseExportChecksum(manifest);
  return { ...manifest, bundle_checksum: releaseExportChecksum(manifest) };
}

export function validateReleaseExport(manifest, { now = Date.now() } = {}) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return { ok: false, errors: ["must be an object"] };
  if (manifest.version !== RELEASE_EXPORT_VERSION) errors.push(`version must be ${RELEASE_EXPORT_VERSION}`);
  if (!SHA.test(text(manifest.candidate_commit))) errors.push("candidate_commit must be a 40-character commit SHA");
  if (!Number.isFinite(Date.parse(text(manifest.generated_at))) || Date.parse(text(manifest.generated_at)) > new Date(now).getTime()) errors.push("generated_at must be a past ISO timestamp");
  if (!["ready_for_export", "blocked", "exported"].includes(manifest.status)) errors.push("status must be a known export state");
  if (!CHECKSUM.test(text(manifest.bundle_checksum)) || text(manifest.bundle_checksum) !== releaseExportChecksum(manifest)) errors.push("bundle_checksum must match the canonical export manifest");
  const prerequisites = manifest.prerequisites;
  if (prerequisites !== null && prerequisites !== undefined) {
    if (!validReference(prerequisites.reference)) errors.push("prerequisites.reference must be a safe local path");
    if (!CHECKSUM.test(text(prerequisites.checksum))) errors.push("prerequisites.checksum must be a sha256 checksum");
    if (!SHA.test(text(prerequisites.candidate_commit)) || text(prerequisites.candidate_commit) !== text(manifest.candidate_commit)) errors.push("prerequisites.candidate_commit must bind the candidate commit");
    if (!["blocked_on_configuration", "blocked_on_external_prerequisites"].includes(prerequisites.status)) errors.push("prerequisites.status must remain blocked until live prerequisites are supplied");
    if (!["not_evaluated", "verified", "blocked"].includes(prerequisites.evidence_status)) errors.push("prerequisites.evidence_status must be bounded");
  }
  const backupStatus = manifest.backup_status;
  if (backupStatus !== null && backupStatus !== undefined) {
    if (!validReference(backupStatus.reference)) errors.push("backup_status.reference must be a safe local path");
    if (!CHECKSUM.test(text(backupStatus.checksum))) errors.push("backup_status.checksum must be a sha256 checksum");
    if (!SHA.test(text(backupStatus.candidate_commit)) || text(backupStatus.candidate_commit) !== text(manifest.candidate_commit)) errors.push("backup_status.candidate_commit must bind the candidate commit");
    if (!Number.isSafeInteger(backupStatus.github_repositories) || backupStatus.github_repositories < 1) errors.push("backup_status.github_repositories must be positive");
    if (!/^[A-Za-z0-9_-]{10,}$/.test(text(backupStatus.google_drive_folder_id))) errors.push("backup_status.google_drive_folder_id must be bounded");
    if (!CHECKSUM.test(text(backupStatus.archive_checksum)) || !CHECKSUM.test(text(backupStatus.bundle_checksum))) errors.push("backup_status must include archive and bundle checksums");
    if (text(backupStatus.bundle_checksum) !== releaseExportChecksum(manifest)) errors.push("backup_status.bundle_checksum must bind the final release bundle checksum");
    if (backupStatus.production_status !== "NOT_READY") errors.push("backup_status.production_status must preserve the production hold");
  }
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  const ids = new Set();
  for (const entry of entries) {
    if (ids.has(entry?.id)) errors.push("entries must use unique ids");
    ids.add(entry?.id);
    if (!validReference(entry?.reference)) errors.push(`${entry?.id || "entry"}.reference must be a safe local path`);
    if (!CHECKSUM.test(text(entry?.checksum))) errors.push(`${entry?.id || "entry"}.checksum must be a sha256 checksum`);
    if (!Number.isSafeInteger(entry?.bytes) || entry.bytes < 1 || entry.bytes > MAX_EXPORT_BYTES) errors.push(`${entry?.id || "entry"}.bytes must be bounded`);
    if (!["text", "archive"].includes(entry?.kind)) errors.push(`${entry?.id || "entry"}.kind must be text or archive`);
  }
  const destinations = manifest.destinations || {};
  if (!destinations.github || !["pending_push", "pushed"].includes(destinations.github.status)) errors.push("github destination must be pending_push or pushed");
  if (!destinations.google_drive || !["pending_upload", "uploaded"].includes(destinations.google_drive.status)) errors.push("google_drive destination must be pending_upload or uploaded");
  if (destinations.google_drive?.status === "uploaded" && !matchesDriveFileIdentity(destinations.google_drive.file_id, destinations.google_drive.web_url)) errors.push("uploaded google_drive destination must include an observed file_id and matching HTTPS web_url on drive.google.com");
  if (destinations.github?.status === "pushed" && (!SHA.test(text(destinations.github.commit)) || text(destinations.github.commit) !== text(manifest.candidate_commit))) errors.push("pushed github destination must bind the candidate commit");
  return { ok: errors.length === 0, errors };
}

export function verifyReleaseExport({ root = process.cwd(), manifest } = {}) {
  const errors = [];
  const verified = [];
  for (const entry of Array.isArray(manifest?.entries) ? manifest.entries : []) {
    try {
      const inspected = inspectReleaseArtifact({ root, reference: entry.reference });
      if (inspected.checksum !== text(entry.checksum)) errors.push(`${entry.id} checksum does not match its local artifact`);
      if (inspected.bytes !== entry.bytes) errors.push(`${entry.id} byte count does not match its local artifact`);
      if (inspected.checksum === text(entry.checksum) && inspected.bytes === entry.bytes) verified.push(entry.id);
    } catch (error) {
      errors.push(`${entry?.id || "entry"} could not be verified: ${error.message}`);
    }
  }
  if (manifest?.prerequisites) {
    try {
      const inspected = inspectPrerequisitePacket({ root, reference: manifest.prerequisites.reference, candidateCommit: manifest.candidate_commit });
      if (inspected.checksum !== text(manifest.prerequisites.checksum)) errors.push("prerequisites checksum does not match its local artifact");
      if (inspected.status !== manifest.prerequisites.status || inspected.evidence_status !== manifest.prerequisites.evidence_status) errors.push("prerequisites status does not match its local artifact");
    } catch (error) {
      errors.push(`prerequisites could not be verified: ${error.message}`);
    }
  }
  if (manifest?.backup_status) {
    try {
      const inspected = inspectBackupStatus({ root, reference: manifest.backup_status.reference, candidateCommit: manifest.candidate_commit });
      for (const field of ["checksum", "github_repositories", "google_drive_folder_id", "archive_checksum", "bundle_checksum", "production_status"]) {
        if (inspected[field] !== manifest.backup_status[field]) errors.push(`backup_status ${field} does not match its local artifact`);
      }
    } catch (error) {
      errors.push(`backup_status could not be verified: ${error.message}`);
    }
  }
  for (const entry of Array.isArray(manifest?.entries) ? manifest.entries.filter((candidate) => candidate?.kind === "archive") : []) {
    try {
      if (text(entry.checksum) !== gitArchiveChecksum(root, text(manifest?.candidate_commit))) errors.push(`${entry.id} archive does not reproduce the candidate commit`);
    } catch (error) {
      errors.push(`${entry?.id || "archive"} provenance could not be verified: ${error.message}`);
    }
  }
  const validation = validateReleaseExport(manifest);
  errors.push(...validation.errors);
  return { ok: errors.length === 0, errors: [...new Set(errors)], verified };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const output = argumentValue(args, "--output");
  const archive = argumentValue(args, "--archive");
  const createArchive = argumentValue(args, "--create-archive");
  const references = argumentValue(args, "--references");
  const prerequisites = argumentValue(args, "--prerequisites");
  const backupStatus = argumentValue(args, "--backup-status");
  const candidateCommitArgument = argumentValue(args, "--candidate-commit");
  if (!output) {
    console.error("Usage: node infra/portal/release-export.mjs --output work/exports/release-export.json [--candidate-commit <sha>] [--references README.md,infra/portal/README.md] [--prerequisites work/production/prerequisites.json] [--backup-status work/exports/backup-status.json] [--archive work/exports/package.zip] [--create-archive work/exports/package.zip]");
    process.exitCode = 1;
  } else {
    try {
      const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const candidateCommit = candidateCommitArgument || gitValue(root, ["rev-parse", "HEAD"]);
      if (archive && createArchive) throw new Error("Use either --archive or --create-archive, not both.");
      const credentialFindings = scanGitCommit(root, candidateCommit);
      if (credentialFindings.length) throw new Error(`Candidate commit credential scan found ${credentialFindings.length} potential finding(s); inspect the commit before export.`);
      if (createArchive) createReleaseArchive({ root, candidateCommit, reference: createArchive });
      const manifest = buildReleaseExport({ root, candidateCommit, references: references ? references.split(",") : DEFAULT_EXPORT_REFERENCES, prerequisitesReference: prerequisites, backupStatusReference: backupStatus, archiveReference: createArchive || archive });
      const destination = path.resolve(root, output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(`Release export manifest: ${destination}`);
      if (manifest.status === "blocked") process.exitCode = 2;
    } catch (error) {
      console.error(`Unable to build release export manifest: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
