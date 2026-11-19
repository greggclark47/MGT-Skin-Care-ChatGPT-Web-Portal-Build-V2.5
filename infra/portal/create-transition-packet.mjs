import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { scanGitCommit, scanText, trackedFiles } from "./tracked-secret-scan.mjs";

const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const text = (value) => String(value ?? "").trim();
const isoNow = () => new Date().toISOString();

function command(commandName, args, failure) {
  const result = spawnSync(commandName, args, { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${failure}${result.stderr ? `: ${result.stderr.trim()}` : ""}`);
  return result.stdout.trim();
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? text(process.argv[index + 1]) : "";
}

function safeName(value) {
  return text(value).replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${contents.replace(/\r?\n/g, os.EOL)}${os.EOL}`, "utf8");
}

function relative(from, to) {
  return path.relative(from, to).replaceAll("\\", "/");
}

function scanPacket(stage) {
  const findings = [];
  for (const entry of fs.readdirSync(stage, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    if (fs.statSync(absolute).size > 10 * 1024 * 1024) continue;
    const content = fs.readFileSync(absolute);
    if (content.includes(0)) continue;
    for (const finding of scanText(content.toString("utf8"))) findings.push({ file: relative(stage, absolute), ...finding });
  }
  if (findings.length) throw new Error(`Generated transition packet contains ${findings.length} high-confidence credential finding(s): ${findings.map((finding) => `${finding.file}:${finding.line}`).join(", ")}`);
}

function writeManifest(stage) {
  const lines = [];
  for (const entry of fs.readdirSync(stage, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    const name = relative(stage, absolute);
    if (name === "integrity/MANIFEST.sha256") continue;
    lines.push(`${sha256(absolute)}  ${name}`);
  }
  lines.sort((a, b) => a.localeCompare(b));
  write(path.join(stage, "integrity", "MANIFEST.sha256"), lines.join("\n"));
}

function handoff({ commit, tree, sourceFile, verificationFile, trackedCount }) {
  return `# Team 47 Studio transition handoff

Generated: ${isoNow()}

## Purpose

This package transfers the verified Team 47 Studio application candidate to another engineering or AI platform without exporting live credentials, customer data, or production access. It is suitable for a Claude, Google Cloud, or comparable delivery team to assess, continue, and operate the build under its own approved identities.

## Candidate identity

- Commit: \`${commit}\`
- Git tree: \`${tree}\`
- Tracked source files: ${trackedCount}
- Source snapshot: \`source/${sourceFile}\`
- Local verification evidence: \`reports/${verificationFile}\`

## Integrity procedure

1. Extract the outer packet without changing its directory structure.
2. Verify every entry against \`integrity/MANIFEST.sha256\`.
3. Verify the SHA-256 of the source snapshot against \`integrity/source-snapshot.sha256\`.
4. Extract the source snapshot into a new Git repository or isolated workspace.
5. Read \`handoff/SECRET-MIGRATION-CHECKLIST.md\` before configuring any runtime.
6. Run \`pnpm test:verification\` with temporary local test networking available. Do not interpret a local pass as production authorization.

## Product and operating boundaries

- Free is permanent $0 access with no payment card or automatic conversion.
- Eligible new Guided members may receive one 14-day trial; Studio begins as paid service.
- Annual paid billing equals ten monthly payments, providing two months free.
- AI responses are policy-, consent-, entitlement-, budget-, and retrieval-bounded. Deterministic application rules remain authoritative.
- Customer care, marketing, partner, and social-agent flows prepare bounded drafts. Sending, publishing, scraping, payment actions, account changes, database writes, and customer-image access remain review-gated or disabled unless separately approved.
- Retail is discovery-first. External merchants own checkout, payment, fulfillment, returns, and customer support.

## Production state

The code candidate is locally verified but production is not authorized. The receiving team must independently supply and validate provider configuration, recovery evidence, privacy/legal approvals, accessibility evidence, signed billing events, deployment evidence, and named release approval. No document in this packet grants authority to turn on customer traffic, billing, DNS, or customer-data processing.
`;
}

function secretChecklist() {
  return `# Secure secret migration checklist

No secret values are included in this transfer packet. Do not commit secrets, paste them into chat, add them to Drive, or place them in browser/mobile bundles. Transfer each value directly from the owner-controlled secret system to the receiving platform's secret manager, then document only the secret reference and rotation date.

## Required secure references

| Area | Reference names to provision or confirm | Receiving control |
| --- | --- | --- |
| Supabase | \`SUPABASE_URL\`, \`SUPABASE_ANON_KEY\`, \`SUPABASE_SERVICE_ROLE_KEY\`, database connection reference | Server/worker only for privileged values; validate RLS with two isolated accounts. |
| Stripe | \`STRIPE_SECRET_KEY\`, \`STRIPE_SUBSCRIPTION_WEBHOOK_SECRET\`, four approved price IDs | Keep billing disabled until prices, terms, signed event endpoint, customer portal, and rehearsal evidence are approved. |
| OpenAI / hosted AI | \`OPENAI_API_KEY\` | Server-side only; require approved model, retention posture, budget, and fallback policy. |
| Ollama Cloud (optional) | \`OLLAMA_CLOUD_API_KEY\` | Keep disabled unless hosted-processing approval and spend limit are recorded. |
| OpenClaw compatibility mode (optional) | \`OPENCLAW_API_KEY\` | Native Ollama mode uses no key; tool allowlist and independent runtime review are required. |
| Google Cloud / Drive | service-account credential reference, encrypted backup key reference | Use least-privilege identities and private storage; Drive is evidence/archive storage, not a substitute for customer-media controls. |
| Cloudflare | API-token reference, edge-token reference | DNS/TLS/edge changes require separate release authorization. |
| Notifications / support | \`NOTIFICATION_WEBHOOK_TOKEN\` and approved provider references | Verify recipient, signing, rate limits, audit trail, and staffed handoff. |

## Required migration evidence

1. Record secret-manager reference names without values.
2. Rotate values when moving to a new platform, then revoke prior copies only after health and rollback checks pass.
3. Run production preflight against the target environment. Keep it fail-closed for missing, placeholder, or disabled-feature residue.
4. Run staging database/RLS, webhook, backup/restore, accessibility, Android, and incident-response evidence before any production cutover.
5. Bind final approvals and evidence to the exact release candidate SHA.
`;
}

function agentHandoff() {
  return `# AI, agent, and customer-output handoff

## Intended operating model

| Capability | Primary boundary | Required safety condition |
| --- | --- | --- |
| Customer care | Account-aware, policy-bounded guidance | Verified identity, consent where required, no account/payment mutation from generated text. |
| Routine and product explanation | Deterministic product and safety rules plus bounded AI explanation | No diagnosis, cure claim, product ranking override, or unreviewed medical output. |
| Partnership relations | Draft outreach and authorized partner context | Human review before contact; no scraping or external lead write. |
| Marketing | Draft campaigns, content variants, and aggregate reporting | Human approval before sending/publishing; no personal targeting in the Free sponsor path. |
| Retail discovery | External merchant handoff | No Team 47 Studio checkout; customer profile stays out of retailer sharing. |

## Model-routing posture

Local Ollama remains the intended primary runtime. DeepSeek supports complex local reasoning, Qwen supports lower-latency conversational workloads, OpenClaw remains optional and disabled until separately installed and tool-restricted, and hosted OpenAI/Ollama Cloud routes are optional fallbacks that require explicit approval, secret injection, spend limits, and verified provider behavior. A receiving platform must preserve deterministic fallbacks and decline unavailable inference rather than inventing output.

## Transfer acceptance checklist

1. Confirm the receiver can build Node/TypeScript services and the web/mobile applications.
2. Confirm every provider endpoint is private or protected and that no model port is publicly exposed.
3. Run synthetic safety, privacy, schema, latency, cost, outage, and retry evaluations per enabled route.
4. Keep all external actions review-gated until a named owner accepts the controlled workflow.
5. Record model/version/digest, prompt version, retrieval corpus version, evaluation results, and rollback choice with the release evidence.
`;
}

function compress(stage, destination) {
  const result = spawnSync("tar", ["-a", "-c", "-f", destination, "-C", stage, "."], { cwd: root, encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Unable to create transition ZIP: ${result.stderr.trim() || result.stdout.trim()}`);
}

export function createTransitionPacket({ output, verification } = {}) {
  const commit = command("git", ["rev-parse", "HEAD"], "Unable to identify candidate commit");
  const tree = command("git", ["rev-parse", "HEAD^{tree}"], "Unable to identify candidate tree");
  const clean = command("git", ["status", "--porcelain", "--untracked-files=no"], "Unable to inspect tracked worktree state");
  if (clean) throw new Error("Tracked worktree is not clean; commit or revert the candidate before creating a transition packet.");
  const findings = scanGitCommit(root, commit);
  if (findings.length) throw new Error(`Candidate commit has ${findings.length} high-confidence credential finding(s); packet creation refused.`);
  const evidence = path.resolve(verification || "");
  if (!evidence || !fs.statSync(evidence).isFile()) throw new Error("A readable --verification report is required.");
  const destination = path.resolve(output || "");
  if (!destination) throw new Error("An --output directory is required.");
  fs.mkdirSync(destination, { recursive: true });
  const label = `Team47Studio-Transition-Packet-${commit.slice(0, 7)}`;
  const stage = fs.mkdtempSync(path.join(destination, `${label}-staging-`));
  const sourceFile = `${label}-source.zip`;
  const source = path.join(stage, "source", sourceFile);
  fs.mkdirSync(path.dirname(source), { recursive: true });
  command("git", ["archive", "--format=zip", "--output", source, commit], "Unable to create committed-source snapshot");
  const verificationFile = `${safeName(path.basename(evidence, path.extname(evidence)))}.md`;
  fs.mkdirSync(path.join(stage, "reports"), { recursive: true });
  fs.copyFileSync(evidence, path.join(stage, "reports", verificationFile));
  const metadata = {
    schema_version: 1,
    generated_at: isoNow(),
    candidate_commit: commit,
    candidate_tree: tree,
    tracked_source_files: trackedFiles(root).length,
    source_snapshot: `source/${sourceFile}`,
    source_snapshot_sha256: sha256(source),
    verification_report: `reports/${verificationFile}`,
    secrets: "not_exported",
    customer_data: "not_exported",
    production_authorization: "not_granted"
  };
  write(path.join(stage, "metadata.json"), JSON.stringify(metadata, null, 2));
  write(path.join(stage, "handoff", "TRANSITION-HANDOFF.md"), handoff({ commit, tree, sourceFile, verificationFile, trackedCount: metadata.tracked_source_files }));
  write(path.join(stage, "handoff", "SECRET-MIGRATION-CHECKLIST.md"), secretChecklist());
  write(path.join(stage, "handoff", "AI-AGENT-OPERATIONS-HANDOFF.md"), agentHandoff());
  write(path.join(stage, "integrity", "source-snapshot.sha256"), `${metadata.source_snapshot_sha256}  source/${sourceFile}`);
  scanPacket(stage);
  writeManifest(stage);
  const zip = path.join(destination, `${label}.zip`);
  compress(stage, zip);
  const result = { label, packet_directory: stage, packet_zip: zip, packet_zip_sha256: sha256(zip), manifest: path.join(stage, "integrity", "MANIFEST.sha256"), metadata: path.join(stage, "metadata.json") };
  write(path.join(destination, `${label}-receipt.json`), JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = createTransitionPacket({ output: arg("--output"), verification: arg("--verification") });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`Transition packet creation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
