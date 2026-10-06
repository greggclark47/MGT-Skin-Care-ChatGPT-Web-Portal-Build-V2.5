import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

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

function gitValue(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? text(result.stdout) : "";
}

function gitRemotes(root) {
  const output = gitValue(root, ["remote", "-v"]);
  return [...new Set(output.split(/\r?\n/).map((line) => line.match(/^\S+\s+(\S+)\s+\(fetch\)$/)?.[1]).filter(Boolean))];
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

export function buildReleaseExport({ root = process.cwd(), candidateCommit = "", branch = "", references = DEFAULT_EXPORT_REFERENCES, archiveReference = "", now = new Date().toISOString() } = {}) {
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
  const manifest = {
    version: RELEASE_EXPORT_VERSION,
    candidate_commit: commit,
    branch: text(branch) || gitValue(root, ["branch", "--show-current"]),
    generated_at: new Date(now).toISOString(),
    status: errors.length ? "blocked" : "ready_for_export",
    destinations: destinationTemplate({ root, candidateCommit: commit, branch }),
    entries,
    errors
  };
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
  if (destinations.google_drive?.status === "uploaded" && (!text(destinations.google_drive.file_id) || !/^https:\/\//.test(text(destinations.google_drive.web_url)))) errors.push("uploaded google_drive destination must include an observed file_id and HTTPS web_url");
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
  const references = argumentValue(args, "--references");
  if (!output) {
    console.error("Usage: node infra/portal/release-export.mjs --output work/exports/release-export.json [--references README.md,infra/portal/README.md] [--archive work/exports/package.zip]");
    process.exitCode = 1;
  } else {
    try {
      const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
      const manifest = buildReleaseExport({ root, references: references ? references.split(",") : DEFAULT_EXPORT_REFERENCES, archiveReference: archive });
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
