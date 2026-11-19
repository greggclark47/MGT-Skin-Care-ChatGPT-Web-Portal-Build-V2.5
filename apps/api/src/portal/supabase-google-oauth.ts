import { createHash } from 'node:crypto';

export type SupabaseOAuthIdentity = { id: string; email: string };
type SupabaseTokenResponse = { user?: { id?: unknown; email?: unknown }; session?: { user?: { id?: unknown; email?: unknown } } };

const GOOGLE_IDENTITY_SCOPES = 'openid email profile';

function configuredText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
}

function supabaseOrigin(env: NodeJS.ProcessEnv): URL | undefined {
  if (!configuredText(env.SUPABASE_URL)) return undefined;
  try {
    const value = new URL(env.SUPABASE_URL);
    return value.protocol === 'https:' && value.pathname === '/' && !value.username && !value.password && !value.search && !value.hash ? value : undefined;
  } catch { return undefined; }
}

export function supabaseGoogleOAuthEnabled(env: NodeJS.ProcessEnv): boolean {
  return env.SUPABASE_GOOGLE_OAUTH_ENABLED === 'true' && !!supabaseOrigin(env) && configuredText(env.SUPABASE_ANON_KEY);
}

export function createSupabaseGoogleAuthorizeUrl(env: NodeJS.ProcessEnv, callbackUrl: string, state: string, codeVerifier: string): string {
  const origin = supabaseOrigin(env);
  if (!supabaseGoogleOAuthEnabled(env) || !origin || !/^[a-f0-9]{64}$/i.test(state) || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) throw new Error('Supabase Google OAuth is not configured.');
  const callback = new URL(callbackUrl);
  if (!['https:', 'http:'].includes(callback.protocol) || callback.username || callback.password || callback.hash) throw new Error('Supabase Google OAuth callback is invalid.');
  const authorize = new URL('/auth/v1/authorize', origin);
  authorize.search = new URLSearchParams({
    provider: 'google',
    redirect_to: callback.toString(),
    scopes: GOOGLE_IDENTITY_SCOPES,
    state,
    code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString();
  return authorize.toString();
}

export async function exchangeSupabaseGoogleCode(env: NodeJS.ProcessEnv, authCode: string, codeVerifier: string): Promise<SupabaseOAuthIdentity> {
  const origin = supabaseOrigin(env);
  if (!supabaseGoogleOAuthEnabled(env) || !origin || typeof authCode !== 'string' || authCode.length < 8 || authCode.length > 2048 || !/^[A-Za-z0-9._~-]+$/.test(authCode) || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier)) throw new Error('Supabase Google OAuth callback is invalid.');
  const endpoint = new URL('/auth/v1/token?grant_type=pkce', origin);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({ auth_code: authCode, code_verifier: codeVerifier }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('Supabase Google OAuth callback is invalid.');
  const result = await response.json() as SupabaseTokenResponse;
  const user = result.user || result.session?.user;
  if (!user || typeof user.id !== 'string' || user.id.length < 1 || user.id.length > 128 || typeof user.email !== 'string' || user.email.length < 3 || user.email.length > 254) throw new Error('Supabase Google OAuth callback is invalid.');
  return { id: user.id, email: user.email.toLowerCase() };
}
