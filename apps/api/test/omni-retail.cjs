const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createPortal } = require('../dist/portal/server');
const { LocalStore } = require('../dist/portal/store');

test('omni-retail keeps merchant checkout external and limits reporting to authorized aggregate volume', async () => {
  const db = new LocalStore(':memory:');
  const app = await createPortal({
    store: db,
    env: {
      NODE_ENV: 'test',
      DEMO_MODE: 'true',
      PUBLIC_ORIGIN: 'http://localhost:3000',
      MGT_OMNI_RETAIL_ENABLED: 'true',
      MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED: 'true',
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let cookie = '';
  let csrf = '';

  async function call(path, body) {
    const response = await fetch(origin + '/api/hub' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        origin: 'http://localhost:3000',
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { 'x-csrf-token': csrf, 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const data = await response.json();
    if (data.csrf) csrf = data.csrf;
    return { status: response.status, data };
  }

  const merchantReport = {
    retailer_id: 'olive-young',
    batch_reference: 'merchant-batch-20261103',
    period_start: '2026-11-01',
    period_end: '2026-11-02',
    attributed_orders: 12,
    attributed_units: 18,
    routine_slot_units: [{ slot: 'cleanser', units: 6 }, { slot: 'moisturizer', units: 7 }],
  };

  try {
    assert.equal((await call('/session')).status, 200);
    await db.tx(async records => {
      const user = { id: 'retail-operator', email: 'retail@example.test', roles: ['superadmin', 'compliance'] };
      await records.put('accounts', user.id, user);
      for (const session of await records.entries('sessions')) {
        await records.put('sessions', session.id, { ...session.value, userId: user.id });
      }
    });

    const commerce = await call('/retail/commerce');
    assert.equal(commerce.status, 200);
    assert.equal(commerce.data.commerce.omni_retail.enabled, true);
    assert.equal(commerce.data.commerce.customer_purchase_tracking, false);
    assert.match(commerce.data.placement_policy, /external merchant/i);

    const partner = await call('/admin/retail/partner', {
      retailer_id: 'olive-young',
      status: 'approved',
      placement_mode: 'preferred_partner',
      authorization_reference: 'merchant-auth-20261103',
    });
    assert.equal(partner.status, 200);
    assert.equal(partner.data.partner.placement_mode, 'preferred_partner');
    assert.equal(partner.data.partner.authorization_recorded, true);
    assert.equal(JSON.stringify(partner.data).includes('merchant-auth-20261103'), false);

    const listings = await call('/retailers');
    const oliveYoung = listings.data.retailers.find(item => item.id === 'olive-young');
    assert.equal(oliveYoung.relationship, 'approved_partner');
    assert.equal(oliveYoung.placement_label, 'Preferred partner');

    const outbound = await call('/retailers/outbound', { id: 'olive-young', segment: 'skincare', channel: 'android' });
    assert.equal(outbound.status, 200);
    assert.match(outbound.data.destination, /^https:\/\//);
    assert.equal(outbound.data.checkout, 'external_vendor');
    assert.equal(outbound.data.relationship, 'approved_partner');
    assert.match(outbound.data.privacy_note, /does not record a customer purchase/i);

    const saved = await call('/admin/retail/conversion-report', merchantReport);
    assert.equal(saved.status, 200);
    assert.equal(saved.data.saved, true);
    assert.equal(saved.data.summary.attributed_orders, 12);
    assert.equal(saved.data.summary.attributed_units, 18);
    assert.deepEqual(saved.data.summary.routine_slot_volume, [{ slot: 'cleanser', units: 6 }, { slot: 'moisturizer', units: 7 }]);

    const duplicate = await call('/admin/retail/conversion-report', merchantReport);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicate.data.duplicate, true);

    const replacedAuthorization = await call('/admin/retail/partner', {
      retailer_id: 'olive-young',
      status: 'approved',
      placement_mode: 'preferred_partner',
      authorization_reference: 'merchant-auth-20261104',
    });
    assert.equal(replacedAuthorization.status, 200);
    const staleDuplicate = await call('/admin/retail/conversion-report', merchantReport);
    assert.equal(staleDuplicate.status, 409);
    assert.equal(staleDuplicate.data.error.code, 'retail_conversion_conflict');
    const reauthorizedReport = await call('/admin/retail/conversion-report', { ...merchantReport, batch_reference: 'merchant-batch-20261104' });
    assert.equal(reauthorizedReport.status, 200);
    assert.equal(reauthorizedReport.data.saved, true);

    const withCustomerData = await call('/admin/retail/conversion-report', { ...merchantReport, batch_reference: 'merchant-batch-20261104', customer_id: 'must-not-be-accepted' });
    assert.equal(withCustomerData.status, 400);
    assert.equal(withCustomerData.data.error.code, 'invalid_retail_conversion_report');

    const invalidChannel = await call('/retailers/outbound', { id: 'olive-young', segment: 'skincare', channel: 'email' });
    assert.equal(invalidChannel.status, 400);
    assert.equal(invalidChannel.data.error.code, 'invalid_retail_channel');

    const operations = await call('/admin/retail/operations');
    assert.equal(operations.status, 200);
    assert.equal(operations.data.conversion_volume.reports, 2);
    assert.equal(operations.data.conversion_volume.attributed_units, 36);
    assert.match(operations.data.merchant_data_boundary, /No customer identities/i);
    assert.equal(JSON.stringify(operations.data).includes('merchant-auth-20261103'), false);
    assert.equal(JSON.stringify(operations.data).includes('merchant-auth-20261104'), false);
    assert.equal(JSON.stringify(operations.data).includes('retail@example.test'), false);
  } finally {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
});
