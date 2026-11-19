// Synthetic non-secret evidence only; never constitutes a human approval.
export function authorizationFixture() {
  const window = { start: "2026-09-30T00:30:00.000Z", end: "2026-09-30T02:00:00.000Z" };
  return {
    version: "1.1", created_at: "2026-09-30T00:05:00.000Z",
    max_approval_age_minutes: 60, status: "pending_operator_execution",
    candidate_commit: "a".repeat(40), staging_origin: "https://staging.mgtskincare.test",
    handoff: { reference: "work/staging/handoff.json", checksum: `sha256:${"1".repeat(64)}`, canonical_checksum: `sha256:${"2".repeat(64)}`, bytes: 100 },
    approvals: ["release", "platform"].map((role, index) => ({
      version: "1.0", role, decision: "approve", approver: "Gregg Clark of MGT",
      approved_at: "2026-09-30T00:04:00.000Z", handoff_checksum: `sha256:${"2".repeat(64)}`,
      reference: `work/approvals/${role}.md`, execution_window: { ...window },
      artifact: { reference: `work/approvals/${role}.json`, checksum: `sha256:${String(index + 3).repeat(64)}` }
    })),
    execution_window: { ...window },
    checks: ["handoff_integrity", "release_approval", "platform_approval", "shared_execution_window", "operator_execution"]
      .map(id => ({ id, status: id === "operator_execution" ? "pending" : "pass", error_count: 0 })),
    operator_execution: { status: "pending", restriction: "Synthetic fixture; no command included." }, blockers: []
  };
}
