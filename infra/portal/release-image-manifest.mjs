import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const RELEASE_IMAGE_MANIFEST_VERSION = "1.0";

const SHA = /^[0-9a-f]{40}$/i;
const DIGEST_IMAGE = /^ghcr\.io\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/;
const REPOSITORY = /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i;

function text(value) {
  return String(value || "").trim();
}

export function validateReleaseImageManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return { ok: false, errors: ["manifest must be an object"] };
  if (manifest.version !== RELEASE_IMAGE_MANIFEST_VERSION) errors.push(`version must be ${RELEASE_IMAGE_MANIFEST_VERSION}`);
  if (!SHA.test(text(manifest.candidate_commit))) errors.push("candidate_commit must be a 40-character commit SHA");
  if (!REPOSITORY.test(text(manifest.source_repository))) errors.push("source_repository must be an owner/repository identifier");
  const generatedAt = Date.parse(text(manifest.generated_at));
  if (!Number.isFinite(generatedAt) || generatedAt > Date.now()) errors.push("generated_at must be a past ISO timestamp");
  for (const key of ["api", "web"]) {
    if (!DIGEST_IMAGE.test(text(manifest.images?.[key]))) errors.push(`images.${key} must be an immutable GHCR @sha256 reference`);
  }
  if (text(manifest.images?.api) === text(manifest.images?.web)) errors.push("API and web images must be distinct");
  return { ok: errors.length === 0, errors };
}

export function createReleaseImageManifest({ candidateCommit, repository, apiImage, webImage, now = new Date().toISOString() } = {}) {
  const manifest = {
    version: RELEASE_IMAGE_MANIFEST_VERSION,
    generated_at: new Date(now).toISOString(),
    candidate_commit: text(candidateCommit),
    source_repository: text(repository),
    images: { api: text(apiImage), web: text(webImage) }
  };
  const validation = validateReleaseImageManifest(manifest);
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  return manifest;
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2);
    const output = argumentValue(args, "--output");
    if (!output) throw new Error("--output is required");
    const manifest = createReleaseImageManifest({
      candidateCommit: argumentValue(args, "--candidate"),
      repository: argumentValue(args, "--repository"),
      apiImage: argumentValue(args, "--api-image"),
      webImage: argumentValue(args, "--web-image")
    });
    const destination = path.resolve(output);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Release image manifest: ${destination}`);
  } catch (error) {
    console.error(`Unable to create release image manifest: ${error.message}`);
    process.exitCode = 1;
  }
}
