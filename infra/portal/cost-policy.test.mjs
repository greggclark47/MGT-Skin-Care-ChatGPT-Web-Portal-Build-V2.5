import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const terraform = readFileSync(new URL("../gcp/platform/main.tf", import.meta.url), "utf8");
const variables = readFileSync(new URL("../gcp/platform/variables.tf", import.meta.url), "utf8");
const example = readFileSync(new URL("../gcp/platform/terraform.tfvars.example", import.meta.url), "utf8");
const runtimeExample = readFileSync(new URL("./env.example", import.meta.url), "utf8");

test("Cloud Run services default to scale-to-zero", () => {
  assert.match(variables, /variable "web_min_instances"[\s\S]*?default\s*=\s*0/);
  assert.match(variables, /variable "api_min_instances"[\s\S]*?default\s*=\s*0/);
  assert.match(terraform, /min_instance_count = var\.web_min_instances/);
  assert.match(terraform, /min_instance_count = var\.api_min_instances/);
});

test("scheduled worker is a one-shot Cloud Run job", () => {
  assert.match(terraform, /resource "google_cloud_run_v2_job" "worker"/);
  assert.match(terraform, /parallelism = 1/);
  assert.match(terraform, /task_count\s+= 1/);
  assert.match(terraform, /max_retries\s+= 1/);
  assert.match(terraform, /google_cloud_scheduler_job" "worker"/);
});

test("hosted AI, subscriptions, and billing stay disabled in the staging example", () => {
  for (const flag of ["OLLAMA_CLOUD_ENABLED", "HOSTED_OPENAI_ENABLED", "SUBSCRIPTIONS_ENABLED"]) {
    assert.match(example, new RegExp(`${flag}\\s*=\\s*\\"false\\"`));
  }
  for (const flag of ["STRIPE_LIVE_MODE", "STRIPE_USAGE_BILLING_ENABLED", "STRIPE_B2B_INVOICING_ENABLED"]) {
    assert.match(runtimeExample, new RegExp(`${flag}=false`));
  }
  assert.match(example, /billing_account_id\s*=\s*\"\"/);
  assert.match(example, /monthly_budget_usd\s*=\s*0/);
});
