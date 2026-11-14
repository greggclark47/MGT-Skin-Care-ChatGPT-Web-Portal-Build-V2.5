# OAuth lifecycle evidence — v4.378

The Supabase Google identity boundary now has focused local regression coverage for the complete callback lifecycle that can be verified without live credentials.

## Verified

- OAuth remains opt-in and requires an exact HTTPS Supabase origin plus an anon key.
- Authorization uses scoped PKCE and does not request Google Drive scopes.
- Invalid callback state is rejected before provider exchange.
- Expired flow records are rejected and do not create an account session.
- A successful flow cannot be replayed because the state record is consumed.
- Provider errors return a neutral failure redirect without exposing upstream details.
- Provider access and refresh tokens are not persisted.
- Existing profile merge behavior remains covered by the account lifecycle suite.

The expanded OAuth test file passes all 3 tests after an API build. This is repository evidence only; production still requires staging callback/redirect verification, token expiry and replay rehearsal against the configured Supabase project, approved account-link decisions, and live identity-owner signoff.
