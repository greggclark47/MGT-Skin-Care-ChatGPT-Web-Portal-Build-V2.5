const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LocalStore } = require('../dist/portal/store');
const { createPortal } = require('../dist/portal/server');
const { createSupabaseGoogleAuthorizeUrl, supabaseGoogleOAuthEnabled } = require('../dist/portal/supabase-google-oauth');

const env = { NODE_ENV: 'test', DEMO_MODE: 'true', PUBLIC_ORIGIN: 'http://portal.test', SUPABASE_URL: 'https://identity.test', SUPABASE_ANON_KEY: 'anon-test-key', SUPABASE_GOOGLE_OAUTH_ENABLED: 'true' };

test('Supabase Google OAuth is opt-in and starts a scoped PKCE authorization request', () => {
  assert.equal(supabaseGoogleOAuthEnabled(env), true);
  assert.equal(supabaseGoogleOAuthEnabled({ ...env, SUPABASE_GOOGLE_OAUTH_ENABLED: 'false' }), false);
  assert.equal(supabaseGoogleOAuthEnabled({ ...env, SUPABASE_URL: 'http://identity.test' }), false);
  assert.equal(supabaseGoogleOAuthEnabled({ ...env, SUPABASE_URL: 'https://identity.test/auth' }), false);
  const state = 'a'.repeat(64), verifier = 'b'.repeat(64);
  const target = new URL(createSupabaseGoogleAuthorizeUrl(env, 'http://portal.test/api/hub/auth/google/callback', state, verifier));
  assert.equal(target.origin, 'https://identity.test');
  assert.equal(target.pathname, '/auth/v1/authorize');
  assert.equal(target.searchParams.get('provider'), 'google');
  assert.equal(target.searchParams.get('redirect_to'), 'http://portal.test/api/hub/auth/google/callback');
  assert.equal(target.searchParams.get('scopes'), 'openid email profile');
  assert.equal(target.searchParams.get('state'), state);
  assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
  assert.match(target.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(target.searchParams.has('https://www.googleapis.com/auth/drive.file'), false);
});

test('Google OAuth callback exchanges PKCE code server-side and never retains provider tokens', async t => {
  const db = new LocalStore(':memory:');
  const app = await createPortal({ store: db, env });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await db.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api/hub`;
  let cookie = '';
  const request = async (path, init = {}) => {
    const response = await fetch(base + path, { ...init, headers: { cookie, ...(init.headers || {}) }, redirect: 'manual' });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  };
  const session = await request('/session');
  assert.equal(session.status, 200);
  const start = await request('/auth/google');
  assert.equal(start.status, 302);
  const state = new URL(start.headers.get('location')).searchParams.get('state');
  assert.match(state, /^[a-f0-9]{64}$/);
  const originalFetch = global.fetch;
  let exchangeBody = null;
  global.fetch = async (url, init) => {
    if (String(url) === 'https://identity.test/auth/v1/token?grant_type=pkce') {
      exchangeBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ user: { id: 'google-user', email: 'person@example.test' }, session: { provider_token: 'must-not-persist', provider_refresh_token: 'must-not-persist' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return originalFetch(url, init);
  };
  try {
    const callback = await request(`/auth/google/callback?state=${state}&code=oauth-code-12345678`);
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get('location'), 'http://portal.test/account?oauth=connected');
  } finally { global.fetch = originalFetch; }
  assert.match(exchangeBody.auth_code, /^oauth-code-/);
  assert.match(exchangeBody.code_verifier, /^[a-f0-9]{64}$/);
  const current = await request('/session');
  const currentBody = await current.json();
  assert.equal(currentBody.account.email, 'person@example.test');
  const persisted = await db.tx(async records => JSON.stringify([await records.list('accounts'), await records.list('sessions'), await records.list('supabase_google_oauth_flows')]));
  assert.equal(persisted.includes('must-not-persist'), false);
  assert.equal(persisted.includes('oauth-code-12345678'), false);
});
