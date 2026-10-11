const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { validateRuntimeOwnership, validateProductionPortalBoundary, validateProductionDatabaseAdmission, validateProductionOperationsAdmission, workerIntervalMs, workerReadinessMaxAgeMs } = require('../dist/portal/runtime-admission');
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
    {PORTAL_DOMAIN:undefined},{PORTAL_DOMAIN:'other.example'},{PORTAL_DOMAIN:'https://portal.example'}
  ]) assert.throws(()=>validateProductionPortalBoundary({...valid,...overrides}),error=>error.message==='Production portal boundary is invalid.');
  assert.doesNotThrow(()=>validateProductionPortalBoundary({NODE_ENV:'test'}));
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

test('production operations admission matches preflight support, monitoring, and alert boundaries', async () => {
  const {validateEnvironment}=await import('../../../infra/portal/preflight.mjs');
  const processEnv={...valid,...operational};
  assert.doesNotThrow(()=>validateProductionOperationsAdmission(processEnv));
  const cases=[
    {SUPPORT_OWNER_EMAIL:''},{ALERT_OWNER_EMAIL:'invalid'},{MONITORING_DASHBOARD_URL:'http://monitoring.mgtskincare.test'},
    {INCIDENT_RUNBOOK_URL:'https://operator@operations.mgtskincare.test/runbook'},{SUPPORT_RESPONSE_TARGET_HOURS:'24.0'},
    {OPERATIONS_ALERT_DELIVERY:'disabled'},{OPERATIONS_ALERT_WEBHOOK_URL:'http://alerts.mgtskincare.test/events'},
    {OPERATIONS_ALERT_WEBHOOK_TOKEN:'change-me'},{OPERATIONS_ALERT_TIMEOUT_MS:'1e4'},
    {OPERATIONS_ALERT_RETRY_COOLDOWN_SECONDS:'9'},{OPERATIONS_ALERT_EVENT_RETENTION_DAYS:'0'},
    {OPERATIONS_ALERT_LEASE_SECONDS:'9'},{OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS:'299'},
    {OPERATIONS_ALERT_MAX_ATTEMPTS:'21'},{OPERATIONS_ALERT_KEY_ID:'not valid'}
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

// A fake store throws if initialized. This proves the guard runs before any
// database work, without contacting real services or requiring PostgreSQL.
function probeStartup(entry, overrides = {}) {
  const storePath = require.resolve('../dist/portal/store');
  const entryPath = path.resolve(__dirname,`../dist/portal/${entry}.js`);
  const boot = `const Module=require('node:module');const store=require(${JSON.stringify(storePath)});store.PgStore=class{constructor(){process.stderr.write('DATABASE_OPENED');process.exit(77);}};Module.runMain(${JSON.stringify(entryPath)});`;
  const env = {...process.env,...valid,...operational,PORTAL_AUTO_MIGRATE:'false',DATABASE_URL:'postgresql://db.invalid/mgt?sslmode=verify-full',...overrides};
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
    {OPERATIONS_ALERT_WEBHOOK_URL:'http://alerts.mgtskincare.test/events'},{OPERATIONS_ALERT_WEBHOOK_TOKEN:'change-me'},
    {OPERATIONS_ALERT_TIMEOUT_MS:'1e4'},{OPERATIONS_ALERT_LEASE_SECONDS:'9'},
    {OPERATIONS_ALERT_MAX_RETRY_DELAY_SECONDS:'299'},{OPERATIONS_ALERT_MAX_ATTEMPTS:'21'},{OPERATIONS_ALERT_KEY_ID:'not valid'}
  ]) {
    const child=probeStartup(entry,overrides);
    assert.equal(child.error,undefined);
    assert.equal(child.status,1);
    assert.doesNotMatch(child.stderr,/DATABASE_OPENED|mgtskincare\.test|change-me|not valid/);
    assert.deepEqual(JSON.parse(child.stderr.trim()),entry==='server'?{event:'portal_startup_failed',code:'startup_failed'}:{worker:'portal-operations',event:'worker_startup_failed'});
  }
});
