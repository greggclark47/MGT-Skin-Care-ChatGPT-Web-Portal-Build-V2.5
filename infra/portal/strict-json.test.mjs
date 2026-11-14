import assert from "node:assert/strict";
import test from "node:test";
import { parseStrictJson } from "./strict-json.mjs";

test("parses valid nested JSON and preserves escaped keys", () => {
  assert.deepEqual(parseStrictJson('{"a":{"\\u0062":[1,true,null]},"c":2}'), { a: { b: [1, true, null] }, c: 2 });
});

test("rejects duplicate keys at every object depth", () => {
  assert.throws(() => parseStrictJson('{"status":"pending","status":"go"}'), /Duplicate JSON object key: status/);
  assert.throws(() => parseStrictJson('{"nested":{"id":1,"id":2}}'), /Duplicate JSON object key: id/);
});

test("retains JSON.parse syntax and trailing-content failures", () => {
  assert.throws(() => parseStrictJson('{"ok":}'), /Unexpected token/);
  assert.throws(() => parseStrictJson('{"ok":true} trailing'), /Unexpected non-whitespace character/);
});
