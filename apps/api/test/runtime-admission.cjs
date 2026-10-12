const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { validateRuntimeOwnership, validateProductionPortalBoundary, validateProductionDatabaseAdmission, validateProductionOperationsAdmission, validateProductionNotificationAdmission, validateProductionIdentityAdmission, validateProductionBackupAdmission, validateProductionAccessibilityAdmission, validateProductionSubscriptionAdmission, validateProductionAiAdmission, validateProductionProcessSurfaceAdmission, validateProductionImageAdmission, validateProductionSecretIsolation, validateProductionEndpointIsolation, validateProductionDisabledFeatureResidue, workerIntervalMs, workerReadinessMaxAgeMs } = require('../dist/portal/runtime-admission');
const { createPortal } = require('../dist/portal/server');
const owner = 'Gregg Clark of MGT';
const valid = { NODE_ENV:'production', DEMO_MODE:'false', PUBLIC_ORIGIN:'https://portal.example', PORTAL_DOMAIN:'portal.example', RELEASE_OWNER_NAME:owner, SUPPORT_OWNER_NAME:owner, WORKER_INTERVAL_SECONDS:'60', WORKER_READINESS_MAX_AGE_SECONDS:'300' };

test('preflight and runtime accept the same owner declarations and 25 timing boundary cases', async () => {
  const { validateEnvironment } = await import('../../../infra/portal/preflight.mjs');
  const { validateOwnershipEnvironment } = await import('../../../infra/portal/ownership.mjs');
  for (const value of [undefined,'',' ','0','14','15','16','60','3599','3600','3601','-15','15.5','60.0','1e2','0x3c','Infinity','NaN','60x',' 60','60 ','60\n','+60','0060','9007199254740992']) {
    let runtimeAccepts = true;
    try { workerIntervalMs({...valid,WORKER_INTERVAL_SECONDS:value}); } catch { runtimeAccepts = false; }
    const report = validateEnvironment({...valid,WORKER_INTERVAL_SECONDS:value,WORKER_READINESS_MAX_AGE_SECONDS:'86400'});
    assert.equal(!report.errors.some(error => error.startsWith('WORKER_INTERVAL_SECONDS')),runtimeAccepts,JSON.stringify(value));
  }
  for (const key of ['RELEASE_OWNER_NAME','SUPPORT_OWNER_NAME']) for (const value of [owner,undefined,'',owner+' ',owner.toLowerCase()]) {
    let runtimeAccepts = true;
    try { validateRuntimeOwnership({...valid,[key]:value}); } catch { runtimeAccepts = false; }
    assert.equal(validateOwnershipEnvironment({...valid,[key]:value}).ok,runtimeAccepts);
  }
  for (const value of [undefined,'',' ','59','60','119','120','121','300','10800','10801','86400','86401','120.0','1e3','0x78',' 120','120 ','+120','00120','9007199254740992']) {
    let runtimeAccepts = true;
    try { workerReadinessMaxAgeMs({...valid,WORKER_READINESS_MAX_AGE_SECONDS:value}); } catch { runtimeAccepts = false; }
    const report = validateEnvironment({...valid,WORKER_READINESS_MAX_AGE_SECONDS:value});
    const preflightAccepts=!report.errors.some(error=>error.startsWith('WORKER_READINESS_MAX_AGE_SECONDS'));
    assert.equal(preflightAccepts,runtimeAccepts,JSON.stringify(value));
  }
});

test('production requires exact independent release and support declarations without exposing submitted values', () => {
  assert.doesNotThrow(() => validateRuntimeOwnership(valid));
  for (const key of ['RELEASE_OWNER_NAME','SUPPORT_OWNER_NAME']) {
    for (const value of [undefined, null, '', 'Gregg Clark', owner+' ', ' '+owner, owner.toLowerCase(), [owner], {name:owner}, 'sensitive submitted value']) {
      const env = {...valid, [key]:value};
      assert.throws(() => validateRuntimeOwnership(env), error => error.message === 'Production ownership declaration is invalid.');
      assert.equal(env[key],value,'validation must not rewrite the declaration');
    }
  }
  assert.doesNotThrow(() => validateRuntimeOwnership({NODE_ENV:'test'}));
});

test('exported production app constructor enforces owner and worker timing before store use', async () => {
  for (const overrides of [
    {RELEASE_OWNER_NAME:'altered'},
    {SUPPORT_OWNER_NAME:'altered'},
    {WORKER_INTERVAL_SECONDS:'1e2'}
    ,{WORKER_READINESS_MAX_AGE_SECONDS:'1e3'}
  ]) {
    const env={...valid,DEMO_MODE:'false',PUBLIC_ORIGIN:'https://portal.example',...overrides};
    const store={kind:'postgres',tx:async()=>{throw new Error('STORE_ACCESSED');},close:async()=>{}};
    await assert.rejects(createPortal({store,env}),error=>error.message!=='STORE_ACCESSED');
  }
});

test('production interval rejects invalid inputs rather than falling back or clamping', () => {
  for (const value of [undefined, '', ' ', '0','14','3601','-1','15.5','1e2','Infinity','NaN','60x',' 60','60 ']) {
    assert.throws(() => workerIntervalMs({...valid,WORKER_INTERVAL_SECONDS:value}), /Production worker interval is invalid/);
  }
  for (const value of ['15','60','3600']) assert.equal(workerIntervalMs({...valid,WORKER_INTERVAL_SECONDS:value}),Number(value)*1000);
  assert.equal(workerIntervalMs({NODE_ENV:'test'}),60000);
});

test('production readiness age uses the configured value and requires at least two worker intervals', () => {
  for (const value of [undefined,'','59','119','86401','120.0','1e3',' 300','300 ']) {
    assert.throws(()=>workerReadinessMaxAgeMs({...valid,WORKER_READINESS_MAX_AGE_SECONDS:value}),/Production worker readiness age is invalid/);
  }
  for (const value of ['120','300','10801','86400']) assert.equal(workerReadinessMaxAgeMs({...valid,WORKER_READINESS_MAX_AGE_SECONDS:value}),Number(value)*1000);
});

