const assert = require('node:assert/strict');
const { PgStore, validateProductionDatabaseUrl } = require('../dist/portal/store');

const production = { NODE_ENV: 'production' };
const baseline = new URL('postgresql://db.internal/mgt');
baseline.searchParams.set('sslmode', 'verify-full');
assert.doesNotThrow(() => validateProductionDatabaseUrl(baseline.toString(), production));

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
console.log('Production database target and TLS admission checks passed.');
