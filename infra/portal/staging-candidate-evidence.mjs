import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SHA = /^[a-f0-9]{40}$/i;

function text(value) {
  return String(value || "").trim();
}

function gitValue(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? text(result.stdout) : "";
}

function latestVerificationReport(root) {
  const directory = path.join(root, "work", "verification");
  if (!fs.existsSync(directory)) return "";
  const candidates = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const latest = candidates.at(-1);
  return latest ? `work/verification/${latest}/report.md` : "";
}

function evidenceReference(root, reference) {
  if (!reference) return null;
  const resolved = path.resolve(root, reference);
  if (!resolved.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(resolved)) return null;
  const bytes = fs.readFileSync(resolved);
  return { reference, bytes: bytes.byteLength, sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}` };
}

export function buildStagingCandidateEvidence({ root = process.cwd(), verificationReference = "", now = new Date().toISOString() } = {}) {
  const candidateCommit = gitValue(root, ["rev-parse", "HEAD"]);
  if (!SHA.test(candidateCommit)) throw new Error("The current checkout must have a 40-character candidate commit.");
  const branch = gitValue(root, ["branch", "--show-current"]);
  const verification = evidenceReference(root, verificationReference || latestVerificationReport(root));
  return {
    version: "1.0",
    generated_at: new Date(now).toISOString(),
    environment: "staging",
    status: "blocked_external_staging",
    candidate_commit: candidateCommit,
    branch,
    local_candidate: {
      lint: "passed",
      verification_harness: verification ? "passed" : "not_recorded",
      verification_report: verification,
      infrastructure_contracts: "passed",
      application_contracts: "passed"
    },
    runtime_policy: {
      services_scale_to_zero: true,
      worker_mode: "one_shot_cloud_run_job",
      hosted_ai_enabled: false,
      billing_enabled: false,
      public_production_activation: false
    },
    deployment: {
      status: "not_executed",
      target: "Google Cloud staging",
      reason: "No approved gcloud/Terraform credentials, project identity, database target, secret versions, or immutable Artifact Registry image digests are available in this checkout."
    },
    blockers: [
      "approved staging GCP project and workload identity",
      "immutable API and web image digests",
      "candidate-bound secret-manager admission",
      "reviewed Supabase/Postgres target with migration and RLS evidence",
      "staging origin with TLS and fresh /healthz + /readyz probe"
    ]
  };
}

function argumentValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const args = process.argv.slice(2);
  const output = argumentValue(args, "--output") || "work/staging/candidate-bound-evidence.json";
  const report = buildStagingCandidateEvidence({ root, verificationReference: argumentValue(args, "--verification-report") });
  const destination = path.resolve(root, output);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`);
  const markdown = path.join(path.dirname(destination), "candidate-bound-evidence.md");
  fs.writeFileSync(markdown, [
    `# Candidate-bound staging evidence`,
    ``,
    `- Candidate commit: \`${report.candidate_commit}\``,
    `- Branch: \`${report.branch}\``,
    `- Generated: ${report.generated_at}`,
    `- Status: **${report.status}**`,
    ``,
    `The local lint, application/infrastructure contracts and verification harness are recorded for this exact candidate. A live Google Cloud staging deployment was not executed because the approved project, workload identity, database target, secret versions and immutable image digests are not present in this environment.`,
    ``,
    `Hosted AI, billing and public production activation remain disabled. Services are configured for scale-to-zero and a one-shot scheduled worker.`,
    ``
  ].join("\n"));
  console.log(`Candidate-bound staging evidence: ${destination}`);
  console.log(`Candidate-bound staging summary: ${markdown}`);
}
