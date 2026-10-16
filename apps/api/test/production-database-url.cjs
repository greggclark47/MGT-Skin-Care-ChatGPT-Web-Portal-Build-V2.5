const assert = require('node:assert/strict');
const { installDatabasePoolErrorBoundary, PgStore, portalPoolConfig, startupMigrations, validateProductionDatabaseUrl } = require('../dist/portal/store');
const { portalMigrationIds, verifyPortalMigrations } = require('../dist/portal/migrations');

const production = { NODE_ENV: 'production' };
const baseline = new URL('postgresql://db.internal/mgt');
baseline.searchParams.set('sslmode', 'verify-full');
assert.doesNotThrow(() => validateProductionDatabaseUrl(baseline.toString(), production));
assert.equal(portalPoolConfig(baseline.toString()).idleTimeoutMillis,30000);
assert.equal(portalPoolConfig(baseline.toString()).query_timeout,12000);
assert.equal(portalPoolConfig(baseline.toString()).idle_in_transaction_session_timeout,15000);
assert.equal(portalPoolConfig(baseline.toString()).lock_timeout,5000);
assert.equal(portalPoolConfig(baseline.toString()).application_name,'mgt_skin_care_portal');
assert.equal(portalPoolConfig(baseline.toString()).maxLifetimeSeconds,300);
assert.equal(portalPoolConfig(baseline.toString()).keepAlive,true);
assert.equal(portalPoolConfig(baseline.toString()).keepAliveInitialDelayMillis,10000);
assert.throws(() => portalPoolConfig('x'.repeat(4097)), /Database URL is invalid/);
assert.throws(() => portalPoolConfig(' postgres://db.example.test/app '), /Database URL is invalid/);
let poolErrorListener;
const poolLogs=[];
installDatabasePoolErrorBoundary({on:(event,listener)=>{assert.equal(event,'error');poolErrorListener=listener;}},record=>poolLogs.push(record));
poolErrorListener(Object.assign(new Error('raw database host and query must not be logged'),{code:'57P01'}));
poolErrorListener(Object.assign(new Error('secret'),{code:'bad code'}));
poolErrorListener(null);
assert.deepEqual(poolLogs,[{event:'database_pool_error',code:'57P01'},{event:'database_pool_error',code:'database_pool_error'},{event:'database_pool_error',code:'database_pool_error'}]);
installDatabasePoolErrorBoundary({on:(event,listener)=>listener(new Error('ignored'))},()=>{throw new Error('logger failure');});

const unsafe = [
  url => url.searchParams.append('sslmode', 'disable'),
  url => url.searchParams.append('sslmode', 'verify-full'),
  url => url.searchParams.set('host', 'other.internal'),
  url => url.searchParams.set('port', '6543'),
  url => url.searchParams.set('user', 'other')
];
for (const change of unsafe) {
  const changed = new URL(baseline);
  change(changed);
  assert.throws(() => validateProductionDatabaseUrl(changed.toString(), production), /verified TLS/);
  assert.throws(() => new PgStore(changed.toString(), production), /verified TLS/);
}
assert.doesNotThrow(() => validateProductionDatabaseUrl(baseline.toString(), { NODE_ENV: 'test' }));
assert.throws(() => validateProductionDatabaseUrl(123, production), /verified TLS/);
assert.throws(() => validateProductionDatabaseUrl(' '+baseline.toString(), production), /verified TLS/);
assert.equal(startupMigrations({NODE_ENV:'production',PORTAL_AUTO_MIGRATE:'false'}),false);
for (const value of [undefined,'','true','False']) assert.throws(
  ()=>startupMigrations({NODE_ENV:'production',PORTAL_AUTO_MIGRATE:value}),
  /explicit no-auto-migration declaration/
);
assert.equal(startupMigrations({NODE_ENV:'test',PORTAL_AUTO_MIGRATE:'true'}),true);
const expectedMigrations=portalMigrationIds();
const poolWithLedger=ids=>({query:async()=>({rows:ids.map(id=>({id}))})});
assert.doesNotReject(()=>verifyPortalMigrations(poolWithLedger(expectedMigrations)));
for(const ids of [expectedMigrations.slice(0,-1),[...expectedMigrations,'9999_unknown.sql'],[...expectedMigrations].reverse(),expectedMigrations.map((id,index)=>index===0?'0001_changed.sql':id)])
 assert.rejects(()=>verifyPortalMigrations(poolWithLedger(ids)),/migration lineage/);
console.log('Production database target and TLS admission checks passed.');
