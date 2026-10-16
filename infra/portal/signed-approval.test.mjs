import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { signedApprovalPayload, signedApprovalPayloadChecksum, validateSignedApproval, verifySignedApproval } from "./signed-approval.mjs";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const PUBLIC_KEY = publicKey.export({ type: "spki", format: "pem" });

function approval(overrides = {}) {
  const base = {
    version: "1.0",
    role: "release",
    candidate_commit: "a".repeat(40),
    artifact_checksum: `sha256:${"b".repeat(64)}`,
    signer_subject: "gregg-subject-reference",
    key_id: "primary",
    signed_at: "2026-10-16T18:00:00.000Z",
    expires_at: "2026-10-16T19:00:00.000Z"
  };
  const unsigned = { ...base, ...overrides };
  const payload = signedApprovalPayload(unsigned);
  return {
    ...unsigned,
    payload_checksum: signedApprovalPayloadChecksum(unsigned),
    signature: sign(null, Buffer.from(payload), privateKey).toString("base64url")
  };
}

test("accepts a candidate-bound Ed25519 approval envelope", () => {
  const result = verifySignedApproval({ approval: approval(), publicKey: PUBLIC_KEY, now: "2026-10-16T18:30:00.000Z" });
  assert.deepEqual(result, { ok: true, errors: [] });
});

test("rejects payload mutation, wrong key, and malformed identity fields", () => {
  const original = approval();
  const changed = { ...original, artifact_checksum: `sha256:${"c".repeat(64)}` };
  assert.ok(verifySignedApproval({ approval: changed, publicKey: PUBLIC_KEY, now: "2026-10-16T18:30:00.000Z" }).errors.some((error) => error.includes("payload_checksum")));
  assert.ok(verifySignedApproval({ approval: original, publicKey: generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "pem" }), now: "2026-10-16T18:30:00.000Z" }).errors.some((error) => error.includes("does not verify")));
  assert.equal(validateSignedApproval({ ...original, signer_subject: "bad\nsubject" }, { now: "2026-10-16T18:30:00.000Z" }).ok, false);
});

test("rejects future, expired, and overlong approval windows", () => {
  const future = approval({ signed_at: "2026-10-16T20:00:00.000Z" });
  assert.ok(validateSignedApproval(future, { now: "2026-10-16T18:30:00.000Z" }).errors.some((error) => error.includes("non-future")));
  const expired = approval({ expires_at: "2026-10-16T18:20:00.000Z" });
  assert.ok(validateSignedApproval(expired, { now: "2026-10-16T18:30:00.000Z" }).errors.some((error) => error.includes("expires_at")));
  const long = approval({ expires_at: "2026-10-17T00:00:00.000Z" });
  assert.ok(validateSignedApproval(long, { now: "2026-10-16T18:30:00.000Z" }).errors.some((error) => error.includes("four hours")));
});
