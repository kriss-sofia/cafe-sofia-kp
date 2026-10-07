// Cliente del backend de Google Apps Script (la "cocina").
// Corre solo en el servidor de Vercel: la URL del backend (APPS_SCRIPT_URL) y
// el token compartido (APPS_SCRIPT_TOKEN) viven en variables de entorno y
// nunca llegan al navegador.

const TIMEOUT_MS = 15000;

function isConfigured() {
  return Boolean(process.env.APPS_SCRIPT_URL);
}

// Envía una acción al doPost de Apps Script y devuelve su respuesta JSON.
// Apps Script siempre responde HTTP 200; el resultado real viene en { ok, error }.
// El token va en el cuerpo porque doPost no puede leer los encabezados HTTP.
async function callAppsScript(accion, datos) {
  const url = process.env.APPS_SCRIPT_URL;
  const token = process.env.APPS_SCRIPT_TOKEN;
  if (!url) {
    throw new Error('Falta la variable de entorno APPS_SCRIPT_URL');
  }
  if (!token) {
    throw new Error('Falta la variable de entorno APPS_SCRIPT_TOKEN');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...datos, accion, token }),
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

// Anota en la cocina un pedido que se paga por transferencia (SIMPE Móvil).
// Queda PENDIENTE: no descuenta stock ni suma a la caja hasta que un
// administrador lo confirme. Devuelve { numero }, el número de orden que
// asigna Apps Script. Es idempotente del lado de Apps Script (por order.id).
function registerPendingTransfer(order) {
  return callAppsScript('registrar_transferencia', {
    pedido: {
      id: order.id,
      metodo: order.paymentMethod,
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
  registerPendingTransfer
};
