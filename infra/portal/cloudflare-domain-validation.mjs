import { Resolver } from "node:dns/promises";
import { pathToFileURL } from "node:url";

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function unique(values) {
  return [...new Set(values.map(value => String(value).toLowerCase()))].sort();
}

async function optional(query) {
  try { return await query(); }
  catch (error) {
    if (["ENODATA", "ENOTFOUND", "ESERVFAIL"].includes(error?.code)) return [];
    throw error;
  }
}

export function cloudflareDomainChecks(result) {
  return [
    { id: "cloudflare_nameservers", healthy: result.nameservers.length >= 2 && result.nameservers.every(value => value.endsWith(".ns.cloudflare.com")), detail: result.nameservers.length ? result.nameservers.join(", ") : "No authoritative nameservers resolved." },
    { id: "apex_dns", healthy: result.apex_addresses.length > 0, detail: result.apex_addresses.length ? result.apex_addresses.join(", ") : "No apex A or AAAA record resolved." },
    { id: "www_dns", healthy: result.www_addresses.length > 0 || result.www_cnames.length > 0, detail: [...result.www_addresses, ...result.www_cnames].join(", ") || "No www A, AAAA, or CNAME record resolved." },
    { id: "apex_cloudflare_https", healthy: result.apex_http.reachable && result.apex_http.cloudflare && result.apex_http.status >= 200 && result.apex_http.status < 400, detail: result.apex_http.detail },
    { id: "www_canonical_redirect", healthy: result.www_http.reachable && result.www_http.cloudflare && [301, 308].includes(result.www_http.status) && result.www_http.location === `https://${result.domain}/cloudflare-validation?source=release`, detail: result.www_http.detail },
  ];
}

export async function validateCloudflareDomain(options = {}) {
  const domain = String(options.domain || "team47studio.com").trim().toLowerCase();
  if (!HOSTNAME.test(domain)) throw new Error("Cloudflare validation domain must be one canonical DNS hostname.");
  const resolver = options.resolver || new Resolver();
  if (!options.resolver) resolver.setServers(["1.1.1.1", "1.0.0.1"]);
  const fetchImpl = options.fetchImpl || fetch;
  const inspect = async url => {
    try {
      const response = await fetchImpl(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10_000) });
      const location = response.headers.get("location") || "";
      const cloudflare = response.headers.has("cf-ray") || response.headers.get("server")?.toLowerCase() === "cloudflare";
      return { reachable: true, status: response.status, location, cloudflare, detail: `HTTP ${response.status}${location ? ` → ${location}` : ""}${cloudflare ? " via Cloudflare" : " without a Cloudflare edge header"}` };
    } catch (error) {
      return { reachable: false, status: 0, location: "", cloudflare: false, detail: `HTTPS unavailable: ${error instanceof Error ? error.message : "request failed"}` };
    }
  };
  const [nameservers, apex4, apex6, www4, www6, wwwCnames, apexHttp, wwwHttp] = await Promise.all([
    optional(() => resolver.resolveNs(domain)),
    optional(() => resolver.resolve4(domain)),
    optional(() => resolver.resolve6(domain)),
    optional(() => resolver.resolve4(`www.${domain}`)),
    optional(() => resolver.resolve6(`www.${domain}`)),
    optional(() => resolver.resolveCname(`www.${domain}`)),
    inspect(`https://${domain}/cloudflare-validation?source=release`),
    inspect(`https://www.${domain}/cloudflare-validation?source=release`),
  ]);
  const result = {
    domain,
    resolver: "Cloudflare 1.1.1.1 / 1.0.0.1",
    checked_at: new Date().toISOString(),
    nameservers: unique(nameservers),
    apex_addresses: unique([...apex4, ...apex6]),
    www_addresses: unique([...www4, ...www6]),
    www_cnames: unique(wwwCnames),
    apex_http: apexHttp,
    www_http: wwwHttp,
  };
  const checks = cloudflareDomainChecks(result);
  return { ...result, ready: checks.every(check => check.healthy), checks };
}

async function main() {
  const result = await validateCloudflareDomain({ domain: process.argv[2] });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => {
  console.error(error instanceof Error ? error.message : "Cloudflare validation failed.");
  process.exitCode = 1;
});
