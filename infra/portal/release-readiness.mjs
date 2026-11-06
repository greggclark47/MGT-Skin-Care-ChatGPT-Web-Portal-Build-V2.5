import { pathToFileURL } from "node:url";
import { validateEnvironment } from "./preflight.mjs";

export const RELEASE_STATUSES = Object.freeze(["pass", "pending", "blocked", "not_applicable"]);

export const RELEASE_PHASES = Object.freeze([
  {
    id: "F71",
    name: "Deployment readiness packet",
    owner: "release",
    evidence: "All required phase checks have a current status and accountable owner."
  },
  {
    id: "F72",
    name: "Production configuration evidence",
    owner: "release",
    evidence: "Production preflight passes against the supplied environment file without exposing secrets."
  },
  {
    id: "F73",
    name: "Support ownership and helpdesk readiness",
    owner: "support",
    evidence: "A named support owner, monitored mailbox or helpdesk route, and response workflow are confirmed."
  },
  {
    id: "F74",
    name: "Deployed accessibility evidence",
    owner: "accessibility",
    evidence: "The deployed origin has keyboard, screen-reader, mobile/browser, contrast, and WCAG evidence."
  },
  {
    id: "F75",
    name: "Supabase/Postgres and RLS validation",
    owner: "data",
    evidence: "The target database, migrations, RLS isolation, and account lifecycle behavior pass live validation."
  },
  {
    id: "F76",
    name: "Backup, restore, and readiness evidence",
    owner: "operations",
    evidence: "An encrypted off-host backup restore drill and healthy worker/readiness result are recorded."
  },
  {
    id: "F77",
    name: "Commercial offer and sponsored-content evidence",
    owner: "commercial-operations",
    evidence: "Enabled Premium offers have signed sandbox and entitlement evidence; enabled sponsored content has current merchant authorization and disclosure evidence."
  },
  {
    id: "F78",
    name: "Container digest and startup validation",
    owner: "platform",
    evidence: "Approved immutable image digests start successfully and health/readiness routing is verified."
  },
  {
    id: "F79",
    name: "AI and runtime provider qualification",
    owner: "ai-operations",
    evidence: "Enabled local or hosted providers, model availability, fallback behavior, spend controls, and billing evidence are verified."
  },
  {
    id: "F80",
    name: "Staging release packet",
    owner: "release",
    evidence: "All required predecessor phases pass, open blockers are resolved, and the staging decision is recorded."
  }
]);

const ERROR_PREFIXES = Object.freeze({
  support: ["SUPPORT_OWNER_NAME", "SUPPORT_OWNER_EMAIL"],
  accessibility: ["ACCESSIBILITY_VALIDATION_REPORT_URL", "ACCESSIBILITY_VALIDATED_AT"],
  database: ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
  backup: ["BACKUP_MAX_AGE_HOURS", "BACKUP_RESTORE_MAX_AGE_DAYS", "WORKER_INTERVAL_SECONDS", "WORKER_READINESS_MAX_AGE_SECONDS"],
  commercial: ["SUBSCRIPTIONS_ENABLED", "SUBSCRIPTION_TERMS_APPROVED", "STRIPE_", "MGT_SPONSORED_CONTENT", "Sponsored content", "Disabled sponsored content"],
  runtime: ["OLLAMA_ENABLED", "OLLAMA_BASE_URL", "OPENCLAW_ENABLED", "OPENCLAW_BASE_URL", "OPENCLAW_API_MODE", "OPENCLAW_API_KEY", "HOSTED_OPENAI_ENABLED", "OPENAI_API_KEY", "Disabled hosted OpenAI", "Native Ollama-mode OpenClaw"]
});

function hasError(errors, prefixes) {
  return errors.some((error) => prefixes.some((prefix) => error.startsWith(prefix)));
}

function liveEvidence(evidence, key) {
  return evidence?.[key] === true;
}

export function liveEvidenceFromEnvironment(env = {}) {
  return {
    support_workflow: String(env.RELEASE_EVIDENCE_SUPPORT_WORKFLOW).toLowerCase() === "true",
    accessibility_deployed: String(env.RELEASE_EVIDENCE_ACCESSIBILITY_DEPLOYED).toLowerCase() === "true",
    database_rls: String(env.RELEASE_EVIDENCE_DATABASE_RLS).toLowerCase() === "true",
    backup_restore: String(env.RELEASE_EVIDENCE_BACKUP_RESTORE).toLowerCase() === "true",
    stripe_sandbox: String(env.RELEASE_EVIDENCE_STRIPE_SANDBOX).toLowerCase() === "true",
    sponsored_content_authorization: String(env.RELEASE_EVIDENCE_SPONSORED_CONTENT_AUTHORIZATION).toLowerCase() === "true",
    container_startup: String(env.RELEASE_EVIDENCE_CONTAINER_STARTUP).toLowerCase() === "true",
    ai_provider: String(env.RELEASE_EVIDENCE_AI_PROVIDER).toLowerCase() === "true"
  };
}

function phase(id, status, reason) {
  if (!RELEASE_STATUSES.includes(status)) throw new Error(`Unknown release status: ${status}`);
  return { id, status, reason };
}

