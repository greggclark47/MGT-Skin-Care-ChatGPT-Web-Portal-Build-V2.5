const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');

const { createApp, isDirectRetailCheckoutAvailable } = require('../dist/server');
const { InMemoryOrderRepository, InMemoryWebhookEventRepository } = require('../dist/persistence/in-memory');

function request(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const address = server.address();
    const req = http.request({
      host: '127.0.0.1',
      port: address.port,
      method,
      path,
      headers: payload ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      } : {},
    }, (res) => {
      let response = '';
      res.on('data', (chunk) => { response += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: JSON.parse(response || '{}'),
      }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('direct retail checkout fails closed in a production process', async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  t.after(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  assert.equal(isDirectRetailCheckoutAvailable(), false);
  assert.equal(isDirectRetailCheckoutAvailable({ NODE_ENV: 'test' }), true);

  let paymentAttempts = 0;
  const app = createApp({
    orders: new InMemoryOrderRepository(),
    webhookEvents: new InMemoryWebhookEventRepository(),
    payments: {
      async createPaymentIntent() {
        paymentAttempts += 1;
        return { id: 'pi_should_not_exist', client_secret: 'secret_should_not_exist' };
      },
    },
  });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const cart = await request(server, 'POST', '/api/cart/from-routine', { session_id: 'ignored' });
  assert.equal(cart.status, 503);
  assert.equal(cart.headers['cache-control'], 'no-store');
  assert.equal(cart.body.error.code, 'retail_checkout_unavailable');

  const checkout = await request(server, 'POST', '/api/checkout/session', { session_id: 'ignored' });
  assert.equal(checkout.status, 503);
  assert.equal(checkout.body.error.code, 'retail_checkout_unavailable');
  assert.equal(paymentAttempts, 0);
});
