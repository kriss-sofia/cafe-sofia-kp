const { Pool } = require('pg');

const useDatabase = Boolean(process.env.DATABASE_URL);
const pool = useDatabase
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

let databaseReady;

if (pool) {
  databaseReady = pool.query(`
    CREATE TABLE IF NOT EXISTS cafe_orders (
      order_number BIGSERIAL PRIMARY KEY,
      id TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL,
      total INTEGER NOT NULL CHECK (total >= 0),
      items JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function waitForDatabase() {
  if (databaseReady) await databaseReady;
}

async function saveOrder(order) {
  if (!pool) return order;

  await waitForDatabase();
  const result = await pool.query(
    `INSERT INTO cafe_orders (id, status, total, items, created_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING order_number`,
    [order.id, order.status, order.total, JSON.stringify(order.items), order.createdAt]
  );

  return { ...order, orderNumber: Number(result.rows[0].order_number) };
}

async function listOrders(fallbackOrders) {
  if (!pool) return fallbackOrders;

  await waitForDatabase();
  const result = await pool.query(
    `SELECT order_number, id, status, total, items, created_at
     FROM cafe_orders ORDER BY order_number DESC`
  );

  return result.rows.map((row) => ({
    orderNumber: Number(row.order_number),
    id: row.id,
    status: row.status,
    total: row.total,
    items: row.items,
    createdAt: row.created_at.toISOString()
  }));
}

async function updateOrderStatus(id, status, fallbackOrder) {
  if (!pool) return { ...fallbackOrder, status };

  await waitForDatabase();
  const result = await pool.query(
    `UPDATE cafe_orders SET status = $1 WHERE id = $2
     RETURNING order_number, id, status, total, items, created_at`,
    [status, id]
  );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    orderNumber: Number(row.order_number),
    id: row.id,
    status: row.status,
    total: row.total,
    items: row.items,
    createdAt: row.created_at.toISOString()
  };
}

module.exports = {
  databaseEnabled: useDatabase,
  saveOrder,
  listOrders,
  updateOrderStatus
};
