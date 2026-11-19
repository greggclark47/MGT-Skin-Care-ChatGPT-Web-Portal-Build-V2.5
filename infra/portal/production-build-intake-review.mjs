import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { productionBuildIntakeChecksum, validateProductionBuildIntake } from "./production-build-intake.mjs";

const VERSION = "1.0";
const SHA = /^[a-f0-9]{40}$/i;
const CHECKSUM = /^sha256:[a-f0-9]{64}$/i;
const GROUPS = ["non_secret_inputs", "decisions", "secret_references_only", "approvals", "evidence_references"];
function text(value) { return String(value || "").trim(); }
function canonical(document) { const { intake_review_checksum: _ignored, ...unsigned } = document || {}; return JSON.stringify(unsigned, (_key, value) => !value || typeof value !== "object" || Array.isArray(value) ? value : Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]))); }
export function productionBuildIntakeReviewChecksum(document) { return `sha256:${createHash("sha256").update(canonical(document)).digest("hex")}`; }
export function missingProductionBuildIntakeFields(intake) { return GROUPS.flatMap((group) => Object.entries(intake?.[group] || {}).filter(([, value]) => !text(value)).map(([key]) => `${group}.${key}`)); }
function validateFilledIntake(intake, now) { return validateProductionBuildIntake({ ...intake, intake_checksum: productionBuildIntakeChecksum(intake) }, { now }); }
export function buildProductionBuildIntakeReview({ intake, now = new Date().toISOString() } = {}) {
  const validation = validateFilledIntake(intake, Date.parse(now));
  const missing_fields = validation.ok ? missingProductionBuildIntakeFields(intake) : [];
  const document = { version: VERSION, candidate_commit: text(intake?.candidate_commit), intake_checksum: text(productionBuildIntakeChecksum(intake)), generated_at: new Date(now).toISOString(), status: validation.ok ? (missing_fields.length ? "pending_operator_inputs" : "complete_for_external_evidence_review") : "blocked", missing_fields, errors: validation.ok ? [] : validation.errors };
  return { ...document, intake_review_checksum: productionBuildIntakeReviewChecksum(document) };
}
export function validateProductionBuildIntakeReview(document, { now = Date.now() } = {}) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { ok: false, errors: ["intake review must be an object"] };
  if (document.version !== VERSION) errors.push(`intake review version must be ${VERSION}`);
  if (!SHA.test(text(document.candidate_commit))) errors.push("intake review candidate_commit must be a commit SHA");
  if (!CHECKSUM.test(text(document.intake_checksum))) errors.push("intake review intake_checksum must be a sha256 checksum");
  if (!Number.isFinite(Date.parse(text(document.generated_at))) || Date.parse(text(document.generated_at)) > now) errors.push("intake review generated_at must be a past ISO timestamp");
  if (!["blocked", "pending_operator_inputs", "complete_for_external_evidence_review"].includes(document.status)) errors.push("intake review status must be known");
  if (!Array.isArray(document.missing_fields) || document.missing_fields.some((item) => !/^\w+\.\w+$/.test(text(item)))) errors.push("intake review missing_fields must be bounded field paths");
  if (!Array.isArray(document.errors) || document.errors.some((item) => typeof item !== "string")) errors.push("intake review errors must be strings");
  if (document.status === "blocked" && !document.errors.length) errors.push("blocked intake review must contain validation errors");
  if (document.status !== "blocked" && document.errors.length) errors.push("non-blocked intake review cannot contain validation errors");
  if (document.status === "complete_for_external_evidence_review" && document.missing_fields.length) errors.push("complete intake review cannot retain missing fields");
  if (text(document.intake_review_checksum) !== productionBuildIntakeReviewChecksum(document)) errors.push("intake_review_checksum must match the complete canonical review");
  return { ok: errors.length === 0, errors };
}
function argumentValue(args, name) { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const args = process.argv.slice(2); const intakeFile = argumentValue(args, "--intake"); const output = argumentValue(args, "--output"); if (!intakeFile || !output) { console.error("Usage: node infra/portal/production-build-intake-review.mjs --intake work/production/intake.json --output work/production/intake-review.json"); process.exitCode = 1; } else { const document = buildProductionBuildIntakeReview({ intake: JSON.parse(fs.readFileSync(path.resolve(intakeFile), "utf8")) }); const result = validateProductionBuildIntakeReview(document); if (!result.ok) throw new Error(result.errors.join("; ")); const destination = path.resolve(output); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, `${JSON.stringify(document, null, 2)}\n`); console.log(`Production build intake review: ${destination}`); } }
