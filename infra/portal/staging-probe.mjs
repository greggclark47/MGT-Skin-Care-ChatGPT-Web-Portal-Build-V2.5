import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const PLACEHOLDER = /REPLACE_WITH|YOUR-|example\.com|localhost|127\.0\.0\.1/i;
const PROBE_PATHS = Object.freeze(["/healthz", "/readyz"]);

export const STAGING_PROBE_VERSION = "1.0";

function text(value) {
  return String(value || "").trim();
}

function validOrigin(value) {
  try {
    const origin = new URL(text(value));
    return origin.protocol === "https:" && !PLACEHOLDER.test(origin.hostname) && origin.pathname === "/" && !origin.search && !origin.hash;
  } catch {
    return false;
  }
}

function validPastIso(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) && parsed <= Date.now();
}

export function createStagingProbeTemplate({ origin } = {}) {
  return {
    version: STAGING_PROBE_VERSION,
    origin: origin || "https://REPLACE_WITH_STAGING_ORIGIN",
    captured_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP",
    status: "pending",
    checks: PROBE_PATHS.map((pathname) => ({ pathname, expected_status: 200, actual_status: null, service_status: null, duration_ms: null, status: "pending" }))
  };
}

export function validateStagingProbe(probe, { origin } = {}) {
  const errors = [];
  if (!probe || typeof probe !== "object" || Array.isArray(probe)) return { ok: false, errors: ["must be an object"] };
  if (probe.version !== STAGING_PROBE_VERSION) errors.push(`version must be ${STAGING_PROBE_VERSION}`);
  if (!validOrigin(probe.origin)) errors.push("origin must be a non-placeholder HTTPS origin");
  if (origin && text(probe.origin) !== text(origin)) errors.push("origin must match the staging target");
  if (!validPastIso(probe.captured_at)) errors.push("captured_at must be a past ISO timestamp");
  if (probe.status !== "pass") errors.push("status must be pass");
  const checks = Array.isArray(probe.checks) ? probe.checks : [];
  for (const pathname of PROBE_PATHS) {
    const matches = checks.filter((check) => check?.pathname === pathname);
    if (matches.length !== 1) {
      errors.push(`${pathname} must appear exactly once`);
      continue;
    }
    const check = matches[0];
    if (check.expected_status !== 200) errors.push(`${pathname}.expected_status must be 200`);
    if (check.actual_status !== 200) errors.push(`${pathname}.actual_status must be 200`);
    if (check.service_status !== "ok") errors.push(`${pathname}.service_status must be ok`);
    if (!Number.isFinite(check.duration_ms) || check.duration_ms < 0) errors.push(`${pathname}.duration_ms must be a non-negative number`);
    if (check.status !== "pass") errors.push(`${pathname}.status must be pass`);
  }
  return { ok: errors.length === 0, errors };
}

export async function runStagingProbe({ origin, fetchImpl = fetch, now = () => Date.now() } = {}) {
  if (!validOrigin(origin)) throw new Error("origin must be a non-placeholder HTTPS origin");
  const checks = [];
  for (const pathname of PROBE_PATHS) {
    const started = now();
    const result = { pathname, expected_status: 200, actual_status: null, service_status: null, duration_ms: 0, status: "fail" };
    try {
      const response = await fetchImpl(new URL(pathname, origin).href, { headers: { accept: "application/json" }, redirect: "error" });
      const body = await response.json().catch(() => null);
      result.actual_status = response.status;
      result.service_status = body && typeof body.status === "string" ? body.status : "invalid";
      result.status = response.status === 200 && result.service_status === "ok" ? "pass" : "fail";
    } catch {
      result.service_status = "unreachable";
    }
    result.duration_ms = Math.max(0, now() - started);
    checks.push(result);
  }
  return { version: STAGING_PROBE_VERSION, origin, captured_at: new Date(now()).toISOString(), status: checks.every((check) => check.status === "pass") ? "pass" : "fail", checks };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const origin = argumentValue(process.argv.slice(2), "--origin");
  const output = argumentValue(process.argv.slice(2), "--output");
  if (!origin || !output) {
    console.error("Usage: node infra/portal/staging-probe.mjs --origin https://staging.example --output work/staging/probe.json");
    process.exitCode = 1;
  } else {
    try {
      const result = await runStagingProbe({ origin });
      const destination = path.resolve(output);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(result, null, 2)}\n`);
      console.log(`Staging probe: ${destination}`);
      if (result.status !== "pass") process.exitCode = 2;
    } catch (error) {
      console.error(`Staging probe failed: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
