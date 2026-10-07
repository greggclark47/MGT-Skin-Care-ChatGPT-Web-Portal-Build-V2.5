import assert from "node:assert/strict";
import test from "node:test";
import { createReleaseImageManifest, validateReleaseImageManifest } from "./release-image-manifest.mjs";

const candidate = "a".repeat(40);
const api = `ghcr.io/mgt/api@sha256:${"b".repeat(64)}`;
const web = `ghcr.io/mgt/web@sha256:${"c".repeat(64)}`;

test("creates a candidate-bound immutable application image manifest", () => {
  const manifest = createReleaseImageManifest({ candidateCommit: candidate, repository: "mgt/repository", apiImage: api, webImage: web, now: "2026-10-07T00:00:00.000Z" });
  assert.equal(validateReleaseImageManifest(manifest).ok, true);
  assert.equal(manifest.candidate_commit, candidate);
  assert.deepEqual(manifest.images, { api, web });
});

test("rejects mutable, non-GHCR, identical, or detached image references", () => {
  const base = createReleaseImageManifest({ candidateCommit: candidate, repository: "mgt/repository", apiImage: api, webImage: web, now: "2026-10-07T00:00:00.000Z" });
  assert.equal(validateReleaseImageManifest({ ...base, images: { ...base.images, api: "ghcr.io/mgt/api:latest" } }).ok, false);
  assert.equal(validateReleaseImageManifest({ ...base, images: { ...base.images, api: `docker.io/mgt/api@sha256:${"b".repeat(64)}` } }).ok, false);
  assert.equal(validateReleaseImageManifest({ ...base, images: { api, web: api } }).ok, false);
  assert.equal(validateReleaseImageManifest({ ...base, candidate_commit: "detached" }).ok, false);
});
