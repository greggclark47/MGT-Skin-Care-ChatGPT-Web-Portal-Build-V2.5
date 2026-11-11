import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const platform=read('../gcp/platform/main.tf');
const operations=read('../gcp/platform/operations.tf');
const backend=read('../gcp/platform/backend.tf');
const bootstrap=read('../gcp/bootstrap/main.tf');
const variables=read('../gcp/platform/variables.tf');
const cloudflare=read('../cloudflare/main.tf');
const cloudflareVariables=read('../cloudflare/variables.tf');
const webConfig=read('../../apps/web/next.config.js');
const localAi=read('../../scripts/Test-Team47LocalAI.ps1');
const gcpWorkflow=read('../../.github/workflows/gcp-release-images.yml');

test('Google Cloud services are private behind the global load balancer',()=>{
 assert.equal((platform.match(/INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER/g)||[]).length,2);
 assert.equal((platform.match(/default_uri_disabled\s*=\s*true/g)||[]).length,2);
 assert.match(platform,/google_compute_region_network_endpoint_group/);
 assert.match(platform,/google_compute_global_forwarding_rule/);
 assert.match(platform,/google_compute_managed_ssl_certificate/);
 assert.match(platform,/min_tls_version\s*=\s*"TLS_1_2"/);
});

test('Terraform state is isolated in a protected lock-capable GCS backend',()=>{
 assert.match(backend,/backend\s+"gcs"\s*\{\s*\}/);
 assert.match(bootstrap,/google_storage_bucket"\s+"terraform_state/);
 assert.match(bootstrap,/public_access_prevention\s*=\s*"enforced"/);
 assert.match(bootstrap,/uniform_bucket_level_access\s*=\s*true/);
 assert.match(bootstrap,/versioning[\s\S]*enabled\s*=\s*true/);
 assert.match(bootstrap,/prevent_destroy\s*=\s*true/);
 assert.match(bootstrap,/roles\/storage\.objectAdmin/);
 assert.doesNotMatch(backend+bootstrap,/credentials\s*=/i);
});

test('storage and secret resources fail closed by default',()=>{
 assert.equal((platform.match(/public_access_prevention\s*=\s*"enforced"/g)||[]).length,2);
 assert.equal((platform.match(/uniform_bucket_level_access\s*=\s*true/g)||[]).length,2);
 assert.match(platform,/retention_policy/);
 assert.match(platform,/google_secret_manager_secret/);
 assert.doesNotMatch(platform,/google_secret_manager_secret_version/);
 assert.doesNotMatch(platform,/secret_data\s*=/);
 assert.doesNotMatch(platform,/version\s*=\s*"latest"/);
 assert.equal((platform.match(/version\s*=\s*env\.value\.version/g)||[]).length,2);
 assert.match(variables,/explicit positive numeric versions/);
 assert.match(variables,/deploy_application[\s\S]*default\s*=\s*false/);
});

test('Supabase and Stripe secret mounts are feature-gated before Cloud Run deployment',()=>{
 assert.match(platform,/terraform_data" "runtime_secret_contract"/);
 assert.match(platform,/SUPABASE_ANON_KEY/);
 assert.match(platform,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(platform,/STRIPE_SECRET_KEY/);
 assert.match(platform,/STRIPE_SUBSCRIPTION_WEBHOOK_SECRET/);
 assert.match(platform,/Do not mount Stripe secrets while every Stripe feature is disabled/);
 assert.match(variables,/variable "stripe_api_secret_environment"/);
 assert.match(variables,/\["STRIPE_SECRET_KEY", "STRIPE_SUBSCRIPTION_WEBHOOK_SECRET"\]/);
 assert.match(platform,/runtime\[each\.value\.secret_id\]/);
 assert.doesNotMatch(platform,/runtime\[each\.value\]\.id/);
});

test('scheduled operations run one bounded sweep',()=>{
 assert.match(platform,/google_cloud_run_v2_job/);
 assert.match(platform,/WORKER_RUN_ONCE\s*=\s*"true"/);
 assert.match(platform,/google_cloud_scheduler_job/);
 assert.match(platform,/task_count\s*=\s*1/);
 assert.match(platform,/parallelism\s*=\s*1/);
});

test('edge protection and path routing are explicit',()=>{
 assert.match(platform,/google_compute_security_policy/);
 assert.match(platform,/evaluatePreconfiguredWaf\('sqli-v33-stable'\)/);
 assert.match(platform,/evaluatePreconfiguredWaf\('xss-v33-stable'\)/);
 assert.match(platform,/action\s*=\s*"throttle"/);
 assert.match(platform,/exceed_action\s*=\s*"deny\(429\)"/);
 assert.match(platform,/enforce_on_key\s*=\s*"XFF_IP"/);
 assert.match(platform,/"\/api\/\*", "\/healthz", "\/readyz", "\/webhooks\/\*"/);
 assert.match(platform,/host_redirect\s*=\s*var\.domain/);
});

test('monitoring and budget controls remain explicit and fail closed',()=>{
 assert.match(operations,/google_monitoring_uptime_check_config/);
 assert.match(operations,/path\s*=\s*"\/readyz"/);
 assert.match(operations,/validate_ssl\s*=\s*true/);
 assert.match(operations,/google_monitoring_alert_policy/);
 assert.match(operations,/google_billing_budget/);
 assert.match(operations,/threshold_percent\s*=\s*0\.8/);
 assert.match(variables,/monitoring_enabled[\s\S]*default\s*=\s*false/);
 assert.match(variables,/monthly_budget_usd[\s\S]*default\s*=\s*0/);
 assert.doesNotMatch(operations,/password|auth_token|service_key/i);
});

test('Cloudflare rollout starts DNS-only and enables DNSSEC without storing a token',()=>{
 assert.equal((cloudflare.match(/cloudflare_dns_record/g)||[]).length,2);
 assert.match(cloudflare,/cloudflare_zone_dnssec/);
 assert.match(cloudflareVariables,/proxy_enabled[\s\S]*default\s*=\s*false/);
 assert.doesNotMatch(cloudflare+cloudflareVariables,/api_token\s*=/i);
});

test('web security headers survive removal of the local Caddy edge',()=>{
 for(const header of ['Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Content-Security-Policy','Permissions-Policy','Cross-Origin-Opener-Policy'])assert.match(webConfig,new RegExp(header));
 assert.match(webConfig,/poweredByHeader:false/);
});

test('local AI qualification is loopback-only',()=>{
 assert.match(localAi,/127\.0\.0\.1:11434/);
 assert.match(localAi,/Test-LoopbackAddress/);
 assert.doesNotMatch(localAi,/OLLAMA_HOST\s*=\s*['"]?0\.0\.0\.0/i);
 assert.match(localAi,/synthetic infrastructure health check with no customer data/);
});

test('Google release publication uses keyless identity and immutable action pins',()=>{
 assert.match(gcpWorkflow,/workload_identity_provider/);
 assert.match(gcpWorkflow,/token_format: access_token/);
 assert.doesNotMatch(gcpWorkflow,/service_account_key|credentials_json/);
 assert.match(gcpWorkflow,/docker\.pkg\.dev/);
 assert.match(gcpWorkflow,/subject-digest/);
 const uses=[...gcpWorkflow.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)].map(match=>match[1]);
 assert.ok(uses.length>=8);
 assert.ok(uses.every(value=>/@[a-f0-9]{40}$/.test(value)),uses.join('\n'));
});