test('production portal boundary requires explicit non-demo mode and one exact HTTPS domain', () => {
  assert.doesNotThrow(()=>validateProductionPortalBoundary(valid));
  for (const overrides of [
    {DEMO_MODE:undefined},{DEMO_MODE:'true'},{DEMO_MODE:'False'},
    {PUBLIC_ORIGIN:undefined},{PUBLIC_ORIGIN:'http://portal.example'},{PUBLIC_ORIGIN:'https://portal.example/path'},
    {PUBLIC_ORIGIN:'https://operator@portal.example'},{PUBLIC_ORIGIN:'https://portal.example:443'},
    {PORTAL_DOMAIN:undefined},{PORTAL_DOMAIN:'other.example'},{PORTAL_DOMAIN:'https://portal.example'},{PORTAL_DOMAIN:'portal_example'},{PORTAL_DOMAIN:'-portal.example'},{PORTAL_DOMAIN:'portal..example'},{PORTAL_DOMAIN:'portal.example.'},{PORTAL_DOMAIN:'192.0.2.10'}
  ]) assert.throws(()=>validateProductionPortalBoundary({...valid,...overrides}),error=>error.message==='Production portal boundary is invalid.');
  assert.doesNotThrow(()=>validateProductionPortalBoundary({NODE_ENV:'test'}));
});

test('production runtime and preflight require the same exact demo-mode declaration', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  for(const value of [undefined,'','false','False','FALSE','true','0',false]){
    const env={...valid,...operational,...notification,...identity,...backup,...accessibility,...subscription,...ai,...processSurface,...images,PORTAL_AUTO_MIGRATE:'false',DATABASE_URL:'postgresql://db.invalid/mgt?sslmode=verify-full',DEMO_MODE:value};
    let runtimeAccepts=true;try{validateProductionPortalBoundary(env);}catch{runtimeAccepts=false;}
    const preflightAccepts=!validateEnvironment(env).errors.some(error=>error.startsWith('DEMO_MODE'));
    assert.equal(runtimeAccepts,preflightAccepts,JSON.stringify(value));
  }
});

test('exported production app constructor rejects unsafe portal boundaries before store use', async () => {
  for (const overrides of [{DEMO_MODE:'true'},{PUBLIC_ORIGIN:'https://portal.example/path'},{PORTAL_DOMAIN:'other.example'}]) {
    const store={kind:'postgres',tx:async()=>{throw new Error('STORE_ACCESSED');},close:async()=>{}};
    await assert.rejects(createPortal({store,env:{...valid,...overrides}}),error=>error.message==='Production portal boundary is invalid.');
  }
});

test('production process database admission matches preflight TLS and migration boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const database='postgresql://db.portal.test:5432/mgt?sslmode=verify-full';
  const processEnv={...valid,DATABASE_URL:database,PORTAL_AUTO_MIGRATE:'false'};
  assert.doesNotThrow(()=>validateProductionDatabaseAdmission(processEnv));
  for (const overrides of [
    {DATABASE_URL:undefined},{DATABASE_URL:'postgresql://db.portal.test/mgt'},{DATABASE_URL:'postgresql://db.portal.test/mgt?sslmode=disable'},
    {DATABASE_URL:'postgresql://db.portal.test?sslmode=verify-full'},{DATABASE_URL:'postgresql://db.portal.test/team/mgt?sslmode=verify-full'},{DATABASE_URL:'postgresql://db.portal.test/mgt?sslmode=verify-full#shadow'},
    {DATABASE_URL:database+'&application_name=alternate'},{DATABASE_URL:database+'&options=-csearch_path%3Dother'},
    {DATABASE_URL:database+'&sslmode=disable'},{DATABASE_URL:database+'&host=other.portal.test'},
    {PORTAL_AUTO_MIGRATE:undefined},{PORTAL_AUTO_MIGRATE:'true'},{PORTAL_AUTO_MIGRATE:'False'}
  ]) {
    const env={...processEnv,...overrides};
    let runtimeAccepts=true;
    try{validateProductionDatabaseAdmission(env);}catch(error){runtimeAccepts=false;assert.equal(error.message,'Production database admission is invalid.');}
    const report=validateEnvironment(env);
    const preflightAccepts=!report.errors.some(error=>error.startsWith('DATABASE_URL')||error.startsWith('PORTAL_AUTO_MIGRATE'));
    assert.equal(runtimeAccepts,preflightAccepts,JSON.stringify(overrides));
  }
  assert.doesNotThrow(()=>validateProductionDatabaseAdmission({NODE_ENV:'test'}));
});

const operational = {
  SUPPORT_OWNER_EMAIL:'support@mgtskincare.test', ALERT_OWNER_EMAIL:'alerts@mgtskincare.test',
  MONITORING_DASHBOARD_URL:'https://monitoring.mgtskincare.test/dashboard', INCIDENT_RUNBOOK_URL:'https://operations.mgtskincare.test/runbook',
  SUPPORT_RESPONSE_TARGET_HOURS:'24', OPERATIONS_ALERT_DELIVERY:'webhook', OPERATIONS_ALERT_WEBHOOK_URL:'https://alerts.mgtskincare.test/events',
  OPERATIONS_ALERT_WEBHOOK_TOKEN:'configured-alert-token', OPERATIONS_ALERT_TIMEOUT_MS:'10000', OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS:'300',
  OPERATIONS_ALERT_EVENT_RETENTION_DAYS:'90', OPERATIONS_ALERT_LEASE_SECONDS:'60', OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS:'3600',
  OPERATIONS_ALERT_MAX_ATTEMPTS:'5', OPERATIONS_ALERT_KEY_ID:'primary'
};
const notification = {
  NOTIFICATION_DELIVERY:'webhook', NOTIFICATION_WEBHOOK_URL:'https://notifications.mgtskincare.test/events',
  NOTIFICATION_WEBHOOK_TOKEN:'configured-notification-token', NOTIFICATION_WEBHOOK_KEY_ID:'primary', NOTIFICATION_WEBHOOK_TIMEOUT_MS:'10000',
  NOTIFICATION_RETRY_COOLDOWN_SECONDS:'300', NOTIFICATION_MAX_RETRY_DELAY_SECONDS:'3600', NOTIFICATION_MAX_ATTEMPTS:'3',
  OPERATIONS_NOTIFICATION_RETENTION_DAYS:'90'
};
const identity = {
  SUPABASE_URL:'https://identity.mgtskincare.test', SUPABASE_ANON_KEY:'anon', SUPABASE_SERVICE_ROLE_KEY:'service'
};
const backup = {BACKUP_MAX_AGE_HOURS:'26',BACKUP_RESTORE_MAX_AGE_DAYS:'90'};
const accessibility = {ACCESSIBILITY_VALIDATION_REPORT_URL:'https://evidence.mgtskincare.test/accessibility',ACCESSIBILITY_VALIDATED_AT:'2026-01-01T00:00:00.000Z'};
const subscription = {SUBSCRIPTIONS_ENABLED:'false'};
const ai = {OLLAMA_ENABLED:'false',OPENCLAW_ENABLED:'false'};
const processSurface = {HOST:'0.0.0.0',PORT:'3100',WORKER_HEALTH_FILE:'/tmp/mgt-worker-health.json'};
const images = {NODE_IMAGE:'node@sha256:'+'a'.repeat(64),API_IMAGE:'ghcr.io/mgt/api@sha256:'+'b'.repeat(64),WEB_IMAGE:'ghcr.io/mgt/web@sha256:'+'c'.repeat(64),OLLAMA_IMAGE:'ollama/ollama@sha256:'+'d'.repeat(64),CADDY_IMAGE:'caddy@sha256:'+'e'.repeat(64)};

