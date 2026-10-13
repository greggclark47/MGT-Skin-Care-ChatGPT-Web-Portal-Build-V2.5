const assert = require('node:assert/strict');
const { createPortal } = require('../dist/portal/server');
const { LocalStore } = require('../dist/portal/store');

(async () => {
  const app = await createPortal({
    store: new LocalStore(':memory:'),
    env: { NODE_ENV: 'test', DEMO_MODE: 'true', PUBLIC_ORIGIN: 'http://localhost:3000' },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  async function get(path, options = {}) {
    const response = await fetch(origin + path, {
      method: options.method || 'GET',
      headers: { origin: 'http://localhost:3000', ...(cookie ? { cookie } : {}) },
    });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, data: await response.json() };
  }
  try {
    const ingredients = await get('/api/v1/ingredients?category=antioxidant');
    assert.equal(ingredients.status, 200);
    assert.equal(ingredients.data.meta.mode, 'read_only_referral');
    assert.equal(ingredients.data.data.items.length, 1);
    assert.equal(ingredients.data.data.items[0].category, 'antioxidant');
    assert.equal(ingredients.data.data.items[0].provenance.reviewed_status, 'approved');
    assert.equal(ingredients.data.data.items[0].provenance.source_url.startsWith('https://'), true);

    const compatibility = await get('/api/v1/ingredients/ingredient-retinol/compatibility');
    assert.equal(compatibility.status, 200);
    assert.equal(compatibility.data.data.status, 'general_education_only');
    assert.equal(compatibility.data.data.professional_assessment_required, false);

    const explanation = await get('/api/v1/explanations/ingredients/ingredient-vitamin-c');
    assert.equal(explanation.status, 200);
    assert.equal(explanation.data.data.task, 'anti_aging_explanation');
    assert.equal(explanation.data.data.citations[0].review_status, 'approved');
    assert.equal(explanation.data.data.citations[0].source_id, 'ingredient-vitamin-c');
    const search = await get('/api/v1/search?q=vitamin%20c');
    assert.equal(search.status, 200);
    assert.equal(search.data.data.results[0].record_id, 'ingredient-vitamin-c');
    const blockedSearch = await get('/api/v1/search?q=diagnose%20my%20rash');
    assert.equal(blockedSearch.status, 422);
    assert.equal(blockedSearch.data.error.code, 'question_out_of_scope');

    const onboarding = await get('/api/v1/onboarding/preview?goals=texture& sensitivity=mild'.replace(' ', ''));
    assert.equal(onboarding.status, 200);
    assert.equal(onboarding.data.data.status, 'consent_required');
    const personalized = await get('/api/v1/onboarding/preview?goals=texture,brightening&sensitivity=mild&consent=personalization');
    assert.equal(personalized.status, 200);
    assert.equal(personalized.data.data.status, 'ready');

    const products = await get('/api/v1/products?ingredient=ingredient-vitamin-c&limit=1');
    assert.equal(products.status, 200);
    assert.equal(products.data.data.items.length, 1);
    assert.equal(products.data.data.items[0].sample_only, true);
    assert.equal(products.data.data.items[0].commercial_label, 'none');

    const compare = await get('/api/v1/products/compare?ids=product-c-brightening-serum,product-night-renewal-serum');
    assert.equal(compare.status, 200);
    assert.equal(compare.data.data.items.length, 2);
    assert.equal(compare.data.data.comparison_scope, 'educational_metadata_only');

    const routinePreview = await get('/api/v1/routines/preview?product_ids=product-c-brightening-serum,product-night-renewal-serum&avoid_ingredient_ids=ingredient-retinol&sensitivity=mild');
    assert.equal(routinePreview.status, 200);
    assert.equal(routinePreview.data.data.status, 'preview_only');
    assert.deepEqual(routinePreview.data.data.excluded_product_ids, ['product-night-renewal-serum']);
    assert.equal(routinePreview.data.data.confirmation_required, true);

    const treatment = await get('/api/v1/treatments/treatment-dermatology-consultation');
    assert.equal(treatment.status, 200);
    assert.equal(treatment.data.data.professional_assessment_required, true);

    const provider = await get('/api/v1/providers?city=New%20York');
    assert.equal(provider.status, 200);
    assert.equal(provider.data.data.items[0].independent_provider, true);
    assert.equal(provider.data.data.items[0].website_url.startsWith('https://'), true);
    const handoff = await get('/api/v1/providers/provider-example-dermatology/handoff');
    assert.equal(handoff.status, 200);
    assert.deepEqual(handoff.data.data.data_shared, []);
    assert.equal(handoff.data.data.booking_supported, false);

    const malformed = await get('/api/v1/products?limit=51');
    assert.equal(malformed.status, 400);
    assert.equal(malformed.data.error.code, 'invalid_query');
    const unknown = await get('/api/v1/providers/provider-missing');
    assert.equal(unknown.status, 404);
    assert.equal(unknown.data.error.code, 'not_found');
    const writeAttempt = await get('/api/v1/products', { method: 'POST' });
    assert.equal(writeAttempt.status, 403);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
