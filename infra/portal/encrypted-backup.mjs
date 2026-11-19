import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const ENCRYPTED_BACKUP_VERSION = "1.0";
const KEY_HEX = /^[a-f0-9]{64}$/i;
const SHA256 = /^sha256:[a-f0-9]{64}$/i;

function text(value) {
  return String(value || "").trim();
}

export function keyFromHex(value) {
  const key = text(value);
  if (!KEY_HEX.test(key)) throw new Error("Backup key must be exactly 64 hexadecimal characters (32 bytes).");
  return Buffer.from(key, "hex");
}

export function keyFromPassphrase(passphrase, salt) {
  const value = text(passphrase);
  if (value.length < 16) throw new Error("Backup passphrase must contain at least 16 characters.");
  return scryptSync(value, salt, 32, { N: 16_384, r: 8, p: 1 });
}

function sha256(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function readKey() {
  const value = process.env.BACKUP_ENCRYPTION_KEY;
  if (!value) throw new Error("BACKUP_ENCRYPTION_KEY is required and must be injected by the approved secret manager.");
  return keyFromHex(value);
}

export function encryptBytes(bytes, { candidateCommit = "", key = readKey(), now = new Date().toISOString() } = {}) {
  if (!Buffer.isBuffer(bytes)) throw new Error("encryptBytes expects a Buffer.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return {
    version: ENCRYPTED_BACKUP_VERSION,
    algorithm: "aes-256-gcm",
    candidate_commit: text(candidateCommit) || null,
    created_at: new Date(now).toISOString(),
    plaintext_bytes: bytes.byteLength,
    plaintext_sha256: sha256(bytes),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
}

export function decryptBytes(document, { key = readKey(), candidateCommit = "" } = {}) {
  if (!document || typeof document !== "object" || Array.isArray(document)) throw new Error("Encrypted backup must be a JSON object.");
  if (document.version !== ENCRYPTED_BACKUP_VERSION || document.algorithm !== "aes-256-gcm") throw new Error("Unsupported encrypted backup format.");
  if (candidateCommit && text(document.candidate_commit) && text(document.candidate_commit) !== text(candidateCommit)) throw new Error("Encrypted backup candidate_commit does not match the requested candidate.");
  if (!Number.isSafeInteger(document.plaintext_bytes) || document.plaintext_bytes < 0) throw new Error("Encrypted backup plaintext_bytes is invalid.");
  if (!SHA256.test(text(document.plaintext_sha256))) throw new Error("Encrypted backup plaintext_sha256 is invalid.");
  let iv;
  let authTag;
  let ciphertext;
  try {
    iv = Buffer.from(text(document.iv), "base64");
    authTag = Buffer.from(text(document.auth_tag), "base64");
    ciphertext = Buffer.from(text(document.ciphertext), "base64");
  } catch {
    throw new Error("Encrypted backup payload is not valid base64.");
  }
  if (iv.length !== 12 || authTag.length !== 16 || !ciphertext.length) throw new Error("Encrypted backup payload is malformed.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const bytes = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (bytes.byteLength !== document.plaintext_bytes || sha256(bytes) !== text(document.plaintext_sha256)) throw new Error("Encrypted backup plaintext checksum does not match.");
    return bytes;
  } catch (error) {
    throw new Error(`Encrypted backup authentication failed: ${error.message}`);
  }
}

export function encryptFile({ input, output, candidateCommit = "", key = readKey(), now } = {}) {
  const bytes = fs.readFileSync(path.resolve(input));
  const document = encryptBytes(bytes, { candidateCommit, key, now });
  const destination = path.resolve(output);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o600 });
  return { output: destination, bytes: Buffer.byteLength(JSON.stringify(document)), plaintext_bytes: bytes.byteLength, plaintext_sha256: document.plaintext_sha256 };
}

export function restoreFile({ input, outputDir, candidateCommit = "", key = readKey() } = {}) {
  const document = JSON.parse(fs.readFileSync(path.resolve(input), "utf8"));
  const bytes = decryptBytes(document, { key, candidateCommit });
  const destination = path.resolve(outputDir || fs.mkdtempSync(path.join(os.tmpdir(), "mgt-restore-")));
  fs.mkdirSync(destination, { recursive: true });
  const restored = path.join(destination, "payload.bin");
  fs.writeFileSync(restored, bytes, { mode: 0o600 });
  return { restored, bytes: bytes.byteLength, sha256: sha256(bytes), isolated_restore: true };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const command = args[0];
  const input = argumentValue(args, "--input");
  const output = argumentValue(args, "--output");
  const outputDir = argumentValue(args, "--output-dir");
  const candidateCommit = argumentValue(args, "--candidate-commit");
  try {
    if (command === "encrypt" && input && output) {
      console.log(JSON.stringify(encryptFile({ input, output, candidateCommit }), null, 2));
    } else if (command === "restore" && input) {
      console.log(JSON.stringify(restoreFile({ input, outputDir, candidateCommit }), null, 2));
    } else {
      throw new Error("Usage: encrypted-backup.mjs encrypt --input FILE --output FILE [--candidate-commit SHA] | restore --input FILE [--output-dir DIR] [--candidate-commit SHA]");
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
