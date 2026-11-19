import { createHash, verify as verifySignature } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readStrictJsonFile } from "./strict-json.mjs";
import { utcTimestamp } from "./approval-window.mjs";

const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const KEY_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SIGNATURE = /^[A-Za-z0-9_-]{86,90}$/;
const ROLES = new Set(["release", "platform", "data", "support", "accessibility"]);
const VERSION = "1.0";
const MAX_WINDOW_MS = 4 * 60 * 60 * 1000;

function text(value) { return typeof value === "string" ? value : ""; }
function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function signedApprovalPayload(approval) {
  const { signature: _signature, payload_checksum: _payloadChecksum, ...unsigned } = approval || {};
  return canonicalize(unsigned);
}

export function signedApprovalPayloadChecksum(approval) {
  return `sha256:${createHash("sha256").update(signedApprovalPayload(approval)).digest("hex")}`;
}

function validSubject(value) {
  return typeof value === "string" && value.length >= 2 && value.length <= 256 && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
}

function signatureBytes(value) {
  if (!SIGNATURE.test(text(value))) return null;
  try {
    const decoded = Buffer.from(value, "base64url");
    return decoded.length === 64 ? decoded : null;
  } catch {
    return null;
  }
}

export function validateSignedApproval(approval, { now = Date.now() } = {}) {
  const errors = [];
  if (!approval || typeof approval !== "object" || Array.isArray(approval)) return { ok: false, errors: ["approval must be an object"] };
  if (approval.version !== VERSION) errors.push(`version must be ${VERSION}`);
  if (!ROLES.has(text(approval.role))) errors.push("role must be an approved release role");
  if (!SHA.test(text(approval.candidate_commit))) errors.push("candidate_commit must be a 40-character commit SHA");
  if (!CHECKSUM.test(text(approval.artifact_checksum))) errors.push("artifact_checksum must be a sha256 checksum");
  if (!validSubject(approval.signer_subject)) errors.push("signer_subject must be a bounded non-secret subject reference");
  if (!KEY_ID.test(text(approval.key_id))) errors.push("key_id must be a bounded signing-key identifier");
  const signedAt = utcTimestamp(approval.signed_at);
  const expiresAt = utcTimestamp(approval.expires_at);
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(signedAt) || signedAt > nowMs) errors.push("signed_at must be a valid non-future UTC timestamp");
  if (!Number.isFinite(expiresAt) || !Number.isFinite(signedAt) || expiresAt <= signedAt || expiresAt - signedAt > MAX_WINDOW_MS) errors.push("expires_at must follow signed_at within four hours");
  if (Number.isFinite(expiresAt) && expiresAt <= nowMs) errors.push("expires_at must be in the future at review time");
  if (text(approval.payload_checksum) !== signedApprovalPayloadChecksum(approval)) errors.push("payload_checksum must match the canonical approval payload");
  if (!signatureBytes(approval.signature)) errors.push("signature must be a 64-byte base64url Ed25519 signature");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function verifySignedApproval({ approval, publicKey, now = Date.now() } = {}) {
  const structural = validateSignedApproval(approval, { now });
  if (!structural.ok) return structural;
  if (typeof publicKey !== "string" || publicKey.length < 32 || publicKey.length > 4096) return { ok: false, errors: ["publicKey must be a bounded PEM public key"] };
  try {
    const valid = verifySignature(null, Buffer.from(signedApprovalPayload(approval), "utf8"), publicKey, signatureBytes(approval.signature));
    return valid ? { ok: true, errors: [] } : { ok: false, errors: ["signature does not verify against the approval payload"] };
  } catch {
    return { ok: false, errors: ["publicKey or signature could not be verified"] };
  }
}

function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const approvalReference = argumentValue(args, "--approval");
  const publicKeyReference = argumentValue(args, "--public-key");
  const output = argumentValue(args, "--output");
  if (!approvalReference || !publicKeyReference || !output) {
    console.error("Usage: node infra/portal/signed-approval.mjs --approval work/approvals/release.json --public-key work/approvals/release.pub --output work/approvals/release-review.json");
    process.exitCode = 1;
  } else try {
    const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
    const approval = readStrictJsonFile(path.resolve(root, approvalReference));
    const publicKey = fs.readFileSync(path.resolve(root, publicKeyReference), "utf8");
    const result = { version: VERSION, role: text(approval.role) || null, candidate_commit: SHA.test(text(approval.candidate_commit)) ? text(approval.candidate_commit) : null, status: "blocked", errors: [] };
    const verification = verifySignedApproval({ approval, publicKey });
    result.status = verification.ok ? "signature_verified" : "blocked";
    result.errors = verification.errors;
    const destination = path.resolve(root, output);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`Signed approval review: ${destination}`);
    if (!verification.ok) process.exitCode = 2;
  } catch (error) {
    console.error(`Unable to review signed approval: ${error.message}`);
    process.exitCode = 1;
  }
}
