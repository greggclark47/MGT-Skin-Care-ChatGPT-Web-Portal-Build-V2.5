import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const OWNER_READ_TABLES = Object.freeze([
  "ai_budgets",
  "cart_items",
  "carts",
  "consents",
  "entitlements",
  "orders",
  "product_feedback",
  "recommendations",
  "replenishment_predictions",
  "routine_adherence",
  "routine_feedback",
  "routine_steps",
  "routines",
  "skin_match_answers",
  "skin_match_sessions",
  "skin_profile_versions",
  "skin_profiles",
  "subscriptions"
]);

export const SERVICE_ONLY_TABLES = Object.freeze([
  "llm_routing_log",
  "stripe_customers",
  "subscription_events"
]);

export const REQUIRED_EXTENSIONS = Object.freeze(["pg_cron", "vector"]);

export const REQUIRED_TRIGGERS = Object.freeze([
  { table: "admin_audit_log", name: "admin_audit_no_update", function: "admin_audit_immutable" },
  { table: "skin_match_answers", name: "mgt_skin_match_answers_append_only", function: "prevent_mutation" },
  { table: "subscription_events", name: "mgt_subscription_events_append_only", function: "prevent_mutation" }
]);

const sorted = (values) => [...values].sort((a, b) => a.localeCompare(b));
const pass = (condition) => condition ? "pass" : "blocked";

function migrationNames(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
}

export function buildProductionDatabaseAudit(snapshot, expectedPortalMigrations = []) {
  const allRlsTables = [...OWNER_READ_TABLES, ...SERVICE_ONLY_TABLES];
  const tables = new Map((snapshot.tables || []).map((row) => [String(row.table), row]));
  const policies = snapshot.policies || [];
  const triggers = snapshot.triggers || [];
  const extensions = new Set((snapshot.extensions || []).map(String));
  const appliedMigrations = new Set((snapshot.portalMigrations || []).map(String));

  const missingTables = sorted(allRlsTables.filter((table) => !tables.has(table)));
  const rlsDisabled = sorted(allRlsTables.filter((table) => tables.has(table) && !tables.get(table).rlsEnabled));
  const missingOwnerPolicies = sorted(OWNER_READ_TABLES.filter((table) => !policies.some((policy) =>
    policy.table === table &&
    Array.isArray(policy.roles) &&
    policy.roles.includes("authenticated") &&
    ["SELECT", "ALL"].includes(String(policy.command).toUpperCase())
  )));
  const exposedServiceTables = sorted(SERVICE_ONLY_TABLES.filter((table) => policies.some((policy) =>
    policy.table === table && Array.isArray(policy.roles) && policy.roles.includes("authenticated")
  )));
  const missingExtensions = sorted(REQUIRED_EXTENSIONS.filter((extension) => !extensions.has(extension)));
  const missingTriggers = REQUIRED_TRIGGERS.filter((required) => !triggers.some((trigger) =>
    trigger.table === required.table &&
    trigger.name === required.name &&
    trigger.function === required.function &&
    trigger.enabled !== false
  )).map((trigger) => `${trigger.table}.${trigger.name}`);
  const missingPortalMigrations = expectedPortalMigrations.filter((name) => !appliedMigrations.has(name));
  const unexpectedPortalMigrations = sorted([...appliedMigrations].filter((name) => !expectedPortalMigrations.includes(name)));
  const serverVersion = Number(snapshot.serverVersion || 0);

  const checks = [
    { id: "read_only_session", status: pass(snapshot.readOnly === true), expected: true, observed: snapshot.readOnly === true },
    { id: "postgres_16_or_newer", status: pass(serverVersion >= 160000), expected_minimum: 160000, observed: serverVersion || null },
    { id: "required_extensions", status: pass(missingExtensions.length === 0), missing: missingExtensions },
    { id: "customer_tables_present", status: pass(missingTables.length === 0), missing: missingTables },
    { id: "customer_rls_enabled", status: pass(rlsDisabled.length === 0), missing_or_disabled: [...missingTables, ...rlsDisabled] },
    { id: "authenticated_owner_read_policies", status: pass(missingOwnerPolicies.length === 0), missing: missingOwnerPolicies },
    { id: "service_only_tables_not_exposed", status: pass(exposedServiceTables.length === 0), exposed: exposedServiceTables },
    { id: "append_only_triggers", status: pass(missingTriggers.length === 0), missing: missingTriggers },
    { id: "portal_migration_lineage", status: pass(missingPortalMigrations.length === 0 && unexpectedPortalMigrations.length === 0), missing: missingPortalMigrations, unexpected: unexpectedPortalMigrations }
  ];
  const blocked = checks.filter((check) => check.status !== "pass");

  return {
    schema: "mgt.production-database-audit.v1",
    generated_at: new Date().toISOString(),
    status: blocked.length ? "blocked" : "pass",
    scope: "Read-only structural audit. It does not replace authenticated cross-account isolation, identity lifecycle, concurrency, retention, backup/restore, or destructive-operation tests.",
    summary: { checks: checks.length, passed: checks.length - blocked.length, blocked: blocked.length },
    checks
  };
}

