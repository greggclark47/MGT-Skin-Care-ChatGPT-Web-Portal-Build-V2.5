import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createStagingEvidenceTemplate } from "./staging-evidence.mjs";

const PACKET_VERSION = "1.2";
const DAY = 24 * 60 * 60 * 1000;
const OWNER_ROLES = ["release", "support", "data", "platform", "accessibility"];

function text(value) {
  return String(value || "").trim();
}

function gitValue(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true });
  return result.status === 0 ? text(result.stdout) : "";
}

function latestReport(root, folder) {
  const directory = path.join(root, "work", folder);
  if (!fs.existsSync(directory)) return "";
  const candidates = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const latest = candidates.at(-1);
  return latest ? `work/${folder}/${latest}/report.md` : "";
}

function digestOrPlaceholder(value, image) {
  return /^[a-z0-9./_-]+@sha256:[a-f0-9]{64}$/.test(text(value)) ? text(value) : `${image}@sha256:REPLACE_WITH_64_HEX_DIGEST`;
}

function evidenceTemplate(id, phase) {
  return {
    id,
    phase,
    status: "pending",
    reference: `work/evidence/REPLACE_WITH_${id.toUpperCase()}_REPORT.md`,
    reviewed_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP",
    reviewer: "REPLACE_WITH_REVIEWER"
  };
}

export function buildDraftShipPacket({ root = process.cwd(), env = {}, now = new Date().toISOString(), branch, commit, checkpointReport, verificationReport } = {}) {
  const generatedAt = new Date(now);
  const expiresAt = new Date(generatedAt.getTime() + 7 * DAY).toISOString();
  const resolvedBranch = branch || gitValue(root, ["branch", "--show-current"]);
  const resolvedCommit = commit || gitValue(root, ["rev-parse", "HEAD"]);
  const evidence = [
    evidenceTemplate("support_workflow", "F73"),
    evidenceTemplate("accessibility_deployed", "F74"),
    evidenceTemplate("database_rls", "F75"),
    evidenceTemplate("backup_restore", "F76"),
    evidenceTemplate("container_startup", "F78")
  ];
  if (String(env.SUBSCRIPTIONS_ENABLED).toLowerCase() === "true") evidence.push(evidenceTemplate("stripe_sandbox", "F77"));
  if (String(env.OLLAMA_ENABLED).toLowerCase() === "true" || text(env.OPENAI_API_KEY)) evidence.push(evidenceTemplate("ai_provider", "F79"));
  const candidate = {
    commit: resolvedCommit || "REPLACE_WITH_40_CHARACTER_COMMIT_SHA",
    branch: resolvedBranch || "REPLACE_WITH_RELEASE_BRANCH",
    checkpoint_report: checkpointReport || latestReport(root, "checkpoints") || "work/checkpoints/REPLACE_WITH_TIMESTAMP/report.md",
    verification_report: verificationReport || latestReport(root, "verification") || "work/verification/REPLACE_WITH_TIMESTAMP/report.md",
    hosted_ci_url: "https://github.com/REPLACE_WITH_OWNER/REPLACE_WITH_REPOSITORY/actions/runs/REPLACE_WITH_RUN"
  };
  const images = {
    node: digestOrPlaceholder(env.NODE_IMAGE, "node"),
    ollama: digestOrPlaceholder(env.OLLAMA_IMAGE, "ollama/ollama"),
    caddy: digestOrPlaceholder(env.CADDY_IMAGE, "caddy")
  };

  return {
    version: PACKET_VERSION,
    generated_at: generatedAt.toISOString(),
    expires_at: expiresAt,
    candidate,
    owners: Object.fromEntries(OWNER_ROLES.map((role) => [role, `REPLACE_WITH_${role.toUpperCase()}_OWNER`])),
    approvals: OWNER_ROLES.map((role) => ({ role, decision: "pending", approver: `REPLACE_WITH_${role.toUpperCase()}_APPROVER`, reviewed_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP", reference: `work/approvals/${role}.md` })),
    images,
    staging_evidence: createStagingEvidenceTemplate({ candidateCommit: candidate.commit, images }),
    evidence,
    rollback: { previous_release: "REPLACE_WITH_LAST_APPROVED_RELEASE", reference: "work/rollback/REPLACE_WITH_TIMESTAMP/report.md", verified_at: "REPLACE_WITH_PAST_ISO_TIMESTAMP" },
    monitoring: { owner: "REPLACE_WITH_LAUNCH_MONITOR", incident_channel: "REPLACE_WITH_INCIDENT_CHANNEL", launch_window_start: "REPLACE_WITH_FUTURE_ISO_TIMESTAMP", checks: ["15m", "1h", "24h", "7d"] }
  };
}

function outputPath(args) {
  const index = args.indexOf("--output");
  return index >= 0 ? args[index + 1] : path.join("work", "ship-packets", "draft.json");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const destination = path.resolve(root, outputPath(process.argv.slice(2)));
  const packet = buildDraftShipPacket({ root, env: process.env });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, `${JSON.stringify(packet, null, 2)}\n`);
  console.log(`Draft ship packet: ${destination}`);
  console.log("This draft contains no secrets and is not publication approval.");
}
