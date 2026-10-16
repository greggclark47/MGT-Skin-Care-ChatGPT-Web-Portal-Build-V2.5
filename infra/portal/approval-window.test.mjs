import assert from "node:assert/strict";
import test from "node:test";
import { utcTimestamp, validExecutionWindow, executionWithinWindow } from "./approval-window.mjs";
import { authorizationFixture } from "./test-fixtures/staging-authorization.mjs";
import { validateStagingPromotionApproval } from "./staging-promotion-approval.mjs";
import { validateStagingPromotionAuthorization, stagingPromotionAuthorizationChecksum } from "./staging-promotion-authorization.mjs";
import { validateStagingExecutionReceipt } from "./staging-execution-review.mjs";

const now = "2026-09-30T03:00:00.000Z";
function receiptFixture() {
  const authorization = authorizationFixture();
  const operation = { reference: "work/staging/operation.md", checksum: "sha256:" + "8".repeat(64), bytes: 100 };
  const probeInspection = { reference: "work/staging/probe.json", checksum: "sha256:" + "9".repeat(64), bytes: 100 };
  const probe = { version: "1.0", origin: authorization.staging_origin, captured_at: "2026-09-30T02:00:00.000Z", status: "pass",
    checks: ["/healthz", "/readyz"].map(pathname => ({ pathname, expected_status: 200, actual_status: 200, service_status: "ok", duration_ms: 1, status: "pass" })) };
  return { receipt: { version: "1.0", status: "recorded", authorization_checksum: stagingPromotionAuthorizationChecksum(authorization), operator: "Gregg Clark of MGT",
    executed_at: "2026-09-30T00:45:00.000Z", operation, post_execution_probe: probeInspection },
    options: { authorization, operation, probe, probeInspection, now } };
}
function assertValid(result) { assert.equal(result.ok, true, result.errors.join("\n")); }

const invalid = [
  ["missing", undefined], ["null", null], ["empty", ""], ["number", 0], ["object", {}],
  ["array", ["2026-09-30T00:30:00.000Z"]], ["date only", "2026-09-30"],
  ["impossible date", "2026-02-30T00:30:00.000Z"],
  ["whitespace", " 2026-09-30T00:30:00.000Z"], ["non UTC offset", "2026-09-30T00:30:00+00:00"]
];
const paths = [
  ["created_at"], ["approvals", 0, "approved_at"], ["approvals", 1, "approved_at"],
  ...["start", "end"].flatMap(edge => [["execution_window", edge], ["approvals", 0, "execution_window", edge], ["approvals", 1, "execution_window", edge]])
];
assert.equal((paths.length + 1) * invalid.length, 100);
for (const [label, value] of invalid) {
  for (const field of paths) test(`authorization rejects ${label} timestamp at ${field.join(".")}`, () => {
    const authorization = authorizationFixture();
    assertValid(validateStagingPromotionAuthorization(authorization, { now }));
    const parent = field.slice(0, -1).reduce((node, key) => node[key], authorization);
    parent[field.at(-1)] = value;
    assert.equal(validateStagingPromotionAuthorization(authorization, { now }).ok, false);
  });
  test(`execution receipt rejects ${label} timestamp`, () => {
    const { receipt, options } = receiptFixture();
    assertValid(validateStagingExecutionReceipt(receipt, options));
    receipt.executed_at = value;
    assert.equal(validateStagingExecutionReceipt(receipt, options).ok, false);
  });
}

test("UTC round-trip rejects impossible dates and times", () => {
  for (const date of ["2024-02-29T23:59:59Z", "2026-09-30T00:30:00.000Z"]) assert(Number.isFinite(utcTimestamp(date)));
  for (const date of ["2026-02-29T00:00:00Z", "2026-09-30T24:00:00Z", "2026-09-30T00:60:00Z", "2026-09-30T00:00:60Z"]) assert(Number.isNaN(utcTimestamp(date)));
});