async function captureSnapshot(databaseUrl) {
  const requireFromApi = createRequire(join(root, "apps/api/package.json"));
  const { Pool } = requireFromApi("pg");
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 10000,
    statement_timeout: 10000,
    application_name: "mgt-production-database-audit"
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '10s'");
    const tableNames = [...OWNER_READ_TABLES, ...SERVICE_ONLY_TABLES];
    const [settings, extensionRows, tableRows, policyRows, triggerRows, portalLedger] = await Promise.all([
      client.query("select current_setting('server_version_num')::int as server_version, current_setting('transaction_read_only') = 'on' as read_only"),
      client.query("select extname from pg_extension where extname = any($1::text[]) order by extname", [REQUIRED_EXTENSIONS]),
      client.query("select c.relname as table_name, c.relrowsecurity as rls_enabled from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p') and c.relname = any($1::text[]) order by c.relname", [tableNames]),
      client.query("select tablename as table_name, policyname, roles, cmd from pg_policies where schemaname = 'public' and tablename = any($1::text[]) order by tablename, policyname", [tableNames]),
      client.query("select c.relname as table_name, t.tgname as trigger_name, p.proname as function_name, t.tgenabled <> 'D' as enabled from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace join pg_proc p on p.oid = t.tgfoid where not t.tgisinternal and n.nspname = 'public' order by c.relname, t.tgname"),
      client.query("select to_regclass('public.portal_schema_migrations') is not null as present")
    ]);
    let portalMigrations = [];
    if (portalLedger.rows[0]?.present) {
      const rows = await client.query("select id from portal_schema_migrations order by id");
      portalMigrations = rows.rows.map((row) => String(row.id));
    }
    await client.query("COMMIT");
    return {
      serverVersion: settings.rows[0]?.server_version,
      readOnly: settings.rows[0]?.read_only === true,
      extensions: extensionRows.rows.map((row) => String(row.extname)),
      tables: tableRows.rows.map((row) => ({ table: String(row.table_name), rlsEnabled: row.rls_enabled === true })),
      policies: policyRows.rows.map((row) => ({ table: String(row.table_name), name: String(row.policyname), roles: row.roles || [], command: String(row.cmd) })),
      triggers: triggerRows.rows.map((row) => ({ table: String(row.table_name), name: String(row.trigger_name), function: String(row.function_name), enabled: row.enabled === true })),
      portalMigrations
    };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function writeReport(report, outputPath) {
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) {
    const absolute = resolve(outputPath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, serialized, { encoding: "utf8", flag: "wx" });
    console.log(`Database audit: ${absolute}`);
  } else {
    process.stdout.write(serialized);
  }
}

async function cli() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output");
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
  if (outputIndex >= 0 && !outputPath) {
    console.error("--output requires a new report path.");
    process.exitCode = 2;
    return;
  }
  if (outputPath && existsSync(resolve(outputPath))) {
    console.error("The requested audit report already exists; choose a new path so evidence is not overwritten.");
    process.exitCode = 2;
    return;
  }
  const expectedPortalMigrations = migrationNames(join(root, "infra/portal/migrations"));
  if (!process.env.DATABASE_URL) {
    const report = {
      schema: "mgt.production-database-audit.v1",
      generated_at: new Date().toISOString(),
      status: "blocked",
      scope: "No connection was attempted.",
      summary: { checks: 1, passed: 0, blocked: 1 },
      checks: [{ id: "database_connection", status: "blocked", reason: "DATABASE_URL is not configured." }]
    };
    writeReport(report, outputPath);
    process.exitCode = 2;
    return;
  }
  let report;
  let connectionFailed = false;
  try {
    const snapshot = await captureSnapshot(process.env.DATABASE_URL);
    report = buildProductionDatabaseAudit(snapshot, expectedPortalMigrations);
  } catch {
    connectionFailed = true;
    report = {
      schema: "mgt.production-database-audit.v1",
      generated_at: new Date().toISOString(),
      status: "blocked",
      scope: "Connection or metadata query failed; error details are intentionally omitted to avoid leaking target identifiers.",
      summary: { checks: 1, passed: 0, blocked: 1 },
      checks: [{ id: "database_connection", status: "blocked", reason: "Unable to complete the read-only structural audit." }]
    };
  }
  writeReport(report, outputPath);
  process.exitCode = report.status === "pass" ? 0 : connectionFailed ? 2 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void cli();

