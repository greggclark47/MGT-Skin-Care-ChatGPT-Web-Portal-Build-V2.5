const assert = require('node:assert/strict');
const { createPortal } = require('../dist/portal/server');
const { LocalStore } = require('../dist/portal/store');
const { OperationalWorker, InAppNotificationDelivery } = require('../dist/portal/operations');

(async () => {
  const store = new LocalStore(':memory:');
  const app = await createPortal({ store, env: { NODE_ENV: 'test', DEMO_MODE: 'true', PUBLIC_ORIGIN: 'http://localhost:3000' } });
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
    const reminder = await call('/api/v1/progress/reminders', 'POST', { consent: 'reminders', entry_id: 'anti-aging-check-in', cadence: 'weekly', days_from_now: 7, consent_version: 'reminders-1' });
    assert.equal(reminder.status, 202);
    const reminders = await call('/api/v1/progress/reminders');
    assert.equal(reminders.data.data.reminders.length, 1);
    assert.equal((await call('/api/v1/progress/reminders/' + reminder.data.data.id, 'POST', { action: 'pause' })).data.data.paused, true);
    assert.equal((await call('/api/v1/progress/reminders/' + reminder.data.data.id, 'POST', { action: 'resume' })).data.data.paused, false);
    await store.tx(async records => { const saved = await records.get('anti_aging_reminders', reminder.data.data.id); await records.put('anti_aging_reminders', saved.id, { ...saved, next_at: new Date(Date.now() - 1000).toISOString() }); });
    const worker = new OperationalWorker(store, { delivery: new InAppNotificationDelivery(), env: { NODE_ENV: 'test', OPERATIONS_ALERT_DELIVERY: 'disabled' } });
    const workerResult = await worker.runOnce(Date.now());
    assert.equal(workerResult.created >= 1, true);
    assert.equal((await store.tx(records => records.list('notifications'))).some(item => item.kind === 'anti_aging_progress_reminder'), true);
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
    assert.equal((await call('/api/v1/progress/reminders')).data.data.reminders.length, 0);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
