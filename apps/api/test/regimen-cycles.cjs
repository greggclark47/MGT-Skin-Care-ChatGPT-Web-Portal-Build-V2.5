const assert = require('node:assert/strict');
const { createPortal } = require('../dist/portal/server');
const { LocalStore } = require('../dist/portal/store');

(async () => {
  const store = new LocalStore(':memory:');
  const app = await createPortal({
    store,
    env: { NODE_ENV: 'test', DEMO_MODE: 'true', PUBLIC_ORIGIN: 'http://localhost:3000' },
    verifyOtp: async email => ({ id: 'regimen-account', email }),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cookie = '', csrf = '';
  async function call(path, method = 'GET', body) {
    const response = await fetch(origin + path, { method, headers: { origin: 'http://localhost:3000', cookie, 'content-type': 'application/json', 'x-csrf-token': csrf }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const data = await response.json();
    if (data.csrf) csrf = data.csrf;
    return { status: response.status, data };
  }
  try {
    assert.equal((await call('/api/hub/session')).status, 200);
    assert.equal((await call('/api/v1/regimen-cycles')).status, 401);
    assert.equal((await call('/api/hub/auth/verify', 'POST', { email: 'member@example.test', code: '123456' })).status, 200);
    await call('/api/hub/session');

    const created = await call('/api/v1/regimen-cycles', 'POST', { consent: 'regimen_cycle_tracking', focus: 'steady_routine', consent_version: 'regimen-cycle-1' });
    assert.equal(created.status, 201);
    assert.equal(created.data.data.cycle.cycle_days, 14);
    assert.equal(created.data.data.deterministic_guidance.routine_changes, 'never_automatic');
    assert.equal(created.data.data.ai_boundary.can_change_routine, false);
    assert.equal('actor' in created.data.data.cycle, false);
    assert.equal('consent_version' in created.data.data.cycle, false);
    assert.equal((await call('/api/v1/regimen-cycles', 'POST', { consent: 'regimen_cycle_tracking', focus: 'steady_routine', consent_version: 'regimen-cycle-1' })).status, 409);

    const id = created.data.data.cycle.id;
    assert.equal((await call(`/api/v1/regimen-cycles/${id}/check-ins`, 'POST', { status: 'comfortable', completed_at: 'not-a-date' })).status, 400);
    const checkIn = await call(`/api/v1/regimen-cycles/${id}/check-ins`, 'POST', { status: 'comfortable', completed_at: new Date().toISOString() });
    assert.equal(checkIn.status, 202);
    assert.equal('actor' in checkIn.data.data, false);
    const repeated = await call(`/api/v1/regimen-cycles/${id}/check-ins`, 'POST', { status: 'comfortable', completed_at: new Date().toISOString() });
    assert.equal(repeated.status, 202);
    assert.equal(repeated.data.data.id, checkIn.data.data.id);

    const listed = await call('/api/v1/regimen-cycles');
    assert.equal(listed.status, 200);
    assert.equal(listed.data.data.sync_scope, 'signed_in_account');
    assert.equal(listed.data.data.current.check_ins, 1);
    const summary = await call(`/api/v1/regimen-cycles/${id}/summary`);
    assert.equal(summary.status, 200);
    assert.equal(summary.data.data.comfortable, 1);
    assert.equal(summary.data.data.deterministic_guidance.next_step, 'keep_current_routine');
    const exported = await call('/api/v1/regimen-cycles/export');
    assert.equal(exported.status, 200);
    assert.equal(exported.data.data.cycles.length, 1);
    assert.equal(exported.data.data.check_ins.length, 1);
    assert.deepEqual(exported.data.data.manifest, { export_format: 'json', retention: 'user_controlled', deletion_supported: true, external_delivery: 'disabled', data_shared: [] });
    assert.equal(JSON.stringify(exported.data).includes('regimen-account'), false);
    assert.equal((await call('/api/v1/regimen-cycles', 'DELETE', { confirm: false })).status, 400);
    const removed = await call('/api/v1/regimen-cycles', 'DELETE', { confirm: true });
    assert.equal(removed.status, 200);
    assert.deepEqual(removed.data.data, { cycles: 1, check_ins: 1, consent_revoked: true, retention: 'user_controlled', data_shared: [] });
    assert.equal((await call('/api/v1/regimen-cycles')).data.data.items.length, 0);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await store.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
