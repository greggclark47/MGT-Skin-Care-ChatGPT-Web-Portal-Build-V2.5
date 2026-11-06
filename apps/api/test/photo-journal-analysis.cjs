const assert = require('node:assert/strict');
const { test } = require('node:test');
const { AiGateway } = require('@mgt/ai-gateway');
const { validatePhotoJournalCosmeticSummary } = require('@mgt/domain');
const { createPortal } = require('../dist/portal/server');
const { LocalStore } = require('../dist/portal/store');

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);

class FixtureAdapter {
  constructor() { this.name = 'ollama'; this.calls = []; }
  async complete(config, _system, prompt, _signal, imageInputs) {
    this.calls.push({ config, prompt, imageInputs });
    assert.equal(config.model, 'llava:latest');
    assert.equal(imageInputs.length, 1);
    assert.deepEqual(imageInputs[0], { mime_type: 'image/jpeg', base64: jpeg.toString('base64') });
    const context = JSON.parse(prompt);
    assert.equal(context.selected_image_source, 'guided_face_camera');
    assert.deepEqual(context.active_factor_ids, ['anti_blemish', 'acne', 'dark_marks', 'dark_circles']);
    return {
      text: JSON.stringify({
        summary: 'Use this optional cosmetic journal note with your saved complexion priorities; it does not change your routine.',
        focus_ids: ['anti_blemish', 'acne', 'dark_marks', 'dark_circles'],
        observation_tags: ['surface_texture', 'blemish_appearance'],
        capture_feedback: 'ready_for_consistency',
      }),
      input_tokens: 40,
      output_tokens: 42,
      model: 'llava:latest',
      provider: 'ollama',
    };
  }
}

test('photo journal analysis is opt-in, local-only, profile-bounded, and does not retain image data', async () => {
  const db = new LocalStore(':memory:');
  const adapter = new FixtureAdapter();
  const app = await createPortal({
    store: db,
    analysisGateway: new AiGateway({ adapters: { ollama: adapter } }),
    env: {
      NODE_ENV: 'test', DEMO_MODE: 'true', PUBLIC_ORIGIN: 'http://localhost:3000',
      MGT_PHOTO_ANALYSIS_ENABLED: 'true', MGT_PHOTO_ANALYSIS_PRIVACY_REVIEWED: 'true',
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let cookie = '';
  let csrf = '';

  async function call(path, body, headers = {}) {
    const binary = Buffer.isBuffer(body);
    const response = await fetch(origin + '/api/hub' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        origin: 'http://localhost:3000',
        ...(cookie ? { cookie } : {}),
        ...(body === undefined ? {} : { 'x-csrf-token': csrf, ...(binary ? { 'content-type': 'application/octet-stream' } : { 'content-type': 'application/json' }) }),
        ...headers,
      },
      body: body === undefined ? undefined : binary ? body : JSON.stringify(body),
    });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const data = await response.json();
    if (data.csrf) csrf = data.csrf;
    return { status: response.status, data };
  }

  try {
    assert.equal((await call('/session')).status, 200);
    await db.tx(async records => {
      const user = { id: 'photo-user', email: 'photo@example.test', roles: [] };
      await records.put('accounts', user.id, user);
      for (const session of await records.entries('sessions')) await records.put('sessions', session.id, { ...session.value, userId: user.id });
    });
    const status = await call('/photo-analysis/status');
    assert.equal(status.status, 200);
    assert.equal(status.data.enabled, true);
    assert.equal(status.data.local_only, true);
    assert.equal(status.data.uses_face_recognition, false);

    const saved = await call('/profile', {
      consent: true, expected_revision: null, skin_type: 'combination', concerns: ['acne', 'hyperpigmentation', 'dark_circles'],
      sensitivity: 'moderate', age_band: '26_35', current_routine: 'basic', desired_outcome: 'even_tone', budget_range: 'between_25_50', ingredient_avoidances: ['fragrance'],
    });
    assert.equal(saved.status, 200);

    const missingConsent = await call('/photo-analysis', jpeg, { 'x-photo-analysis-source': 'guided_face_camera' });
    assert.equal(missingConsent.status, 400);
    assert.equal(missingConsent.data.error.code, 'photo_analysis_consent_required');
    assert.equal(adapter.calls.length, 0);

    const invalid = await call('/photo-analysis', Buffer.from('not-a-jpeg'), { 'x-photo-analysis-source': 'guided_face_camera', 'x-photo-analysis-consent': 'photo-journal-cosmetic-analysis-1' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.data.error.code, 'invalid_photo_analysis_image');

    const withoutDisclosure = await call('/photo-analysis', jpeg, { 'x-photo-analysis-source': 'guided_face_camera', 'x-photo-analysis-consent': 'photo-journal-cosmetic-analysis-1' });
    assert.equal(withoutDisclosure.status, 403);
    assert.equal(withoutDisclosure.data.error.code, 'consent_required');

    assert.equal((await call('/account/consents', { consent_type: 'ai_disclosure', granted: true })).status, 200);
    const result = await call('/photo-analysis', jpeg, { 'x-photo-analysis-source': 'guided_face_camera', 'x-photo-analysis-consent': 'photo-journal-cosmetic-analysis-1' });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.cosmetic_summary.observation_tags, ['surface_texture', 'blemish_appearance']);
    assert.equal(result.data.output_trace.task, 'photo_journal_cosmetic_summary');
    assert.equal(adapter.calls.length, 1);
    assert.match(result.data.limitations.join(' '), /not identity recognition/i);

    const stored = await db.tx(records => records.get('ai_output_events', result.data.output_trace.trace_id));
    const serialized = JSON.stringify(stored);
    assert.equal(serialized.includes(jpeg.toString('base64')), false);
    assert.equal(serialized.includes('guided_face_camera'), false);
    assert.equal(serialized.includes('surface_texture'), false);
    assert.equal(stored.result_kind, 'photo_journal_cosmetic_summary');

    const unsafe = validatePhotoJournalCosmeticSummary({
      ...result.data.cosmetic_summary,
      summary: 'This identifies your age and health condition.',
    }, result.data.complexion);
    assert.equal(unsafe.ok, false);
    assert.equal(unsafe.reason, 'safety:unsafe_photo_journal_summary');

    const feedback = await call('/profile/feedback', { feedback: 'comfortable', expected_revision: saved.data.revision });
    assert.equal(feedback.status, 200);
    const stale = await db.tx(records => records.get('ai_output_events', result.data.output_trace.trace_id));
    assert.equal(stale.stale, true);
    assert.deepEqual(stale.stale_reasons, ['profile_revision_changed']);
  } finally {
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
});
