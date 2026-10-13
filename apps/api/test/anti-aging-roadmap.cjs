const assert = require('node:assert/strict');
const { createPortal } = require('../dist/portal/server');
const { LocalStore } = require('../dist/portal/store');

(async () => {
  const app = await createPortal({ store: new LocalStore(':memory:'), env: { NODE_ENV: 'test', DEMO_MODE: 'true', PUBLIC_ORIGIN: 'http://localhost:3000' } });
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
    const progress = await call('/api/v1/progress', 'POST', { consent: 'progress_tracking', entry_id: 'routine-step-1', status: 'completed', completed_at: new Date().toISOString(), consent_version: 'progress-1' });
    assert.equal(progress.status, 202);
    const listed = await call('/api/v1/progress');
    assert.equal(listed.status, 200);
    assert.equal(listed.data.data.aggregate.completed, 1);
    const referral = await call('/api/v1/referrals/click', 'POST', { product_id: 'product-c-brightening-serum' });
    assert.equal(referral.status, 202);
    const appointment = await call('/api/v1/appointment-requests', 'POST', { provider_id: 'provider-example-dermatology', idempotency_key: 'appointment-001', consent: 'provider_handoff' });
    assert.equal(appointment.status, 202);
    assert.equal(appointment.data.data.booking_supported, false);
    assert.deepEqual(appointment.data.data.data_shared, []);
    const repeated = await call('/api/v1/appointment-requests', 'POST', { provider_id: 'provider-example-dermatology', idempotency_key: 'appointment-001', consent: 'provider_handoff' });
    assert.equal(repeated.data.data.id, appointment.data.data.id);
    const request = await call('/api/v1/appointment-requests/' + appointment.data.data.id);
    assert.equal(request.status, 200);
    const deleted = await call('/api/v1/progress', 'DELETE', { confirm: true });
    assert.equal(deleted.status, 200);
    assert.equal(deleted.data.data.deleted, 1);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
