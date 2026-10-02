import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateStagingPromotionApproval } from "./staging-promotion-approval.mjs";
import { buildStagingPromotionAuthorization, validateStagingPromotionAuthorization } from "./staging-promotion-authorization.mjs";
import { stagingPromotionHandoffChecksum, validateStagingPromotionHandoff } from "./staging-promotion-handoff.mjs";

const now = "2026-09-30T00:05:00.000Z";

function writeJson(root, reference, value) {
  const destination = path.join(root, reference);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`);
}

function handoffFixture() {
  return {
    version: "1.0",
    created_at: "2026-09-30T00:02:30.000Z",
    status: "pending_human_promotion_approval",
    candidate_commit: "a".repeat(40),
    staging_origin: "https://staging.mgtskincare.test",
    images: {
      node: `node@sha256:${"c".repeat(64)}`,
      ollama: `ollama/ollama@sha256:${"a".repeat(64)}`,
      caddy: `caddy@sha256:${"b".repeat(64)}`
    },
    evidence: {
      ledger: { reference: "work/staging/ledger.json", checksum: `sha256:${"1".repeat(64)}`, bytes: 100 },
      review: { reference: "work/staging/review.json", checksum: `sha256:${"2".repeat(64)}`, bytes: 100, reviewed_at: "2026-09-30T00:02:00.000Z", max_age_minutes: 60 }
    },
    checks: [
      { id: "ledger_contract", status: "pass", error_count: 0 },
      { id: "review_binding", status: "pass", error_count: 0 },
      { id: "target_identity", status: "pass", error_count: 0 },
      { id: "human_promotion_approval", status: "pending", error_count: 0 }
    ],
    required_human_approvals: ["release", "platform"],
    blockers: []
  };
}

function approvalFixture(role, handoff, reference) {
  return {
    version: "1.0",
    role,
    decision: "approve",
    approver: role === "release" ? "MGT Release Owner" : "MGT Platform Owner",
    approved_at: "2026-09-30T00:04:00.000Z",
    handoff_checksum: stagingPromotionHandoffChecksum(handoff),
    reference,
    execution_window: {
      start: "2026-09-30T00:30:00.000Z",
      end: "2026-09-30T02:00:00.000Z"
    }
  };
}

test("requires two fresh, checksum-bound human approvals before pending operator execution", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-staging-authorization-"));
  try {
    const handoff = handoffFixture();
    const release = approvalFixture("release", handoff, "https://evidence.mgtskincare.test/approvals/release");
    const platform = approvalFixture("platform", handoff, "https://evidence.mgtskincare.test/approvals/platform");
    const handoffReference = "work/staging/handoff.json";
    const releaseReference = "work/approvals/release.json";
    const platformReference = "work/approvals/platform.json";
    writeJson(root, handoffReference, handoff);
    writeJson(root, releaseReference, release);
    writeJson(root, platformReference, platform);

    assert.equal(validateStagingPromotionHandoff(handoff, { now }).ok, true);
    assert.equal(validateStagingPromotionApproval(release, { handoff, now, maxAgeMinutes: 60 }).ok, true);
    const authorization = buildStagingPromotionAuthorization({ root, handoffReference, releaseApprovalReference: releaseReference, platformApprovalReference: platformReference, now, maxApprovalAgeMinutes: 60 });
    assert.equal(authorization.status, "pending_operator_execution");
    assert.equal(authorization.operator_execution.status, "pending");
    assert.equal(validateStagingPromotionAuthorization(authorization, { now }).ok, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("blocks stale, mismatched, or invented execution authorization", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-staging-authorization-"));
  try {
    const handoff = handoffFixture();
    const release = approvalFixture("release", handoff, "https://evidence.mgtskincare.test/approvals/release");
    const platform = approvalFixture("platform", handoff, "https://evidence.mgtskincare.test/approvals/platform");
    const handoffReference = "work/staging/handoff.json";
    const releaseReference = "work/approvals/release.json";
    const platformReference = "work/approvals/platform.json";
    writeJson(root, handoffReference, handoff);
    writeJson(root, releaseReference, release);
    writeJson(root, platformReference, platform);

    const stale = buildStagingPromotionAuthorization({ root, handoffReference, releaseApprovalReference: releaseReference, platformApprovalReference: platformReference, now: "2026-09-30T02:00:00.000Z", maxApprovalAgeMinutes: 60 });
    assert.equal(stale.status, "blocked");
    assert.ok(stale.blockers.some((blocker) => blocker.includes("freshness")));

    platform.execution_window.end = "2026-09-30T02:30:00.000Z";
    writeJson(root, platformReference, platform);
    const mismatched = buildStagingPromotionAuthorization({ root, handoffReference, releaseApprovalReference: releaseReference, platformApprovalReference: platformReference, now, maxApprovalAgeMinutes: 60 });
    assert.equal(mismatched.status, "blocked");
    assert.ok(mismatched.blockers.some((blocker) => blocker.includes("share one execution window")));
    assert.equal(validateStagingPromotionAuthorization({ ...mismatched, status: "approved" }, { now }).ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