test('production operations admission matches preflight support, monitoring, and alert boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const processEnv={...valid,...operational};
  assert.doesNotThrow(()=>validateProductionOperationsAdmission(processEnv));
  const cases=[
    {SUPPORT_OWNER_EMAIL:''},{ALERT_OWNER_EMAIL:'invalid'},{MONITORING_DASHBOARD_URL:'http://monitoring.mgtskincare.test'},
    {MONITORING_DASHBOARD_URL:'https://monitoring.mgtskincare.test/dashboard?token=hidden'},{INCIDENT_RUNBOOK_URL:'https://operator@operations.mgtskincare.test/runbook'},{INCIDENT_RUNBOOK_URL:'https://operations.mgtskincare.test/runbook#alternate'},{SUPPORT_RESPONSE_TARGET_HOURS:'24.0'},
    {OPERATIONS_ALERT_DELIVERY:'disabled'},{OPERATIONS_ALERT_WEBHOOK_URL:'http://alerts.mgtskincare.test/events'},{OPERATIONS_ALERT_WEBHOOK_URL:'https://alerts.mgtskincare.test/events?token=hidden'},
    {OPERATIONS_ALERT_WEBHOOK_TOKEN:'change-me'},{OPERATIONS_ALERT_WEBHOOK_TOKEN:' configured-alert-token '},{OPERATIONS_ALERT_WEBHOOK_TOKEN:'configured\nalert-token'},{OPERATIONS_ALERT_TIMEOUT_MS:'1e4'},
    {OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS:'9'},{OPERATIONS_ALERT_EVENT_RETENTION_DAYS:'0'},
    {OPERATIONS_ALERT_LEASE_SECONDS:'9'},{OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS:'299'},
    {OPERATIONS_ALERT_MAX_ATTEMPTS:'21'},{OPERATIONS_ALERT_KEY_ID:undefined},{OPERATIONS_ALERT_KEY_ID:''},{OPERATIONS_ALERT_KEY_ID:'not valid'}
  ];
  const operationalKeys=new Set([...Object.keys(operational),'OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS']);
  for(const overrides of cases){
    const env={...processEnv,...overrides};
    let runtimeAccepts=true;
    try{validateProductionOperationsAdmission(env);}catch(error){runtimeAccepts=false;assert.equal(error.message,'Production operations admission is invalid.');}
    const report=validateEnvironment(env);
    const preflightAccepts=!report.errors.some(error=>operationalKeys.has(error.split(' ')[0]));
    assert.equal(runtimeAccepts,preflightAccepts,JSON.stringify(overrides));
  }
  assert.doesNotThrow(()=>validateProductionOperationsAdmission({NODE_ENV:'test'}));
});

test('production notification admission matches preflight delivery and retry boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const processEnv={...valid,...operational,...notification};
  assert.doesNotThrow(()=>validateProductionNotificationAdmission(processEnv));
  assert.doesNotThrow(()=>validateProductionNotificationAdmission({...processEnv,NOTIFICATION_DELIVERY:'in_app'}));
  const cases=[
    {NOTIFICATION_DELIVERY:undefined},{NOTIFICATION_DELIVERY:'disabled'},
    {NOTIFICATION_WEBHOOK_URL:'http://notifications.mgtskincare.test/events'},
    {NOTIFICATION_WEBHOOK_URL:'https://operator@notifications.mgtskincare.test/events'},{NOTIFICATION_WEBHOOK_URL:'https://notifications.mgtskincare.test/events#alternate'},
    {NOTIFICATION_WEBHOOK_TOKEN:''},{NOTIFICATION_WEBHOOK_TOKEN:'change-me'},{NOTIFICATION_WEBHOOK_TOKEN:' configured-notification-token '},{NOTIFICATION_WEBHOOK_TOKEN:'configured\tnotification-token'},
    {NOTIFICATION_WEBHOOK_KEY_ID:undefined},{NOTIFICATION_WEBHOOK_KEY_ID:''},{NOTIFICATION_WEBHOOK_KEY_ID:'not valid'},
    {NOTIFICATION_WEBHOOK_TIMEOUT_MS:''},{NOTIFICATION_WEBHOOK_TIMEOUT_MS:'1e4'},
    {NOTIFICATION_RETRY_COOLDOWN_SECONDS:'3e2'},{NOTIFICATION_RETRY_COOLDOWN_SECONDS:'9'},
    {NOTIFICATION_MAX_RETRY_DELAY_SECONDS:'300.0'},{NOTIFICATION_MAX_RETRY_DELAY_SECONDS:'299'},
    {NOTIFICATION_MAX_ATTEMPTS:'3.0'},{NOTIFICATION_MAX_ATTEMPTS:'0'},
    {OPERATIONS_NOTIFICATION_RETENTION_DAYS:'90.0'},{OPERATIONS_NOTIFICATION_RETENTION_DAYS:'0'}
  ];
  const notificationKeys=new Set(Object.keys(notification));
  for(const overrides of cases){
    const env={...processEnv,...overrides};
    let runtimeAccepts=true;
    try{validateProductionNotificationAdmission(env);}catch(error){runtimeAccepts=false;assert.equal(error.message,'Production notification admission is invalid.');}
    const report=validateEnvironment(env);
    const preflightAccepts=!report.errors.some(error=>notificationKeys.has(error.split(' ')[0]));
    assert.equal(runtimeAccepts,preflightAccepts,JSON.stringify(overrides));
  }
  assert.doesNotThrow(()=>validateProductionNotificationAdmission({NODE_ENV:'test'}));
});

