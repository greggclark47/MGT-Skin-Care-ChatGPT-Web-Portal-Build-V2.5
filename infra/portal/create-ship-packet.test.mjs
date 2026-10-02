import assert from "node:assert/strict";
import test from "node:test";
import { buildDraftShipPacket } from "./create-ship-packet.mjs";

test("creates a secret-free candidate packet from repository metadata", () => {
  const packet = buildDraftShipPacket({
    root: ".",
    branch: "codex/release-candidate",
    commit: "a".repeat(40),
    now: "2026-09-28T00:00:00.000Z",
    env: {
      NODE_IMAGE: `node@sha256:${"c".repeat(64)}`,
      OLLAMA_IMAGE: `ollama/ollama@sha256:${"a".repeat(64)}`,
      CADDY_IMAGE: `caddy@sha256:${"b".repeat(64)}`,
      OLLAMA_ENABLED: "true",
      SUPABASE_SERVICE_ROLE_KEY: "super-secret-value"
    },
    checkpointReport: "work/checkpoints/2026-09-28/report.md",
    verificationReport: "work/verification/2026-09-28/report.md"
  });
  assert.equal(packet.candidate.commit, "a".repeat(40));
  assert.equal(packet.candidate.branch, "codex/release-candidate");
  assert.equal(packet.images.node, `node@sha256:${"c".repeat(64)}`);
  assert.equal(packet.version, "1.2");
  assert.equal(packet.staging_evidence.target.candidate_commit, "a".repeat(40));
  assert.equal(packet.staging_evidence.version, "1.2");
  assert.equal(packet.staging_evidence.artifacts.entries.length, 6);
  assert.equal(packet.staging_evidence.records.length, 4);
  assert.equal(packet.evidence.some((item) => item.id === "ai_provider"), true);
  assert.equal(JSON.stringify(packet).includes("super-secret-value"), false);
});

test("adds conditional evidence only for enabled boundaries", () => {
  const packet = buildDraftShipPacket({ now: "2026-09-28T00:00:00.000Z", env: { SUBSCRIPTIONS_ENABLED: "false", OLLAMA_ENABLED: "false" } });
  assert.equal(packet.evidence.some((item) => item.id === "stripe_sandbox"), false);
  assert.equal(packet.evidence.some((item) => item.id === "ai_provider"), false);
  assert.equal(packet.evidence.length, 5);
});

test("keeps the draft visibly incomplete for human release completion", () => {
  const packet = buildDraftShipPacket({ now: "2026-09-28T00:00:00.000Z", env: {} });
  assert.equal(packet.approvals.every((approval) => approval.decision === "pending"), true);
  assert.equal(packet.owners.release.startsWith("REPLACE_WITH_"), true);
  assert.equal(packet.staging_evidence.records.every((record) => record.status === "pending"), true);
  assert.equal(packet.monitoring.checks.join(","), "15m,1h,24h,7d");
});
