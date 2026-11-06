import assert from "node:assert/strict";
import test from "node:test";
import { validateCloudflareDomain } from "./cloudflare-domain-validation.mjs";

function resolver(overrides = {}) {
  return {
    resolveNs: async () => ["cloe.ns.cloudflare.com", "garrett.ns.cloudflare.com"],
    resolve4: async name => name.startsWith("www.") ? ["104.21.2.3"] : ["172.67.4.5"],
    resolve6: async () => [],
    resolveCname: async () => [],
    ...overrides,
  };
}

function response(status, headers = {}) {
  return { status, headers: new Headers(headers) };
}

test("Cloudflare gate accepts authoritative DNS, edge HTTPS, and exact www-to-apex redirect", async () => {
  const result = await validateCloudflareDomain({
    resolver: resolver(),
    fetchImpl: async url => String(url).startsWith("https://www.")
      ? response(308, { server: "cloudflare", location: "https://team47studio.com/cloudflare-validation?source=release" })
      : response(200, { "cf-ray": "test-IAD" }),
  });
  assert.equal(result.ready, true);
  assert.equal(result.checks.length, 5);
  assert(result.checks.every(check => check.healthy));
});

test("Cloudflare gate fails closed when address records and HTTPS are unavailable", async () => {
  const noData = Object.assign(new Error("no data"), { code: "ENODATA" });
  const result = await validateCloudflareDomain({
    resolver: resolver({ resolve4: async () => { throw noData; }, resolve6: async () => { throw noData; }, resolveCname: async () => { throw noData; } }),
    fetchImpl: async () => { throw new Error("getaddrinfo ENOTFOUND"); },
  });
  assert.equal(result.ready, false);
  assert.equal(result.checks.find(check => check.id === "cloudflare_nameservers")?.healthy, true);
  assert.equal(result.checks.find(check => check.id === "apex_dns")?.healthy, false);
  assert.equal(result.checks.find(check => check.id === "www_dns")?.healthy, false);
  assert.equal(result.checks.find(check => check.id === "apex_cloudflare_https")?.healthy, false);
});

test("Cloudflare gate rejects noncanonical input before any network request", async () => {
  await assert.rejects(() => validateCloudflareDomain({ domain: "https://team47studio.com" }), /canonical DNS hostname/);
});
