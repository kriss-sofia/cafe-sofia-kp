// Cliente del backend de Google Apps Script (la "cocina").
// Corre solo en el servidor de Vercel: la URL del backend vive en la variable
// de entorno APPS_SCRIPT_URL y nunca llega al navegador.

const TIMEOUT_MS = 15000;

function isConfigured() {
  return Boolean(process.env.APPS_SCRIPT_URL);
}

// Envía una acción al doPost de Apps Script y devuelve su respuesta JSON.
// Apps Script siempre responde HTTP 200; el resultado real viene en { ok, error }.
async function callAppsScript(accion, datos) {
  const url = process.env.APPS_SCRIPT_URL;
  if (!url) {
    throw new Error('Falta la variable de entorno APPS_SCRIPT_URL');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, ...datos }),
      redirect: 'follow',
      signal: controller.signal
    });

    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      // Si llega HTML, casi siempre es la página de login de Google: la
      // implementación no tiene acceso "Cualquier usuario".
      throw new Error(`Apps Script no respondió JSON (HTTP ${response.status}). ¿La implementación tiene acceso "Cualquier usuario"?`);
    }

    if (!payload.ok) {
      throw new Error(payload.error || 'Apps Script rechazó la acción');
    }

    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Apps Script no respondió en ${TIMEOUT_MS / 1000} segundos`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Avisa a la cocina que se confirmó una compra: descuenta stock, suma a la
// caja y anota la venta. Es idempotente del lado de Apps Script (por order.id).
function registerSale(order) {
  return callAppsScript('registrar_venta', {
    pedido: {
      id: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal
      }))
    }
  });
}

module.exports = {
  isConfigured,
  callAppsScript,
  registerSale
};
