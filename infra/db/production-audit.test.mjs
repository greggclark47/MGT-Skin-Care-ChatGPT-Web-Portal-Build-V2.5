import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildProductionDatabaseAudit,
  OWNER_READ_TABLES,
  REQUIRED_EXTENSIONS,
  REQUIRED_TRIGGERS,
  SERVICE_ONLY_TABLES
} from "./production-audit.mjs";

const completeSnapshot = () => ({
  serverVersion: 160004,
  readOnly: true,
  extensions: [...REQUIRED_EXTENSIONS],
  tables: [...OWNER_READ_TABLES, ...SERVICE_ONLY_TABLES].map((table) => ({ table, rlsEnabled: true })),
  policies: OWNER_READ_TABLES.map((table) => ({ table, roles: ["authenticated"], command: "SELECT" })),
  triggers: REQUIRED_TRIGGERS.map((trigger) => ({ ...trigger, enabled: true })),
  portalMigrations: ["0001_portal_operations.sql"]
});

test("production database audit passes a complete redacted structural snapshot", () => {
  const report = buildProductionDatabaseAudit(completeSnapshot(), ["0001_portal_operations.sql"]);
  assert.equal(report.status, "pass");
  assert.equal(report.summary.blocked, 0);
  assert.equal(JSON.stringify(report).includes("postgresql://"), false);
  assert.match(report.scope, /does not replace authenticated cross-account isolation/i);
});

test("production database audit fails closed on RLS, policy, extension, trigger, and lineage gaps", () => {
  const snapshot = completeSnapshot();
  snapshot.extensions = ["vector"];
  snapshot.tables = snapshot.tables.filter((row) => row.table !== "orders");
  snapshot.tables.find((row) => row.table === "routines").rlsEnabled = false;
  snapshot.policies = snapshot.policies.filter((row) => row.table !== "carts");
  snapshot.policies.push({ table: "subscription_events", roles: ["authenticated"], command: "SELECT" });
  snapshot.triggers = snapshot.triggers.filter((row) => row.table !== "admin_audit_log");
  snapshot.portalMigrations = ["9999_unknown.sql"];
  const report = buildProductionDatabaseAudit(snapshot, ["0001_portal_operations.sql"]);
  assert.equal(report.status, "blocked");
  assert.ok(report.summary.blocked >= 7);
  assert.deepEqual(report.checks.find((check) => check.id === "customer_tables_present").missing, ["orders"]);
  assert.deepEqual(report.checks.find((check) => check.id === "customer_rls_enabled").missing_or_disabled, ["orders", "routines"]);
  assert.deepEqual(report.checks.find((check) => check.id === "service_only_tables_not_exposed").exposed, ["subscription_events"]);
});

test("production database audit rejects a non-read-only or obsolete server session", () => {
  const snapshot = completeSnapshot();
  snapshot.readOnly = false;
  snapshot.serverVersion = 150012;
  const report = buildProductionDatabaseAudit(snapshot, ["0001_portal_operations.sql"]);
  assert.equal(report.status, "blocked");
  assert.equal(report.checks.find((check) => check.id === "read_only_session").status, "blocked");
  assert.equal(report.checks.find((check) => check.id === "postgres_16_or_newer").status, "blocked");
});

test("checked-in migrations cover every audited RLS table and immutable trigger", () => {
  const migrations = [
    "infra/db/migrations/0001_consolidated_schema.sql",
    "infra/db/migrations/0003_admin_knowledge.sql",
    "infra/db/migrations/0007_compliance_release_controls.sql",
    "infra/db/migrations/0008_customer_data_rls.sql"
  ].map((path) => readFileSync(path, "utf8")).join("\n");
  for (const table of [...OWNER_READ_TABLES, ...SERVICE_ONLY_TABLES]) {
    assert.match(migrations, new RegExp(`(?:alter table\\s+${table}|['\"]${table}['\"])`, "i"), `${table} is absent from the RLS migrations`);
  }
  for (const trigger of REQUIRED_TRIGGERS) {
    if (trigger.table === "admin_audit_log") {
      assert.match(migrations, new RegExp(trigger.name, "i"), `${trigger.name} is absent from the immutable-record migrations`);
    } else {
      assert.match(migrations, new RegExp(`['\"]${trigger.table}['\"]`, "i"), `${trigger.table} is absent from the immutable-record loop`);
      assert.match(migrations, /trigger_name\s*:=\s*'mgt_'/i);
      assert.match(migrations, new RegExp(trigger.function, "i"));
    }
  }
});