test('production identity admission matches preflight endpoint and credential-reference boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const processEnv={...valid,...operational,...notification,...identity};
  assert.doesNotThrow(()=>validateProductionIdentityAdmission(processEnv));
  const cases=[
    {SUPABASE_URL:undefined},{SUPABASE_URL:'http://identity.mgtskincare.test'},
    {SUPABASE_URL:'https://operator@identity.mgtskincare.test'},
    {SUPABASE_URL:'https://identity.mgtskincare.test/auth'},{SUPABASE_URL:'https://identity.mgtskincare.test?tenant=other'},{SUPABASE_URL:'https://identity.mgtskincare.test#shadow'},
    {SUPABASE_ANON_KEY:undefined},{SUPABASE_ANON_KEY:''},{SUPABASE_ANON_KEY:'change-me'},{SUPABASE_ANON_KEY:' anon'},{SUPABASE_ANON_KEY:'anon\nkey'},
    {SUPABASE_SERVICE_ROLE_KEY:undefined},{SUPABASE_SERVICE_ROLE_KEY:''},{SUPABASE_SERVICE_ROLE_KEY:'change-me'},{SUPABASE_SERVICE_ROLE_KEY:'service '},{SUPABASE_SERVICE_ROLE_KEY:'service\tkey'},
    {SUPABASE_SERVICE_ROLE_KEY:'anon'}
  ];
  const identityKeys=new Set(Object.keys(identity));
  for(const overrides of cases){
    const env={...processEnv,...overrides};
    let runtimeAccepts=true;
    try{validateProductionIdentityAdmission(env);}catch(error){runtimeAccepts=false;assert.equal(error.message,'Production identity admission is invalid.');}
    const report=validateEnvironment(env);
    const preflightAccepts=!report.errors.some(error=>identityKeys.has(error.split(' ')[0]));
    assert.equal(runtimeAccepts,preflightAccepts,JSON.stringify(overrides));
  }
  assert.doesNotThrow(()=>validateProductionIdentityAdmission({NODE_ENV:'test'}));
});

test('production backup admission matches preflight freshness boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const processEnv={...valid,...operational,...notification,...identity,...backup};
  assert.doesNotThrow(()=>validateProductionBackupAdmission(processEnv));
  for(const overrides of [{BACKUP_MAX_AGE_HOURS:undefined},{BACKUP_MAX_AGE_HOURS:'0'},{BACKUP_MAX_AGE_HOURS:'72.0'},{BACKUP_MAX_AGE_HOURS:'73'},{BACKUP_RESTORE_MAX_AGE_DAYS:''},{BACKUP_RESTORE_MAX_AGE_DAYS:'1e2'},{BACKUP_RESTORE_MAX_AGE_DAYS:'366'}]){
    const env={...processEnv,...overrides};let runtimeAccepts=true;
    try{validateProductionBackupAdmission(env);}catch(error){runtimeAccepts=false;assert.equal(error.message,'Production backup admission is invalid.');}
    const report=validateEnvironment(env),preflightAccepts=!report.errors.some(error=>error.startsWith('BACKUP_'));
    assert.equal(runtimeAccepts,preflightAccepts,JSON.stringify(overrides));
  }
});

test('production accessibility admission matches preflight evidence boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const processEnv={...valid,...operational,...notification,...identity,...backup,...accessibility};
  assert.doesNotThrow(()=>validateProductionAccessibilityAdmission(processEnv));
  for(const overrides of [{ACCESSIBILITY_VALIDATION_REPORT_URL:''},{ACCESSIBILITY_VALIDATION_REPORT_URL:'http://evidence.mgtskincare.test/a'},{ACCESSIBILITY_VALIDATION_REPORT_URL:'https://operator@evidence.mgtskincare.test/a'},{ACCESSIBILITY_VALIDATION_REPORT_URL:'https://evidence.mgtskincare.test/a?token=hidden'},{ACCESSIBILITY_VALIDATION_REPORT_URL:'https://evidence.mgtskincare.test/a#alternate'},{ACCESSIBILITY_VALIDATED_AT:''},{ACCESSIBILITY_VALIDATED_AT:'2026-01-01T00:00:00Z'},{ACCESSIBILITY_VALIDATED_AT:'2999-01-01T00:00:00.000Z'}]){
    const env={...processEnv,...overrides};let runtimeAccepts=true;
    try{validateProductionAccessibilityAdmission(env);}catch(error){runtimeAccepts=false;assert.equal(error.message,'Production accessibility admission is invalid.');}
    const report=validateEnvironment(env),preflightAccepts=!report.errors.some(error=>error.startsWith('ACCESSIBILITY_'));
    assert.equal(runtimeAccepts,preflightAccepts,JSON.stringify(overrides));
  }
});

test('production subscription admission matches preflight billing boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const enabled={SUBSCRIPTIONS_ENABLED:'true',SUBSCRIPTION_TERMS_APPROVED:'true',STRIPE_LIVE_MODE:'true',STRIPE_SECRET_KEY:'sk_live_configured',STRIPE_SUBSCRIPTION_WEBHOOK_SECRET:'whsec_configured',STRIPE_PREMIUM_PRODUCT_ID:'prod_premium',STRIPE_PREMIUM_MONTHLY_PRICE_ID:'price_premium_month',STRIPE_PREMIUM_ANNUAL_PRICE_ID:'price_premium_year'};
  const processEnv={...valid,...operational,...notification,...identity,...backup,...accessibility,...enabled};
  assert.doesNotThrow(()=>validateProductionSubscriptionAdmission(processEnv));
  assert.doesNotThrow(()=>validateProductionSubscriptionAdmission({...processEnv,SUBSCRIPTIONS_ENABLED:'false'}));
  for(const overrides of [{SUBSCRIPTIONS_ENABLED:undefined},{SUBSCRIPTIONS_ENABLED:'True'},{SUBSCRIPTION_TERMS_APPROVED:'false'},{STRIPE_LIVE_MODE:'TRUE'},{STRIPE_SECRET_KEY:'sk_test_wrong'},{STRIPE_SUBSCRIPTION_WEBHOOK_SECRET:'invalid'},{STRIPE_PREMIUM_PRODUCT_ID:'price_wrong'},{STRIPE_PREMIUM_MONTHLY_PRICE_ID:'invalid'},{STRIPE_PREMIUM_ANNUAL_PRICE_ID:'price_premium_month'}]){
    const env={...processEnv,...overrides};let runtimeAccepts=true;
    try{validateProductionSubscriptionAdmission(env);}catch(error){runtimeAccepts=false;assert.equal(error.message,'Production subscription admission is invalid.');}
    const report=validateEnvironment(env),keys=new Set(Object.keys(enabled)),preflightAccepts=!report.errors.some(error=>keys.has(error.split(' ')[0])||error.includes('different Stripe Price IDs'));
    assert.equal(runtimeAccepts,preflightAccepts,JSON.stringify(overrides));
  }
});

