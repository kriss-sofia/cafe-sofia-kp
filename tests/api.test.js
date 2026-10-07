const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/app');

test('GET /api/products returns the coffee catalog', async () => {
  const response = await request(app).get('/api/products');

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.ok(response.body.length > 0);
  assert.equal(response.body[0].name, 'Espresso');
});

test('POST /api/orders creates an order with total', async () => {
  const response = await request(app)
    .post('/api/orders')
    .send({
      items: [
        { productId: 'espresso', quantity: 2 },
        { productId: 'latte', quantity: 1 }
      ]
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.id);
  assert.equal(typeof response.body.orderNumber, 'number');
  assert.equal(response.body.status, 'pendiente');
  assert.equal(response.body.total, 3100);
});

test('POST /api/orders notifies Apps Script with the order', async (t) => {
  const calls = [];
  process.env.APPS_SCRIPT_URL = 'https://script.google.com/macros/s/test/exec';
  t.mock.method(global, 'fetch', async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ ok: true, registrado: true }));
  });
  t.after(() => { delete process.env.APPS_SCRIPT_URL; });

  const response = await request(app)
    .post('/api/orders')
    .send({ items: [{ productId: 'capuchino', quantity: 2 }] });

  assert.equal(response.status, 201);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, process.env.APPS_SCRIPT_URL);
  assert.equal(calls[0].body.accion, 'registrar_venta');
  assert.equal(calls[0].body.pedido.id, response.body.id);
  assert.equal(calls[0].body.pedido.total, 4000);
  assert.deepEqual(calls[0].body.pedido.items[0], {
    productId: 'capuchino', name: 'Capuccino', quantity: 2, unitPrice: 2000, subtotal: 4000
  });
});

test('POST /api/orders still confirms the order if Apps Script fails', async (t) => {
  process.env.APPS_SCRIPT_URL = 'https://script.google.com/macros/s/test/exec';
  t.mock.method(global, 'fetch', async () => new Response(JSON.stringify({ ok: false, error: 'boom' })));
  t.mock.method(console, 'error', () => {});
  t.after(() => { delete process.env.APPS_SCRIPT_URL; });

  const response = await request(app)
    .post('/api/orders')
    .send({ items: [{ productId: 'espresso', quantity: 1 }] });

  assert.equal(response.status, 201);
  assert.equal(response.body.total, 800);
});

test('POST /api/orders rejects unknown products and invalid quantities', async () => {
  const unknown = await request(app).post('/api/orders').send({ items: [{ productId: 'mate', quantity: 1 }] });
  const negative = await request(app).post('/api/orders').send({ items: [{ productId: 'latte', quantity: -3 }] });

  assert.equal(unknown.status, 400);
  assert.equal(negative.status, 400);
});

test('GET /api/health returns service status', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.name, 'Café SofIA API');
});

test('GET /styles.css and /script.js serve the frontend assets', async () => {
  const cssResponse = await request(app).get('/styles.css');
  const jsResponse = await request(app).get('/script.js');

  assert.equal(cssResponse.status, 200);
  assert.match(cssResponse.headers['content-type'], /css/);

  assert.equal(jsResponse.status, 200);
  assert.match(jsResponse.headers['content-type'], /javascript|text\/javascript/);
});

test('GET /images/perezosa.jpg serves the hero photo', async () => {
  const response = await request(app).get('/images/perezosa.jpg');

  assert.equal(response.status, 200);
  assert.match(response.headers['content-type'], /image\/jpeg/);
});

test('frontend uses relative API URLs for every device', async () => {
  const response = await request(app).get('/script.js');

  assert.equal(response.status, 200);
  assert.doesNotMatch(response.text, /https?:\/\/localhost(?::\d+)?/);
  assert.match(response.text, /fetch\('\/api\/products'\)/);
  assert.match(response.text, /fetch\('\/api\/orders'/);
});

test('frontend displays the server-generated order number', async () => {
  const response = await request(app).get('/script.js');

  assert.equal(response.status, 200);
  assert.doesNotMatch(response.text, /orderCounter/);
  assert.match(response.text, /order\.orderNumber/);
});

test('POST /api/checkout creates a checkout session', async () => {
  const response = await request(app)
    .post('/api/checkout')
    .send({
      items: [
        { productId: 'espresso', quantity: 1 },
        { productId: 'latte', quantity: 2 }
      ]
    });

  assert.equal(response.status, 200);
  assert.ok(response.body.checkoutUrl || response.body.sessionId);
  assert.equal(response.body.amount, 3800);
});

test('POST /api/webhook/stripe accepts a completed checkout event', async () => {
  const response = await request(app)
    .post('/api/webhook/stripe')
    .set('Content-Type', 'application/json')
    .send({
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          amount_total: 3800,
          metadata: { orderId: 'order-123' }
        }
      }
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.received, true);
});

test('GET /api/admin/summary returns dashboard metrics', async () => {
  const response = await request(app).get('/api/admin/summary');

  assert.equal(response.status, 200);
  assert.ok(response.body.totalRevenue >= 0);
  assert.ok(response.body.totalOrders >= 0);
  assert.ok(Array.isArray(response.body.lowStock));
});

test('GET /api/orders returns the order list', async () => {
  const response = await request(app).get('/api/orders');

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body));
  assert.ok(response.body.length >= 1);
});

test('PATCH /api/orders/:id/status updates order state', async () => {
  const response = await request(app)
    .patch('/api/orders/order-101/status')
    .send({ status: 'confirmado' });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'confirmado');
  assert.equal(response.body.id, 'order-101');
});
