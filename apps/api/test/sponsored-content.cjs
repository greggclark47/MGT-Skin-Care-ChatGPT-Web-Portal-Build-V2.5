const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createPortal } = require('../dist/portal/server');
const { LocalStore } = require('../dist/portal/store');
const { sponsoredContentStatus } = require('../dist/portal/sponsored-content');
const { parseRetailPartner } = require('../dist/portal/omni-retail');

test('sponsored content remains inactive until both the feature and review flags are set', () => {
  assert.equal(sponsoredContentStatus({}).enabled, false);
  assert.equal(sponsoredContentStatus({ MGT_SPONSORED_CONTENT_ENABLED: 'true' }).enabled, false);
  assert.equal(sponsoredContentStatus({ MGT_SPONSORED_CONTENT_ENABLED: 'true', MGT_SPONSORED_CONTENT_REVIEWED: 'true' }).enabled, true);
  assert.equal(sponsoredContentStatus({}).external_ad_networks, false);
  assert.equal(sponsoredContentStatus({}).advertiser_billing, false);
  assert.equal(parseRetailPartner({ retailer_id: 'olive-young', status: 'approved', placement_mode: 'sponsored', authorization_reference: 'merchant-auth-20261103', created_at: '2026-11-03T00:00:00.000Z', updated_at: '2026-11-03T00:00:00.000Z', reviewed_at: '2026-11-03T00:00:00.000Z', reviewed_by: 'operator', unexpected_private_field: 'must-be-rejected' }), null);
});

test('free-plan sponsorship is review-gated, nonpersonal, and limited to aggregate outbound counts', async () => {
  const db = new LocalStore(':memory:');
  const app = await createPortal({
    store: db,
    env: {
      NODE_ENV: 'test', DEMO_MODE: 'true', PUBLIC_ORIGIN: 'http://localhost:3000',
      MGT_OMNI_RETAIL_ENABLED: 'true', MGT_RETAIL_PARTNER_AUTHORIZATION_REVIEWED: 'true',
      MGT_SPONSORED_CONTENT_ENABLED: 'true', MGT_SPONSORED_CONTENT_REVIEWED: 'true',
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let cookie = '', csrf = '';

  async function call(path, body) {
    const response = await fetch(origin + '/api/hub' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { origin: 'http://localhost:3000', ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'x-csrf-token': csrf, 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const data = await response.json();
    if (data.csrf) csrf = data.csrf;
    return { status: response.status, data };
  }

  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);
  const campaign = {
    retailer_id: 'olive-young', status: 'approved', placement: 'free_plan_membership', category: 'retail_product', campaign_reference: 'sponsor-campaign-20261103',
    headline: 'Explore the OLIVE YOUNG beauty edit', body: 'Discover merchant-provided beauty products through the external store.', cta: 'Visit OLIVE YOUNG',
    destination_url: 'https://global.oliveyoung.com/', start_date: today, end_date: end,
  };

  try {
    assert.equal((await call('/session')).status, 200);
    await db.tx(async records => {
      const user = { id: 'sponsor-operator', email: 'sponsor@example.test', roles: ['superadmin', 'compliance'] };
      await records.put('accounts', user.id, user);
      for (const session of await records.entries('sessions')) await records.put('sessions', session.id, { ...session.value, userId: user.id });
    });

    const initial = await call('/sponsored-content?placement=free_plan_membership');
    assert.equal(initial.status, 200);
    assert.equal(initial.data.sponsored_content.enabled, true);
    assert.equal(initial.data.plan_eligible, true);
    assert.equal(initial.data.placement, null);
    assert.match(initial.data.data_boundary, /never uses an account profile/i);

    const partner = await call('/admin/retail/partner', { retailer_id: 'olive-young', status: 'approved', placement_mode: 'sponsored', authorization_reference: 'merchant-auth-20261103' });
    assert.equal(partner.status, 200);

    const saved = await call('/admin/sponsored-content/campaign', campaign);
    assert.equal(saved.status, 200);
    assert.equal(saved.data.campaign.status, 'approved');
    assert.equal(saved.data.campaign.disclosure.startsWith('Sponsored'), true);
    assert.equal(JSON.stringify(saved.data).includes('sponsor-campaign-20261103'), false);
    assert.equal(JSON.stringify(saved.data).includes('sponsor@example.test'), false);

    const placement = await call('/sponsored-content?placement=free_plan_membership');
    assert.equal(placement.status, 200);
    assert.equal(placement.data.placement.retailer_id, 'olive-young');
    assert.equal(placement.data.placement.placement, 'free_plan_membership');

    const outbound = await call('/sponsored-content/outbound', { campaign_id: placement.data.placement.id });
    assert.equal(outbound.status, 200);
    assert.equal(outbound.data.checkout, 'external_vendor');
    assert.match(outbound.data.privacy_note, /No profile, individual click history, purchase, payment/i);

    const replacedAuthorization = await call('/admin/retail/partner', { retailer_id: 'olive-young', status: 'approved', placement_mode: 'sponsored', authorization_reference: 'merchant-auth-20261104' });
    assert.equal(replacedAuthorization.status, 200);
    assert.equal((await call('/sponsored-content?placement=free_plan_membership')).data.placement, null);
    assert.equal((await call('/sponsored-content/outbound', { campaign_id: placement.data.placement.id })).status, 404);

    const reReviewed = await call('/admin/sponsored-content/campaign', campaign);
    assert.equal(reReviewed.status, 200);
    assert.equal(JSON.stringify(reReviewed.data).includes('merchant-auth-20261104'), false);
    assert.equal((await call('/sponsored-content?placement=free_plan_membership')).data.placement.retailer_id, 'olive-young');

    const withdrawn = await call('/admin/retail/partner', { retailer_id: 'olive-young', status: 'paused', placement_mode: 'independent', authorization_reference: null });
    assert.equal(withdrawn.status, 200);
    assert.equal((await call('/sponsored-content?placement=free_plan_membership')).data.placement, null);
    assert.equal((await call('/sponsored-content/outbound', { campaign_id: placement.data.placement.id })).status, 404);

    const invalid = await call('/admin/sponsored-content/campaign', { ...campaign, campaign_reference: 'sponsor-campaign-20261104', profile_id: 'must-not-be-accepted' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.data.error.code, 'invalid_sponsored_campaign');

    const operations = await call('/admin/sponsored-content/operations');
    assert.equal(operations.status, 200);
    assert.equal(operations.data.campaigns.length, 1);
    assert.equal(operations.data.campaigns[0].authorization_current, false);
    assert.equal(operations.data.campaigns[0].eligible_for_display, false);
    assert.equal(operations.data.intelligence.active_campaign_count, 0);
    assert.equal(operations.data.intelligence.campaign_count, 0);
    assert.equal(operations.data.intelligence.aggregate_outbound_events, 1);
    assert.equal(operations.data.intelligence.intelligence_mode, 'explainable_nonpersonal_rules');
    assert.equal(operations.data.intelligence.prohibited_inputs.includes('account profile'), true);
    assert.equal(operations.data.intelligence.never_actions.includes('personalize a campaign'), true);
    assert.equal(JSON.stringify(operations.data).includes('sponsor@example.test'), false);
    assert.equal(JSON.stringify(operations.data).includes('merchant-auth-20261103'), false);
    assert.equal(JSON.stringify(operations.data).includes('merchant-auth-20261104'), false);
  } finally {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
});
