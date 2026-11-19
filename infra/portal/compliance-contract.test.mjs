import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readComplianceSources, validateComplianceContract, validateComplianceRepository } from "./compliance-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("Path B source controls remain internally consistent", () => {
  const result = validateComplianceRepository(root);
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("a reviewed route cannot lose durable disclosure enforcement", () => {
  const sources = readComplianceSources(root);
  const start = sources.server.indexOf("const reviewedAnswer");
  const end = sources.server.indexOf("post('/coach'", start);
  const reviewed = sources.server.slice(start, end).replace(/requireAiDisclosure\(r,req\.actor\)/, "Promise.resolve({version:AI_DISCLOSURE_VERSION,captured_at:'fixture'})");
  sources.server = sources.server.slice(0, start) + reviewed + sources.server.slice(end);
  const result = validateComplianceContract(sources);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("durable_ai_disclosure:")));
});

test("a retired single-price variable blocks the release contract", () => {
  const sources = readComplianceSources(root);
  sources.server += "\nconst retired = env.STRIPE_PREMIUM_PRICE_ID;\n";
  const result = validateComplianceContract(sources);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("retired_billing_paths_removed:")));
});

test("a mobile-visible shared tier cannot be removed from the published catalog", () => {
  const sources = readComplianceSources(root);
  sources.membership = sources.membership.replace("id: 'studio'", "id: 'removed-studio'");
  const result = validateComplianceContract(sources);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.startsWith("membership_catalog:")));
});
