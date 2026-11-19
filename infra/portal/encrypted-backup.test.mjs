import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { decryptBytes, encryptBytes, encryptFile, restoreFile, keyFromHex } from "./encrypted-backup.mjs";

const KEY = keyFromHex("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
const COMMIT = "0123456789abcdef0123456789abcdef01234567";

test("encrypts and restores a candidate-bound payload into an isolated directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mgt-encrypted-backup-"));
  const input = path.join(root, "export.json");
  const encrypted = path.join(root, "export.mgtenc.json");
  const restore = path.join(root, "isolated");
  const source = Buffer.from('{"kind":"synthetic","customer_rows":0}\n');
  fs.writeFileSync(input, source);
  const created = encryptFile({ input, output: encrypted, candidateCommit: COMMIT, key: KEY, now: "2026-01-01T00:00:00.000Z" });
  assert.equal(created.plaintext_bytes, source.length);
  const result = restoreFile({ input: encrypted, outputDir: restore, candidateCommit: COMMIT, key: KEY });
  assert.equal(result.isolated_restore, true);
  assert.deepEqual(fs.readFileSync(result.restored), source);
});

test("rejects a wrong key, candidate mismatch, and tampered ciphertext", () => {
  const document = encryptBytes(Buffer.from("payload"), { candidateCommit: COMMIT, key: KEY, now: "2026-01-01T00:00:00.000Z" });
  assert.throws(() => decryptBytes(document, { key: keyFromHex("f".repeat(64)), candidateCommit: COMMIT }), /authentication failed/);
  assert.throws(() => decryptBytes(document, { key: KEY, candidateCommit: "abcdefabcdefabcdefabcdefabcdefabcdefabcd" }), /candidate_commit/);
  const tampered = { ...document, ciphertext: `${document.ciphertext.slice(0, -2)}AA` };
  assert.throws(() => decryptBytes(tampered, { key: KEY, candidateCommit: COMMIT }), /authentication failed/);
});
