import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectStagingArtifact, readStagingJsonArtifact, validateStagingArtifactInspection } from "./staging-artifacts.mjs";

function fixture(t, content) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-artifact-read-"));
  const reference = "work/evidence.json";
  const file = path.join(root, reference);
  fs.mkdirSync(path.dirname(file)); fs.writeFileSync(file, content);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, reference, file };
}

test("JSON value, hash and size come from one hygiene-checked read", t => {
  const content = '{"status":"pass","note":"Observed fixture"}\n';
  const f = fixture(t, content);
  const original = fs.readFileSync;
  let reads = 0;
  t.mock.method(fs, "readFileSync", function(file, ...args) {
    if (String(file) === f.file && ++reads > 1) return Buffer.from('{"status":"fail"}');
    return original.call(fs, file, ...args);
  });
  const result = readStagingJsonArtifact(f);
  assert.equal(reads, 1);
  assert.equal(result.value.status, "pass");
  assert.equal(result.inspection.bytes, Buffer.byteLength(content));
  assert.equal(result.inspection.checksum, "sha256:" + createHash("sha256").update(content).digest("hex"));
  assert.equal(validateStagingArtifactInspection(result.inspection).ok, true);
  assert.deepEqual(Object.keys(result).sort(), ["inspection", "value"]);
});

test("malformed JSON errors never echo source excerpts", t => {
  const sentinel = "private-evidence-body-sentinel";
  const f = fixture(t, sentinel);
  assert.throws(() => readStagingJsonArtifact(f), error => error.message === "Staging artifact must contain valid JSON." && !error.message.includes(sentinel));
});

test("size changes between stat and read fail closed", t => {
  const f = fixture(t, '{}');
  const original = fs.readFileSync;
  t.mock.method(fs, "readFileSync", function(file, ...args) {
    return String(file) === f.file ? Buffer.from('{"extra":true}') : original.call(fs, file, ...args);
  });
  assert.throws(() => readStagingJsonArtifact(f), /size changed/);
});

for (const [label, content] of [["empty", Buffer.alloc(0)], ["NUL", Buffer.from([0])], ["invalid UTF8", Buffer.from([0xff])]]) {
  test(`single-read JSON rejects ${label} evidence`, t => {
    const f = fixture(t, content);
    assert.throws(() => readStagingJsonArtifact(f));
  });
}

test("inspection-only API exposes metadata, never the evidence body", t => {
  const f = fixture(t, '{"note":"non-secret fixture"}');
  const inspected = inspectStagingArtifact(f);
  assert.deepEqual(Object.keys(inspected).sort(), ["bytes", "checksum", "reference"]);
});

test("all staging JSON builders use the single-read boundary", () => {
  for (const file of ["staging-promotion-handoff.mjs", "staging-promotion-authorization.mjs", "staging-execution-review.mjs"]) {
    const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
    assert.match(source, /readStagingJsonArtifact as loadJsonArtifact/);
    assert.doesNotMatch(source, /JSON\.parse\(fs\.readFileSync\(resolveStagingArtifactPath/);
  }
});