test('production AI admission matches preflight provider boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const enabled={OLLAMA_ENABLED:'true',OLLAMA_BASE_URL:'http://ollama:11434',OPENCLAW_ENABLED:'true',OPENCLAW_BASE_URL:'https://openclaw.mgtskincare.test',OPENCLAW_API_MODE:'ollama'};
  const processEnv={...valid,...operational,...notification,...identity,...backup,...accessibility,...subscription,...enabled};
  assert.doesNotThrow(()=>validateProductionAiAdmission(processEnv));
  for(const overrides of [{OLLAMA_ENABLED:'True'},{OLLAMA_BASE_URL:'http://localhost:11434'},{OLLAMA_BASE_URL:'http://ollama.internal:11434'},{OLLAMA_BASE_URL:'http://192.0.2.10:11434'},{OLLAMA_BASE_URL:'https://operator@ollama.mgtskincare.test'},{OLLAMA_BASE_URL:'https://ollama.mgtskincare.test?model=other'},{OLLAMA_BASE_URL:' https://ollama.mgtskincare.test'},{OPENCLAW_ENABLED:'TRUE'},{OPENCLAW_BASE_URL:'http://localhost:8080'},{OPENCLAW_BASE_URL:'http://openclaw.internal:8080'},{OPENCLAW_BASE_URL:'https://openclaw_internal'},{OPENCLAW_BASE_URL:'https://openclaw.mgtskincare.test#alternate'},{OPENCLAW_BASE_URL:'https://openclaw.mgtskincare.test?tenant=other'},{OPENCLAW_API_MODE:undefined},{OPENCLAW_API_MODE:'invalid'},{OPENCLAW_API_MODE:'openai-completions',OPENCLAW_API_KEY:''},{OPENCLAW_API_MODE:'openai-completions',OPENCLAW_API_KEY:'change-me'},{OPENCLAW_API_MODE:'openai-completions',OPENCLAW_API_KEY:' configured-key '},{OPENAI_API_KEY:'change-me'},{OPENAI_API_KEY:'configured\nkey'}]){
    const env={...processEnv,...overrides};let runtimeAccepts=true;
    try{validateProductionAiAdmission(env);}catch(error){runtimeAccepts=false;assert.equal(error.message,'Production AI admission is invalid.');}
    const report=validateEnvironment(env),preflightAccepts=!report.errors.some(error=>/^(OLLAMA_|OPENCLAW_|OPENAI_)/.test(error));
    assert.equal(runtimeAccepts,preflightAccepts,JSON.stringify(overrides));
  }
});

test('production process surface admission matches preflight listener and health-file boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const processEnv={...valid,...operational,...notification,...identity,...backup,...accessibility,...subscription,...ai,...processSurface};
  assert.doesNotThrow(()=>validateProductionProcessSurfaceAdmission(processEnv));
  for(const overrides of [{HOST:undefined},{HOST:'127.0.0.1'},{PORT:''},{PORT:'3100.0'},{PORT:'80'},{PORT:'65536'},{WORKER_HEALTH_FILE:''},{WORKER_HEALTH_FILE:'relative.json'},{WORKER_HEALTH_FILE:'/tmp/../health.json'},{WORKER_HEALTH_FILE:'C:\\tmp\\health.json'},{WORKER_HEALTH_FILE:'/tmp/health.txt'}]){
    const env={...processEnv,...overrides};let runtimeAccepts=true;
    try{validateProductionProcessSurfaceAdmission(env);}catch(error){runtimeAccepts=false;assert.equal(error.message,'Production process surface admission is invalid.');}
    const report=validateEnvironment(env),preflightAccepts=!report.errors.some(error=>/^(HOST|PORT|WORKER_HEALTH_FILE)/.test(error));
    assert.equal(runtimeAccepts,preflightAccepts,JSON.stringify(overrides));
  }
});

test('production image admission matches preflight immutable digest boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const processEnv={...valid,...operational,...notification,...identity,...backup,...accessibility,...subscription,...ai,...processSurface,...images};
  assert.doesNotThrow(()=>validateProductionImageAdmission(processEnv));
  for(const overrides of [{NODE_IMAGE:undefined},{API_IMAGE:'ghcr.io/mgt/api:latest'},{WEB_IMAGE:'ghcr.io/mgt/web@sha256:ABC'},{OLLAMA_IMAGE:'ollama/ollama@sha256:'+'a'.repeat(63)},{CADDY_IMAGE:'https://registry.test/caddy@sha256:'+'e'.repeat(64)},{WEB_IMAGE:images.API_IMAGE},{CADDY_IMAGE:images.NODE_IMAGE}]){
    const env={...processEnv,...overrides};let runtimeAccepts=true;
    try{validateProductionImageAdmission(env);}catch(error){runtimeAccepts=false;assert.equal(error.message,'Production image admission is invalid.');}
    const report=validateEnvironment(env),preflightAccepts=!report.errors.some(error=>/^(NODE_IMAGE|API_IMAGE|WEB_IMAGE|OLLAMA_IMAGE|CADDY_IMAGE|Production image references)/.test(error));
    assert.equal(runtimeAccepts,preflightAccepts,JSON.stringify(overrides));
  }
});

test('production secret isolation matches preflight integration-role boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const processEnv={...valid,...operational,...notification,...identity,...backup,...accessibility,...subscription,...ai,...processSurface,...images};
  assert.doesNotThrow(()=>validateProductionSecretIsolation(processEnv));
  for(const overrides of [
    {OPERATIONS_ALERT_WEBHOOK_TOKEN:identity.SUPABASE_SERVICE_ROLE_KEY},
    {NOTIFICATION_WEBHOOK_TOKEN:operational.OPERATIONS_ALERT_WEBHOOK_TOKEN},
    {OPENAI_API_KEY:identity.SUPABASE_ANON_KEY}
  ]){
    const env={...processEnv,...overrides};
    assert.throws(()=>validateProductionSecretIsolation(env),error=>error.message==='Production secret isolation is invalid.');
    assert.ok(validateEnvironment(env).errors.some(error=>error.startsWith('Production secret references')));
  }
});

