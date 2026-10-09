import assert from "node:assert/strict";
import { authorizationFixture } from "./test-fixtures/staging-authorization.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectStagingArtifact } from "./staging-artifacts.mjs";
import { buildStagingExecutionReview, validateStagingExecutionReceipt, validateStagingExecutionReview } from "./staging-execution-review.mjs";
import { stagingPromotionAuthorizationChecksum, validateStagingPromotionAuthorization } from "./staging-promotion-authorization.mjs";

const now = "2026-09-30T01:00:00.000Z";

function writeJson(root, reference, value) {
  const destination = path.join(root, reference);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(root, reference, value) {
  const destination = path.join(root, reference);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, value);
}


function probeFixture(origin) {
  return {
    version: "1.0",
    origin,
    captured_at: "2026-09-30T00:46:00.000Z",
    status: "pass",
    checks: ["/healthz", "/readyz"].map((pathname) => ({ pathname, expected_status: 200, actual_status: 200, service_status: "ok", duration_ms: 12, status: "pass" }))
  };
}

function setupFixture(root) {
  const authorization = authorizationFixture();
  const authorizationReference = "work/staging/authorization.json";
  const operationReference = "work/staging/operator-record.md";
  const probeReference = "work/staging/post-execution-probe.json";
  const receiptReference = "work/staging/execution-receipt.json";
  writeJson(root, authorizationReference, authorization);
  writeText(root, operationReference, "Operator recorded a non-secret staging action.\n");
  writeJson(root, probeReference, probeFixture(authorization.staging_origin));
  const operation = inspectStagingArtifact({ root, reference: operationReference });
  const probe = inspectStagingArtifact({ root, reference: probeReference });
  const receipt = {
    version: "1.0",
    status: "recorded",
    authorization_checksum: stagingPromotionAuthorizationChecksum(authorization),
    operator: "MGT Staging Operator",
    executed_at: "2026-09-30T00:45:00.000Z",
    operation,
    post_execution_probe: { reference: probeReference, checksum: probe.checksum }
  };
  writeJson(root, receiptReference, receipt);
  return { authorization, authorizationReference, operation, probe, probeReference, receipt, receiptReference };
}

test("binds a recorded operator receipt and fresh probe to pending authorization", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-staging-execution-"));
  try {
    const fixture = setupFixture(root);
    assert.equal(validateStagingPromotionAuthorization(fixture.authorization, { now }).ok, true);
    assert.equal(validateStagingExecutionReceipt(fixture.receipt, { authorization: fixture.authorization, operation: fixture.operation, probe: probeFixture(fixture.authorization.staging_origin), probeInspection: fixture.probe, now }).ok, true);
    const review = buildStagingExecutionReview({ root, authorizationReference: fixture.authorizationReference, receiptReference: fixture.receiptReference, probeReference: fixture.probeReference, now });
    assert.equal(review.status, "awaiting_external_release_gate");
    assert.equal(review.external_release_gate.status, "pending");
    assert.equal(validateStagingExecutionReview(review, { now }).ok, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("blocks out-of-window receipts and rejects an invented published review", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-staging-execution-"));
  try {
    const fixture = setupFixture(root);
    fixture.receipt.executed_at = "2026-09-30T00:15:00.000Z";
    writeJson(root, fixture.receiptReference, fixture.receipt);
    const blocked = buildStagingExecutionReview({ root, authorizationReference: fixture.authorizationReference, receiptReference: fixture.receiptReference, probeReference: fixture.probeReference, now });
    assert.equal(blocked.status, "blocked");
    assert.ok(blocked.blockers.some((blocker) => blocker.includes("approved execution window")));
    assert.equal(validateStagingExecutionReview({ ...blocked, status: "published" }, { now }).ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const invalidInspections = [
  ["missing", undefined], ["empty", {}], ["null", null], ["array", []],
  ["missing reference", { reference: undefined }], ["traversal", { reference: "work/../outside.md" }],
  ["nontext extension", { reference: "work/source.zip" }], ["coerced reference", { reference: ["work/evidence.md"] }],
  ["missing digest", { checksum: undefined }], ["invalid digest", { checksum: "invalid" }],
  ["digest whitespace", { checksum: "sha256:" + "a".repeat(64) + "\n" }],
  ["missing size", { bytes: undefined }], ["zero size", { bytes: 0 }], ["negative size", { bytes: -1 }],
  ["fractional size", { bytes: 1.5 }], ["string size", { bytes: "100" }], ["oversized", { bytes: 10 * 1024 * 1024 + 1 }]
];
for (const field of ["operation", "post_execution_probe"]) for (const [label, mutation] of invalidInspections) {
  test(`receipt rejects mutually matching ${label} ${field} inspection`, t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-receipt-inspection-"));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    const f = setupFixture(root);
    const options = { authorization: f.authorization, operation: f.operation, probe: probeFixture(f.authorization.staging_origin), probeInspection: f.probe, now };
    assert.equal(validateStagingExecutionReceipt(f.receipt, options).ok, true);
    const key = field === "operation" ? "operation" : "probeInspection";
    options[key] = mutation && !Array.isArray(mutation) && Object.keys(mutation).length ? { ...options[key], ...mutation } : mutation;
    // Deliberately make both sides equally invalid: equality alone is not evidence.
    f.receipt[field] = options[key] ?? {};
    const result = validateStagingExecutionReceipt(f.receipt, options);
    assert.equal(result.ok, false);
    assert(result.errors.some(error => error.startsWith(field + ".inspection")), result.errors.join("\n"));
  });
}

test("receipt references and checksums must match exactly without coercion", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-receipt-exact-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const f = setupFixture(root);
  const options = { authorization: f.authorization, operation: { ...f.operation }, probe: probeFixture(f.authorization.staging_origin), probeInspection: f.probe, now };
  f.receipt.operation = { ...f.receipt.operation, reference: " " + f.operation.reference };
  assert.equal(validateStagingExecutionReceipt(f.receipt, options).ok, false);
});
