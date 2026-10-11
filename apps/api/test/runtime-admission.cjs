const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { validateRuntimeOwnership, workerIntervalMs } = require('../dist/portal/runtime-admission');
const { createPortal } = require('../dist/portal/server');
const owner = 'Gregg Clark of MGT';
const valid = { NODE_ENV:'production', RELEASE_OWNER_NAME:owner, SUPPORT_OWNER_NAME:owner, WORKER_INTERVAL_SECONDS:'60' };

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

// A fake store throws if initialized. This proves the guard runs before any
// database work, without contacting real services or requiring PostgreSQL.
function probeStartup(entry, overrides = {}) {
  const storePath = require.resolve('../dist/portal/store');
  const entryPath = path.resolve(__dirname,`../dist/portal/${entry}.js`);
  const boot = `const Module=require('node:module');const store=require(${JSON.stringify(storePath)});store.PgStore=class{constructor(){process.stderr.write('DATABASE_OPENED');process.exit(77);}};Module.runMain(${JSON.stringify(entryPath)});`;
  const env = {...process.env,...valid,PORTAL_AUTO_MIGRATE:'false',DATABASE_URL:'postgresql://db.invalid/mgt?sslmode=verify-full',...overrides};
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