export function buildReleaseReadiness({ env = {}, localGates = false, liveEvidence: evidence = {} } = {}) {
  const preflight = validateEnvironment(env);
  const phases = [];

  // Any failed preflight check blocks readiness, including owner/alert settings
  // that are not represented by a phase-specific error-prefix list.
  const configurationBlocked = !preflight.ok;
  const supportBlocked = hasError(preflight.errors, ERROR_PREFIXES.support);
  const accessibilityBlocked = hasError(preflight.errors, ERROR_PREFIXES.accessibility);
  const databaseBlocked = hasError(preflight.errors, ERROR_PREFIXES.database);
  const backupBlocked = hasError(preflight.errors, ERROR_PREFIXES.backup);
  const subscriptionsEnabled = String(env.SUBSCRIPTIONS_ENABLED).toLowerCase() === "true";
  const sponsoredContentEnabled = String(env.MGT_SPONSORED_CONTENT_ENABLED).toLowerCase() === "true";
  const commercialEnabled = subscriptionsEnabled || sponsoredContentEnabled;
  const commercialBlocked = hasError(preflight.errors, ERROR_PREFIXES.commercial);
  const runtimeBlocked = hasError(preflight.errors, ERROR_PREFIXES.runtime);

  phases.push(phase("F72", configurationBlocked ? "blocked" : localGates ? "pass" : "pending", configurationBlocked ? "Production configuration preflight has blocking errors." : localGates ? "Production configuration and local gates are recorded." : "Run the local release gates before treating configuration as release evidence."));
  phases.push(phase("F73", supportBlocked ? "blocked" : liveEvidence(evidence, "support_workflow") ? "pass" : "pending", supportBlocked ? "Named support ownership is missing or invalid." : liveEvidence(evidence, "support_workflow") ? "Named ownership and support workflow evidence are recorded." : "Confirm a monitored support route and response workflow."));
  phases.push(phase("F74", accessibilityBlocked ? "blocked" : liveEvidence(evidence, "accessibility_deployed") ? "pass" : "pending", accessibilityBlocked ? "Deployed accessibility evidence is missing or invalid." : liveEvidence(evidence, "accessibility_deployed") ? "Deployed accessibility evidence is recorded." : "Run and link the deployed accessibility validation set."));
  phases.push(phase("F75", databaseBlocked ? "blocked" : liveEvidence(evidence, "database_rls") ? "pass" : "pending", databaseBlocked ? "Database or Supabase configuration is incomplete." : liveEvidence(evidence, "database_rls") ? "Live database, migration, and RLS evidence is recorded." : "Validate the target database, migrations, RLS, and account lifecycle against the deployed project."));
  phases.push(phase("F76", backupBlocked ? "blocked" : liveEvidence(evidence, "backup_restore") ? "pass" : "pending", backupBlocked ? "Worker or backup readiness configuration is invalid." : liveEvidence(evidence, "backup_restore") ? "Restore drill and readiness evidence are recorded." : "Complete an encrypted off-host restore drill and verify /readyz."));
  const commercialEvidenceComplete = (!subscriptionsEnabled || liveEvidence(evidence, "stripe_sandbox"))
    && (!sponsoredContentEnabled || liveEvidence(evidence, "sponsored_content_authorization"));
  phases.push(phase("F77", !commercialEnabled ? "not_applicable" : commercialBlocked ? "blocked" : commercialEvidenceComplete ? "pass" : "pending", !commercialEnabled ? "Subscriptions and sponsored content are disabled for this release." : commercialBlocked ? "Enabled Premium or sponsored-content configuration is incomplete." : commercialEvidenceComplete ? "Required Premium and sponsored-content authorization evidence is recorded." : "Keep paid enrollment and sponsored placement closed until their required evidence is complete."));
  phases.push(phase("F78", configurationBlocked ? "blocked" : liveEvidence(evidence, "container_startup") ? "pass" : "pending", configurationBlocked ? "Immutable image or production configuration checks are incomplete." : liveEvidence(evidence, "container_startup") ? "Immutable images and startup probes are verified." : "Start the approved images and verify health, readiness, and edge routing."));
  const runtimeConfigured = !runtimeBlocked && (String(env.OLLAMA_ENABLED).toLowerCase() === "true" || String(env.HOSTED_OPENAI_ENABLED).toLowerCase() === "true");
  phases.push(phase("F79", runtimeBlocked || !runtimeConfigured ? "blocked" : liveEvidence(evidence, "ai_provider") ? "pass" : "pending", runtimeBlocked || !runtimeConfigured ? "No complete enabled AI runtime configuration is available." : liveEvidence(evidence, "ai_provider") ? "Provider, model, fallback, and spend evidence are recorded." : "Verify enabled models/providers, fallback behavior, spend controls, and hosted billing reconciliation."));

  const predecessorReady = phases.every((item) => item.status === "pass" || item.status === "not_applicable");
  phases.unshift(phase("F71", predecessorReady && localGates ? "pass" : "blocked", predecessorReady && localGates ? "The readiness packet has complete predecessor status coverage." : "Resolve predecessor statuses and record local gate evidence."));
  phases.push(phase("F80", predecessorReady && localGates ? "pass" : "blocked", predecessorReady && localGates ? "The staging release packet is ready for a recorded decision." : "Staging remains blocked until every required predecessor phase passes."));

  return {
    version: "1.0",
    release_ready: phases.every((item) => item.status === "pass" || item.status === "not_applicable"),
    local_gates: localGates,
    preflight: { ok: preflight.ok, errors: preflight.errors, warnings: preflight.warnings },
    phases
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const packet = buildReleaseReadiness({ env: process.env, localGates: process.env.RELEASE_LOCAL_GATES === "true", liveEvidence: liveEvidenceFromEnvironment(process.env) });
  console.log(JSON.stringify({ ...packet, generated_at: new Date().toISOString() }, null, 2));
  if (process.argv.includes("--require-ready") && !packet.release_ready) process.exitCode = 2;
}
