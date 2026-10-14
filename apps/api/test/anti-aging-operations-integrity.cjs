const assert = require('node:assert/strict');
const { createPortal } = require('../dist/portal/server');
const { LocalStore } = require('../dist/portal/store');

(async () => {
  const store = new LocalStore(':memory:');
  const app = await createPortal({
    store,
    env: { NODE_ENV: 'test', DEMO_MODE: 'true', PUBLIC_ORIGIN: 'http://localhost:3000' },
    verifyOtp: async email => ({ id: 'integrity-viewer', email }),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cookie = '', csrf = '';
  async function call(path, method = 'GET', body) {
    const response = await fetch(origin + path, {
      method,
      headers: { origin: 'http://localhost:3000', cookie, 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const data = await response.json();
    if (data.csrf) csrf = data.csrf;
    return { status: response.status, data };
  }
  try {
    assert.equal((await call('/api/hub/session')).status, 200);
    assert.equal((await call('/api/hub/auth/verify', 'POST', { email: 'viewer@test.invalid', code: '123456' })).status, 200);
    await store.tx(async records => {
      const account = await records.get('accounts', 'integrity-viewer');
      await records.put('accounts', 'integrity-viewer', { ...account, roles: ['viewer'] });
    });
    const first = await call('/api/hub/admin/anti-aging-operations?review_limit=2&review_offset=0');
    assert.equal(first.status, 200);
    assert.equal(first.data.decision_packet.packet_version, 'anti-aging-decision-packet-4');
    assert.equal(first.data.decision_packet_integrity.valid, true);
    assert.equal(first.data.decision_packet_integrity.checks.review_session_binding, true);
    assert.equal(first.data.decision_packet_integrity.checks.review_plan_fingerprint, true);
    assert.equal(first.data.decision_packet_integrity.checks.packet_generated_at, true);
    assert.equal(first.data.decision_packet_integrity.checks.fingerprint_scope, true);
    assert.equal(first.data.decision_packet_integrity.checks.governance_note, true);
    assert.equal(first.data.decision_packet.fingerprint_scope.includes('note'), true);
    assert.equal(first.data.decision_packet_integrity.authorization, 'not_authorized');
    const next = await call('/api/hub/admin/anti-aging-operations?review_limit=2&review_offset=2');
    assert.equal(next.status, 200);
    assert.equal(next.data.decision_packet_integrity.valid, true);
    assert.notEqual(next.data.decision_packet.session_id, first.data.decision_packet.session_id);
    assert.notEqual(next.data.decision_packet.review_session_fingerprint, first.data.decision_packet.review_session_fingerprint);
    assert.notEqual(next.data.decision_packet.content_fingerprint, first.data.decision_packet.content_fingerprint);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await store.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