test("four-hour limit and start-inclusive/end-exclusive boundaries", () => {
  const window = { start: "2026-09-30T00:30:00.000Z", end: "2026-09-30T04:30:00.000Z" };
  assert.equal(validExecutionWindow(window), true);
  assert.equal(validExecutionWindow({ ...window, end: "2026-09-30T04:30:00.001Z" }), false);
  assert.equal(validExecutionWindow({ ...window, end: window.start }), false);
  assert.equal(validExecutionWindow({ start: window.end, end: window.start }), false);
  for (const [at, valid] of [[window.start, true], ["2026-09-30T04:29:59.999Z", true], [window.end, false], ["2026-09-30T00:29:59.999Z", false]]) assert.equal(executionWithinWindow(at, window), valid);
  for (const [at, valid] of [["2026-09-30T00:30:00.000Z", true], ["2026-09-30T01:59:59.999Z", true], ["2026-09-30T02:00:00.000Z", false]]) {
    const { receipt, options } = receiptFixture(); receipt.executed_at = at;
    assert.equal(validateStagingExecutionReceipt(receipt, options).ok, valid);
  }
});

test("historical receipts remain auditable but cannot authorize new execution", () => {
  const { receipt, options } = receiptFixture();
  options.now = "2026-10-09T00:00:00.000Z";
  assertValid(validateStagingExecutionReceipt(receipt, options));
  receipt.executed_at = "2026-10-08T00:00:00.000Z";
  assert.equal(validateStagingExecutionReceipt(receipt, options).ok, false);
});

test("standalone receipt requires valid, pending, checksum-matched authorization", () => {
  for (const change of [() => undefined, () => null, a => ({ ...a, status: "blocked", blockers: ["hold"] }), a => ({ ...a, version: "1.0" }), a => ({ ...a, approvals: {} }), a => ({ ...a, execution_window: null }), a => ({ ...a, candidate_commit: "b".repeat(40) })]) {
    const { receipt, options } = receiptFixture();
    options.authorization = change(options.authorization);
    assert.equal(validateStagingExecutionReceipt(receipt, options).ok, false);
  }
});

test("summary binding, separate records, exact checks and issuance chronology are mandatory", () => {
  const changes = [
    a => { a.approvals[0].handoff_checksum = "sha256:" + "f".repeat(64); },
    a => { a.approvals[0].decision = "pending"; },
    a => { a.approvals[0].version = "0.9"; },
    a => { a.approvals[0].artifact = null; },
    a => { a.approvals[0].artifact.reference = "work/../approvals/release.json"; },
    a => { a.approvals[0].artifact.reference = "work//approvals/platform.json"; },
    a => { a.approvals[0].artifact = { ...a.approvals[1].artifact }; },
    a => { a.approvals.push({ ...a.approvals[0], role: "other" }); },
    a => { a.approvals[0] = null; },
    a => { a.checks.push(null); },
    a => { a.checks[0] = null; },
    a => { a.checks[4].error_count = 1; },
    a => { a.execution_window.end = "2026-09-30T02:01:00.000Z"; },
    a => { a.approvals[1].execution_window.start = "2026-09-30T00:31:00.000Z"; },
    a => { delete a.max_approval_age_minutes; },
    a => { a.max_approval_age_minutes = 1.5; },
    a => { a.max_approval_age_minutes = "60"; },
    a => { a.approvals[0].approved_at = "2026-09-29T23:04:59.999Z"; },
    a => { a.approvals[0].approved_at = "2026-09-30T00:05:00.001Z"; },
    a => { a.created_at = "2026-09-30T00:31:00.000Z"; },
    a => { for (const window of [a.execution_window, ...a.approvals.map(p => p.execution_window)]) window.end = "2026-09-30T04:30:00.001Z"; }
  ];
  for (const change of changes) {
    const authorization = authorizationFixture(); change(authorization);
    assert.equal(validateStagingPromotionAuthorization(authorization, { now }).ok, false, change.toString());
  }
});

test("exact freshness limit passes; invalid clocks and fractional policies fail", () => {
  const a = authorizationFixture();
  a.approvals[0].approved_at = "2026-09-29T23:05:00.000Z";
  assertValid(validateStagingPromotionAuthorization(a, { now }));
  assert.equal(validateStagingPromotionAuthorization(a, { now: "invalid" }).ok, false);
  assert.equal(validateStagingPromotionApproval(a.approvals[0], { now: "invalid" }).ok, false);
  assert.equal(validateStagingPromotionApproval(a.approvals[0], { now: a.created_at, maxAgeMinutes: 60.5 }).ok, false);
});

test("probe timestamp must be strict, observed, and no earlier than execution", () => {
  for (const at of [undefined, "2026-09-30", "2026-09-30T00:44:59.999Z", "2026-09-30T03:00:00.001Z"]) {
    const { receipt, options } = receiptFixture(); options.probe.captured_at = at;
    assert.equal(validateStagingExecutionReceipt(receipt, options).ok, false);
  }
});
