const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy');
const orderStore = require('./order-store');
const appsScript = require('./apps-script');

const app = express();
const rootDir = path.join(__dirname, '..');
const stylesPath = path.join(rootDir, 'styles.css');
const scriptPath = path.join(rootDir, 'script.js');
const slothImagePath = path.join(rootDir, 'images', 'perezosa.jpg');

app.use(cors());
app.use('/api/webhook/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.static(rootDir, { index: false }));

app.get('/styles.css', (req, res) => {
  res.sendFile(stylesPath);
});

app.get('/script.js', (req, res) => {
  res.sendFile(scriptPath);
});

app.get('/images/perezosa.jpg', (req, res) => {
  res.sendFile(slothImagePath);
});

const products = [
  { id: 'espresso', name: 'Espresso', price: 800, description: 'Corto, intenso y directo.', category: 'espresso', stock: 40 },
  { id: 'latte', name: 'Latte', price: 1500, description: 'Suave y cremoso con espuma sedosa.', category: 'latte', stock: 25 },
  { id: 'capuchino', name: 'Capuccino', price: 2000, description: 'Clásico con espuma y canela.', category: 'capuchino', stock: 20 }
];

const orders = [
  {
    id: 'order-101',
    orderNumber: 101,
    status: 'pendiente',
    total: 3100,
    items: [
      { productId: 'espresso', name: 'Espresso', quantity: 1, unitPrice: 800, subtotal: 800 },
      { productId: 'latte', name: 'Latte', quantity: 1, unitPrice: 1500, subtotal: 1500 },
      { productId: 'capuchino', name: 'Capuccino', quantity: 1, unitPrice: 2000, subtotal: 2000 }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'order-102',
    orderNumber: 102,
    status: 'pagado',
    total: 1500,
    items: [
      { productId: 'latte', name: 'Latte', quantity: 1, unitPrice: 1500, subtotal: 1500 }
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString()
  }
];
let nextLocalOrderNumber = 103;

// Datos para cobrar por SIMPE Móvil. No son secretos: el cliente los necesita
// ver para transferir, igual que un alias de cuenta.
const SIMPE = {
  method: 'simpe',
  phone: '8981-6070',
  holder: 'Kriss Pacheco'
};

// Instrucciones de pago que ve el cliente en su ticket.
function simpePaymentFor(order) {
  return {
    ...SIMPE,
    amount: order.total,
    reference: `Orden ${order.orderNumber}`
  };
}

function getOrderItems(items) {
  return items.map(({ productId, quantity }) => {
    const product = products.find((p) => p.id === productId);

    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    const normalizedQuantity = Number(quantity || 0);

    if (!Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0) {
      throw new Error(`Invalid quantity for ${productId}`);
    }

    return {
      productId,
      name: product.name,
      quantity: normalizedQuantity,
      unitPrice: product.price,
      subtotal: product.price * normalizedQuantity
    };
  });
}

app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(rootDir, 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(rootDir, 'admin.html'));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', name: 'Café SofIA API' });
});

app.get('/api/products', (req, res) => {
  res.json(products);
});

app.post('/api/orders', async (req, res) => {
  const { items = [] } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items are required' });
  }

  let orderItems;
  try {
    orderItems = getOrderItems(items);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

  const order = {
    id: `order-${crypto.randomUUID()}`,
    orderNumber: null,
    status: 'pendiente',
    paymentMethod: SIMPE.method,
    total,
    items: orderItems,
    createdAt: new Date().toISOString()
  };

  // El pedido queda PENDIENTE en Apps Script hasta que un administrador
  // confirme la transferencia: todavía no descuenta stock ni suma a la caja.
  // La cocina asigna el número de orden (único y correlativo). Si no lo
  // anota, el cliente no recibe los datos para pagar: nadie debe transferir
  // por un pedido que no quedó registrado.
  if (appsScript.isConfigured()) {
    try {
      const pending = await appsScript.registerPendingTransfer(order);
      if (!pending.numero) throw new Error('Apps Script no devolvió el número de orden');
      order.orderNumber = Number(pending.numero);
    } catch (error) {
      console.error(`No se pudo registrar el pedido ${order.id} en Apps Script:`, error.message);
      return res.status(502).json({ error: 'No pudimos registrar tu pedido. Intenta de nuevo en unos segundos.' });
    }
  } else {
    console.warn('APPS_SCRIPT_URL no está configurada: el pedido no se registró en Apps Script.');
    order.orderNumber = nextLocalOrderNumber++;
  }

  let savedOrder;
  try {
    // Sin base de datos, saveOrder devuelve el mismo pedido. Se conserva el
    // número que asignó la cocina, que es el que el cliente pone en el SIMPE.
    const stored = await orderStore.saveOrder(order);
    savedOrder = { ...stored, orderNumber: order.orderNumber };
    orders.unshift(savedOrder);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo guardar el pedido' });
  }

  res.status(201).json({ ...savedOrder, payment: simpePaymentFor(savedOrder) });
});

app.get('/api/orders', async (req, res) => {
  try {
    res.json(await orderStore.listOrders(orders));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudieron cargar los pedidos' });
  }
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const validStatuses = ['pendiente', 'confirmado', 'en_preparacion', 'listo', 'entregado', 'cancelado'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'status is invalid' });
  }

  const order = orders.find((item) => item.id === id);

  if (!order) {
    return res.status(404).json({ error: 'order not found' });
  }

  try {
    const updatedOrder = await orderStore.updateOrderStatus(id, status, order);
    if (!updatedOrder) return res.status(404).json({ error: 'order not found' });
    order.status = status;
    res.json(updatedOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudo actualizar el pedido' });
  }
});

