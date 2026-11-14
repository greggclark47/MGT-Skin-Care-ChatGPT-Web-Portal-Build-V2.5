import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const usage = 'Usage: node infra/portal/stripe-subscription-readiness.mjs <review-config.json> [report.json]';
const requiredText = ['candidate', 'environment', 'portal_origin', 'webhook_url', 'stripe_product_id', 'premium_monthly_price_id', 'premium_annual_price_id', 'studio_monthly_price_id', 'studio_annual_price_id'];
const idPatterns = {
  stripe_product_id: /^prod_[A-Za-z0-9]+$/,
  premium_monthly_price_id: /^price_[A-Za-z0-9]+$/,
  premium_annual_price_id: /^price_[A-Za-z0-9]+$/,
  studio_monthly_price_id: /^price_[A-Za-z0-9]+$/,
  studio_annual_price_id: /^price_[A-Za-z0-9]+$/,
};

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`Unable to read review configuration: ${error instanceof Error ? error.message : 'invalid JSON'}`); }
}
function text(value) { return typeof value === 'string' ? value.trim() : ''; }
function placeholder(value) { return !value || /replace|placeholder|example|todo/i.test(value); }
function fingerprint(value) { return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12); }
function exactWebhook(origin, webhook) {
  try {
    const portal = new URL(origin);
    const destination = new URL(webhook);
    return portal.protocol === 'https:' && destination.protocol === 'https:' &&
      portal.origin === destination.origin && destination.pathname === '/webhooks/subscriptions' &&
      !destination.search && !destination.hash;
  } catch { return false; }
}

export function assessStripeSubscriptionReadiness(config) {
  const holds = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) return { ready: false, holds: ['Review configuration must be a JSON object.'] };
  if (config.schema_version !== 1) holds.push('schema_version must be 1.');
  for (const key of requiredText) if (placeholder(text(config[key]))) holds.push(`${key} must be a non-placeholder value.`);
  if (!['staging', 'production'].includes(config.environment)) holds.push('environment must be staging or production.');
  if (config.subscriptions_enabled !== true) holds.push('subscriptions_enabled must remain true only in a reviewed activation candidate.');
  if (typeof config.stripe_live_mode !== 'boolean') holds.push('stripe_live_mode must be an explicit boolean.');
  if (config.subscription_terms_approved !== true) holds.push('subscription_terms_approved must be true after terms review.');
  if (config.customer_portal?.payment_method_update !== true || config.customer_portal?.invoice_history !== true || config.customer_portal?.subscription_cancel !== true) {
    holds.push('customer_portal must enable payment-method updates, invoice history, and cancellation.');
  }
  if (config.customer_portal?.subscription_update !== false) holds.push('customer_portal.subscription_update must remain false; Team47 schedules plan changes server-side.');
  if (config.event_destination?.configured !== true || config.event_destination?.signature_verified !== true) holds.push('The signed Stripe event destination must be configured and signature-verified.');
  if (!exactWebhook(text(config.portal_origin), text(config.webhook_url))) holds.push('webhook_url must be the same HTTPS portal origin with the exact /webhooks/subscriptions path.');
  for (const [key, pattern] of Object.entries(idPatterns)) {
    const value = text(config[key]);
    if (value && !pattern.test(value)) holds.push(`${key} is not a valid Stripe object identifier.`);
  }
  const prices = ['premium_monthly_price_id', 'premium_annual_price_id', 'studio_monthly_price_id', 'studio_annual_price_id'].map(key => text(config[key])).filter(Boolean);
  if (new Set(prices).size !== 4) holds.push('Each Guided and Studio monthly/annual price must be distinct.');
  const expectedMode = config.environment === 'production';
  if (typeof config.stripe_live_mode === 'boolean' && config.stripe_live_mode !== expectedMode) holds.push(`${config.environment} must use ${expectedMode ? 'live' : 'test'} Stripe mode.`);
  if (config.stripe_live_mode === true && config.live_mode_reviewed !== true) holds.push('live_mode_reviewed must be true for a production candidate.');
  if (config.stripe_live_mode === false && config.sandbox_checkout_verified !== true) holds.push('sandbox_checkout_verified must be true for a staging candidate.');
  if (!config.secret_manager?.api_key_reference || !config.secret_manager?.webhook_secret_reference) holds.push('Secret Manager references for the Stripe API key and webhook signing secret are required.');
  if (Object.values(config.secret_manager || {}).some(value => typeof value !== 'string' || /^(?:sk|whsec)_/i.test(value))) holds.push('secret_manager values must be references only, never Stripe secret values.');
  if (!config.release_evidence?.account_management_verified || !config.release_evidence?.checkout_verified || !config.release_evidence?.webhook_verified || !config.release_evidence?.customer_portal_verified) {
    holds.push('Release evidence must verify account management, Checkout, webhook reconciliation, and customer portal behavior.');
  }
  const ids = Object.fromEntries(Object.entries(idPatterns).map(([key]) => [key, text(config[key]) ? fingerprint(text(config[key])) : null]));
  return { ready: holds.length === 0, holds, posture: { environment: config.environment || null, stripe_live_mode: config.stripe_live_mode ?? null, ids, webhook_path: text(config.webhook_url) ? '/webhooks/subscriptions' : null } };
}

function main(argv) {
  const [input, output] = argv;
  if (!input) throw new Error(usage);
  const report = { generated_at: new Date().toISOString(), input: path.basename(input), ...assessStripeSubscriptionReadiness(readJson(input)) };
  const rendered = JSON.stringify(report, null, 2) + '\n';
  if (output) fs.writeFileSync(output, rendered, { encoding: 'utf8', flag: 'wx' });
  else process.stdout.write(rendered);
  process.exitCode = report.ready ? 0 : 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error instanceof Error ? error.message : usage); process.exitCode = 2; }
}