test('production endpoint isolation matches preflight control-role boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const processEnv={...valid,...operational,...notification,...identity,...backup,...accessibility,...subscription,...ai,...processSurface,...images};
  assert.doesNotThrow(()=>validateProductionEndpointIsolation(processEnv));
  for(const overrides of [
    {INCIDENT_RUNBOOK_URL:operational.MONITORING_DASHBOARD_URL},
    {ACCESSIBILITY_VALIDATION_REPORT_URL:operational.INCIDENT_RUNBOOK_URL},
    {NOTIFICATION_WEBHOOK_URL:operational.OPERATIONS_ALERT_WEBHOOK_URL}
  ]){
    const env={...processEnv,...overrides};
    assert.throws(()=>validateProductionEndpointIsolation(env),error=>error.message==='Production endpoint isolation is invalid.');
    assert.ok(validateEnvironment(env).errors.some(error=>error.startsWith('Production control and delivery endpoints')));
  }
});

test('production disabled-feature residue matches preflight boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const processEnv={...valid,...operational,...notification,...identity,...backup,...accessibility,...subscription,...ai,...processSurface,...images};
  assert.doesNotThrow(()=>validateProductionDisabledFeatureResidue(processEnv));
  const disabled={...processEnv,NOTIFICATION_DELIVERY:'in_app'};
  delete disabled.NOTIFICATION_WEBHOOK_URL;delete disabled.NOTIFICATION_WEBHOOK_TOKEN;delete disabled.NOTIFICATION_WEBHOOK_KEY_ID;delete disabled.NOTIFICATION_WEBHOOK_TIMEOUT_MS;
  for(const overrides of [
    {NOTIFICATION_DELIVERY:'in_app',NOTIFICATION_WEBHOOK_TOKEN:'dormant-token'},
    {OLLAMA_ENABLED:'false',OLLAMA_BASE_URL:'http://ollama:11434'},
    {OPENCLAW_ENABLED:'false',OPENCLAW_API_MODE:'ollama'},
    {SUBSCRIPTIONS_ENABLED:'false',STRIPE_SECRET_KEY:'sk_live_dormant'}
  ]){
    const env={...disabled,...overrides};
    assert.throws(()=>validateProductionDisabledFeatureResidue(env),error=>error.message==='Production disabled feature residue is invalid.');
    assert.ok(validateEnvironment(env).errors.some(error=>/^(Disabled customer|Disabled Ollama|Disabled OpenClaw|Disabled subscriptions)/.test(error)));
  }
});

// A fake store throws if initialized. This proves the guard runs before any
// database work, without contacting real services or requiring PostgreSQL.
function probeStartup(entry, overrides = {}) {
  const storePath = require.resolve('../dist/portal/store');
  const entryPath = path.resolve(__dirname,`../dist/portal/${entry}.js`);
  const boot = `const Module=require('node:module');const store=require(${JSON.stringify(storePath)});store.PgStore=class{constructor(){process.stderr.write('DATABASE_OPENED');process.exit(77);}};Module.runMain(${JSON.stringify(entryPath)});`;
  const env = {...process.env,...valid,...operational,...notification,...identity,...backup,...accessibility,...subscription,...ai,...processSurface,...images,PORTAL_AUTO_MIGRATE:'false',DATABASE_URL:'postgresql://db.invalid/mgt?sslmode=verify-full',...overrides};
  return spawnSync(process.execPath,['-e',boot],{env,encoding:'utf8',timeout:10000,windowsHide:true});
}

for (const entry of ['server','worker']) test(`${entry} rejects invalid owners before database initialization`, () => {
  for (const key of ['RELEASE_OWNER_NAME','SUPPORT_OWNER_NAME']) {
    const child = probeStartup(entry,{[key]:'invalid-owner'});
    assert.equal(child.error,undefined);
    assert.equal(child.status,1);
    assert.doesNotMatch(child.stderr,/DATABASE_OPENED|invalid-owner|db\.invalid/);
    assert.match(child.stderr,entry==='server'?/portal_startup_failed/:/worker_startup_failed/);
  }
  const admitted = probeStartup(entry);
  assert.equal(admitted.error,undefined);
  assert.equal(admitted.status,77,'valid declarations reach the fake store, proving the negative probes exercised startup');
  assert.match(admitted.stderr,/DATABASE_OPENED/);
});

test('worker entry point rejects unsafe timing before opening a database and emits only a bounded diagnostic', () => {
  for (const value of ['', '14', '3601', '1e2', '60.5', 'sensitive-timing-value']) {
    const child = probeStartup('worker',{WORKER_INTERVAL_SECONDS:value});
    assert.equal(child.error,undefined);
    assert.equal(child.status,1);
    assert.doesNotMatch(child.stderr,/DATABASE_OPENED|sensitive-timing-value|db\.invalid/);
    assert.deepEqual(JSON.parse(child.stderr.trim()),{worker:'portal-operations',event:'worker_startup_failed'});
  }
});