app.get('/api/admin/summary', (req, res) => {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const lowStock = products
    .filter((product) => product.stock <= 10)
    .map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock,
      minimum: 10
    }));

  res.json({
    totalOrders,
    totalRevenue,
    lowStock,
    bestSeller: 'Latte',
    pendingOrders: orders.filter((order) => order.status === 'pendiente').length
  });
});

app.post('/api/checkout', async (req, res) => {
  const { items = [] } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items are required' });
  }

  const orderItems = getOrderItems(items);
  const amount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_dummy') {
    return res.json({
      sessionId: `cs_test_${Date.now()}`,
      checkoutUrl: `https://checkout.stripe.com/test_${Date.now()}`,
      amount,
      currency: 'CRC'
    });
  }

  try {
    const appUrl = `${req.protocol}://${req.get('host')}`;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: orderItems.map((item) => ({
        price_data: {
          currency: 'crc',
          product_data: { name: item.name },
          unit_amount: item.unitPrice
        },
        quantity: item.quantity
      })),
      metadata: {
        orderId: `order-${Date.now()}`
      },
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/cancel`
    });

    return res.json({
      sessionId: session.id,
      checkoutUrl: session.url,
      amount,
      currency: 'CRC'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Stripe checkout failed' });
  }
});

app.post('/api/webhook/stripe', (req, res) => {
  const signature = req.headers['stripe-signature'];
  const payload = req.body;
  const hasRealStripeKey = Boolean(process.env.STRIPE_SECRET_KEY) && process.env.STRIPE_SECRET_KEY !== 'sk_test_dummy';

  if (hasRealStripeKey && !signature) {
    return res.status(400).json({ error: 'Missing Stripe signature' });
  }

  let event;

  try {
    if (hasRealStripeKey) {
      event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET || '');
    } else {
      event = JSON.parse(Buffer.isBuffer(payload) ? payload.toString('utf8') : payload);
    }
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Invalid webhook payload' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata && session.metadata.orderId ? session.metadata.orderId : 'unknown';

    return res.json({
      received: true,
      orderId,
      status: 'paid',
      amount: session.amount_total || 0
    });
  }

  return res.json({ received: true, ignored: true, eventType: event.type });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Bad request' });
});

module.exports = app;