test('API entry point rejects unsafe readiness age before opening a database', () => {
  for (const value of ['119','86401','1e3','sensitive-readiness-value']) {
    const child=probeStartup('server',{WORKER_READINESS_MAX_AGE_SECONDS:value});
    assert.equal(child.error,undefined);
    assert.equal(child.status,1);
    assert.doesNotMatch(child.stderr,/DATABASE_OPENED|sensitive-readiness-value|db\.invalid/);
    assert.deepEqual(JSON.parse(child.stderr.trim()),{event:'portal_startup_failed',code:'startup_failed'});
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects unsafe database admission before initialization`, () => {
  for (const overrides of [
    {DATABASE_URL:''},{DATABASE_URL:'postgresql://db.invalid/mgt'},{DATABASE_URL:'postgresql://db.invalid/mgt?sslmode=disable'},
    {DATABASE_URL:'postgresql://db.invalid?sslmode=verify-full'},{DATABASE_URL:'postgresql://db.invalid/team/mgt?sslmode=verify-full'},{DATABASE_URL:'postgresql://db.invalid/mgt?sslmode=verify-full#shadow'},
    {DATABASE_URL:'postgresql://db.invalid/mgt?sslmode=verify-full&application_name=alternate'},{DATABASE_URL:'postgresql://db.invalid/mgt?sslmode=verify-full&options=-csearch_path%3Dother'},
    {DATABASE_URL:'postgresql://db.invalid/mgt?sslmode=verify-full&host=other.invalid'},
    {PORTAL_AUTO_MIGRATE:''},{PORTAL_AUTO_MIGRATE:'true'},{PORTAL_AUTO_MIGRATE:'False'}
  ]) {
    const child=probeStartup(entry,overrides);
    assert.equal(child.error,undefined);
    assert.equal(child.status,1);
    assert.doesNotMatch(child.stderr,/DATABASE_OPENED|db\.invalid|other\.invalid/);
    assert.deepEqual(JSON.parse(child.stderr.trim()),entry==='server'?{event:'portal_startup_failed',code:'startup_failed'}:{worker:'portal-operations',event:'worker_startup_failed'});
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects unsafe operational controls before database initialization`, () => {
  for (const overrides of [
    {SUPPORT_OWNER_EMAIL:''},{ALERT_OWNER_EMAIL:'invalid'},{MONITORING_DASHBOARD_URL:'http://monitoring.mgtskincare.test'},
    {SUPPORT_RESPONSE_TARGET_HOURS:'24.0'},{OPERATIONS_ALERT_DELIVERY:'disabled'},
    {OPERATIONS_ALERT_WEBHOOK_URL:'http://alerts.mgtskincare.test/events'},{OPERATIONS_ALERT_WEBHOOK_URL:'https://alerts.mgtskincare.test/events?token=hidden'},{OPERATIONS_ALERT_WEBHOOK_TOKEN:'change-me'},{OPERATIONS_ALERT_WEBHOOK_TOKEN:' configured-alert-token '},{OPERATIONS_ALERT_WEBHOOK_TOKEN:'configured\nalert-token'},
    {OPERATIONS_ALERT_TIMEOUT_MS:'1e4'},{OPERATIONS_ALERT_LEASE_SECONDS:'9'},
    {OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS:'299'},{OPERATIONS_ALERT_MAX_ATTEMPTS:'21'},{OPERATIONS_ALERT_KEY_ID:undefined},{OPERATIONS_ALERT_KEY_ID:''},{OPERATIONS_ALERT_KEY_ID:'not valid'}
  ]) {
    const child=probeStartup(entry,overrides);
    assert.equal(child.error,undefined);
    assert.equal(child.status,1);
    assert.doesNotMatch(child.stderr,/DATABASE_OPENED|mgtskincare\.test|change-me|not valid/);
    assert.deepEqual(JSON.parse(child.stderr.trim()),entry==='server'?{event:'portal_startup_failed',code:'startup_failed'}:{worker:'portal-operations',event:'worker_startup_failed'});
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects unsafe notification controls before database initialization`, () => {
  for (const overrides of [
    {NOTIFICATION_DELIVERY:'disabled'},{NOTIFICATION_WEBHOOK_URL:'http://notifications.mgtskincare.test/events'},{NOTIFICATION_WEBHOOK_URL:'https://notifications.mgtskincare.test/events#alternate'},
    {NOTIFICATION_WEBHOOK_TOKEN:'change-me'},{NOTIFICATION_WEBHOOK_TOKEN:' configured-notification-token '},{NOTIFICATION_WEBHOOK_TOKEN:'configured\tnotification-token'},{NOTIFICATION_WEBHOOK_KEY_ID:undefined},{NOTIFICATION_WEBHOOK_KEY_ID:''},{NOTIFICATION_WEBHOOK_KEY_ID:'not valid'},
    {NOTIFICATION_WEBHOOK_TIMEOUT_MS:'1e4'},{NOTIFICATION_RETRY_COOLDOWN_SECONDS:'3e2'},
    {NOTIFICATION_MAX_RETRY_DELAY_SECONDS:'299'},{NOTIFICATION_MAX_ATTEMPTS:'0'},
    {OPERATIONS_NOTIFICATION_RETENTION_DAYS:'90.0'}
  ]) {
    const child=probeStartup(entry,overrides);
    assert.equal(child.error,undefined);
    assert.equal(child.status,1);
    assert.doesNotMatch(child.stderr,/DATABASE_OPENED|mgtskincare\.test|change-me|not valid/);
    assert.deepEqual(JSON.parse(child.stderr.trim()),entry==='server'?{event:'portal_startup_failed',code:'startup_failed'}:{worker:'portal-operations',event:'worker_startup_failed'});
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects unsafe identity controls before database initialization`, () => {
  for (const overrides of [
    {SUPABASE_URL:''},{SUPABASE_URL:'http://identity.mgtskincare.test'},
    {SUPABASE_URL:'https://operator@identity.mgtskincare.test'},
    {SUPABASE_URL:'https://identity.mgtskincare.test/auth'},{SUPABASE_URL:'https://identity.mgtskincare.test?tenant=other'},{SUPABASE_URL:'https://identity.mgtskincare.test#shadow'},
    {SUPABASE_ANON_KEY:''},{SUPABASE_ANON_KEY:'change-me'},{SUPABASE_ANON_KEY:' anon'},{SUPABASE_ANON_KEY:'anon\nkey'},
    {SUPABASE_SERVICE_ROLE_KEY:''},{SUPABASE_SERVICE_ROLE_KEY:'change-me'},{SUPABASE_SERVICE_ROLE_KEY:'service '},{SUPABASE_SERVICE_ROLE_KEY:'service\tkey'},
    {SUPABASE_SERVICE_ROLE_KEY:'anon'}
  ]) {
    const child=probeStartup(entry,overrides);
    assert.equal(child.error,undefined);
    assert.equal(child.status,1);
    assert.doesNotMatch(child.stderr,/DATABASE_OPENED|mgtskincare\.test|change-me|operator@/);
    assert.deepEqual(JSON.parse(child.stderr.trim()),entry==='server'?{event:'portal_startup_failed',code:'startup_failed'}:{worker:'portal-operations',event:'worker_startup_failed'});
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects unsafe backup controls before database initialization`, () => {
  for (const overrides of [{BACKUP_MAX_AGE_HOURS:''},{BACKUP_MAX_AGE_HOURS:'72.0'},{BACKUP_MAX_AGE_HOURS:'73'},{BACKUP_RESTORE_MAX_AGE_DAYS:'1e2'},{BACKUP_RESTORE_MAX_AGE_DAYS:'366'}]) {
    const child=probeStartup(entry,overrides);assert.equal(child.error,undefined);assert.equal(child.status,1);assert.doesNotMatch(child.stderr,/DATABASE_OPENED|72\.0|1e2/);
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects unsafe accessibility evidence before database initialization`, () => {
  for (const overrides of [{ACCESSIBILITY_VALIDATION_REPORT_URL:''},{ACCESSIBILITY_VALIDATION_REPORT_URL:'http://evidence.mgtskincare.test/a'},{ACCESSIBILITY_VALIDATION_REPORT_URL:'https://evidence.mgtskincare.test/a?token=hidden'},{ACCESSIBILITY_VALIDATION_REPORT_URL:'https://evidence.mgtskincare.test/a#alternate'},{ACCESSIBILITY_VALIDATED_AT:'2026-01-01T00:00:00Z'},{ACCESSIBILITY_VALIDATED_AT:'2999-01-01T00:00:00.000Z'}]) {
    const child=probeStartup(entry,overrides);assert.equal(child.error,undefined);assert.equal(child.status,1);assert.doesNotMatch(child.stderr,/DATABASE_OPENED|mgtskincare\.test|2999/);
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects unsafe subscription controls before database initialization`, () => {
  for (const overrides of [{SUBSCRIPTIONS_ENABLED:''},{SUBSCRIPTIONS_ENABLED:'False'},{SUBSCRIPTIONS_ENABLED:'true',SUBSCRIPTION_TERMS_APPROVED:'false'}]) {
    const child=probeStartup(entry,overrides);assert.equal(child.error,undefined);assert.equal(child.status,1);assert.doesNotMatch(child.stderr,/DATABASE_OPENED|False/);
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects unsafe AI provider controls before database initialization`, () => {
  for (const overrides of [{OLLAMA_ENABLED:'True'},{OLLAMA_ENABLED:'true',OLLAMA_BASE_URL:'http://localhost:11434'},{OLLAMA_ENABLED:'true',OLLAMA_BASE_URL:'http://ollama.internal:11434'},{OLLAMA_ENABLED:'true',OLLAMA_BASE_URL:'https://ollama.mgtskincare.test?model=other'},{OPENCLAW_ENABLED:'TRUE'},{OPENCLAW_ENABLED:'true',OPENCLAW_BASE_URL:'http://localhost:8080',OPENCLAW_API_MODE:'ollama'},{OPENCLAW_ENABLED:'true',OPENCLAW_BASE_URL:'http://openclaw.internal:8080',OPENCLAW_API_MODE:'ollama'},{OPENCLAW_ENABLED:'true',OPENCLAW_BASE_URL:'https://openclaw.mgtskincare.test#alternate',OPENCLAW_API_MODE:'ollama'},{OPENAI_API_KEY:'change-me'},{OPENAI_API_KEY:'configured\nkey'}]) {
    const child=probeStartup(entry,overrides);assert.equal(child.error,undefined);assert.equal(child.status,1);assert.doesNotMatch(child.stderr,/DATABASE_OPENED|localhost|change-me/);
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects unsafe process surfaces before database initialization`, () => {
  for (const overrides of [{HOST:'127.0.0.1'},{PORT:'3100.0'},{PORT:'80'},{WORKER_HEALTH_FILE:'relative.json'},{WORKER_HEALTH_FILE:'/tmp/../health.json'}]) {
    const child=probeStartup(entry,overrides);assert.equal(child.error,undefined);assert.equal(child.status,1);assert.doesNotMatch(child.stderr,/DATABASE_OPENED|127\.0\.0\.1|relative\.json/);
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects mutable or malformed image references before database initialization`, () => {
  for (const overrides of [{NODE_IMAGE:'node:latest'},{API_IMAGE:'ghcr.io/mgt/api:latest'},{WEB_IMAGE:''},{OLLAMA_IMAGE:'ollama/ollama@sha256:bad'},{CADDY_IMAGE:'caddy@sha256:'+'A'.repeat(64)},{WEB_IMAGE:images.API_IMAGE},{CADDY_IMAGE:images.NODE_IMAGE}]) {
    const child=probeStartup(entry,overrides);assert.equal(child.error,undefined);assert.equal(child.status,1);assert.doesNotMatch(child.stderr,/DATABASE_OPENED|latest|sha256/);
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects cross-wired integration secrets before database initialization`, () => {
  for (const overrides of [{OPERATIONS_ALERT_WEBHOOK_TOKEN:'service'},{NOTIFICATION_WEBHOOK_TOKEN:'configured-alert-token'},{OPENAI_API_KEY:'anon'}]) {
    const child=probeStartup(entry,overrides);assert.equal(child.error,undefined);assert.equal(child.status,1);assert.doesNotMatch(child.stderr,/DATABASE_OPENED|configured-alert-token|service|anon/);
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects cross-wired control endpoints before database initialization`, () => {
  for (const overrides of [{INCIDENT_RUNBOOK_URL:operational.MONITORING_DASHBOARD_URL},{ACCESSIBILITY_VALIDATION_REPORT_URL:operational.INCIDENT_RUNBOOK_URL},{NOTIFICATION_WEBHOOK_URL:operational.OPERATIONS_ALERT_WEBHOOK_URL}]) {
    const child=probeStartup(entry,overrides);assert.equal(child.error,undefined);assert.equal(child.status,1);assert.doesNotMatch(child.stderr,/DATABASE_OPENED|mgtskincare\.test/);
  }
});

for (const entry of ['server','worker']) test(`${entry} rejects disabled-feature configuration residue before database initialization`, () => {
  for (const overrides of [{OLLAMA_ENABLED:'false',OLLAMA_BASE_URL:'http://ollama:11434'},{OPENCLAW_ENABLED:'false',OPENCLAW_API_MODE:'ollama'},{SUBSCRIPTIONS_ENABLED:'false',STRIPE_SECRET_KEY:'sk_live_dormant'}]) {
    const child=probeStartup(entry,overrides);assert.equal(child.error,undefined);assert.equal(child.status,1);assert.doesNotMatch(child.stderr,/DATABASE_OPENED|dormant|ollama:11434/);
  }
});
