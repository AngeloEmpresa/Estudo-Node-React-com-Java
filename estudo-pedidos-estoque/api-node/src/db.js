import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    sku         TEXT    NOT NULL UNIQUE,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name  TEXT    NOT NULL,
    coupon_code    TEXT,
    subtotal_cents INTEGER NOT NULL,
    discount_cents INTEGER NOT NULL,
    shipping_cents INTEGER NOT NULL,
    total_cents    INTEGER NOT NULL,
    status         TEXT    NOT NULL CHECK (status IN ('CONFIRMADO', 'CANCELADO')),
    created_at     TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id       INTEGER NOT NULL REFERENCES products(id),
    product_name     TEXT    NOT NULL,
    unit_price_cents INTEGER NOT NULL,
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    line_total_cents INTEGER NOT NULL
  );
`;

const SEED_PRODUCTS = [
  { name: 'Teclado Mecânico', sku: 'TEC-001', priceCents: 24990, stock: 25 },
  { name: 'Mouse Sem Fio', sku: 'MOU-001', priceCents: 8990, stock: 40 },
  { name: 'Monitor 24"', sku: 'MON-024', priceCents: 89900, stock: 8 },
  { name: 'Cabo HDMI 2m', sku: 'CAB-HDMI', priceCents: 2990, stock: 120 },
  { name: 'Webcam Full HD', sku: 'WEB-FHD', priceCents: 19990, stock: 3 },
  { name: 'Hub USB-C', sku: 'HUB-USBC', priceCents: 15990, stock: 15 },
];

export function openDatabase(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

// O node:sqlite não tem helper de transação, então fazemos BEGIN/COMMIT/ROLLBACK na mão.
// A função recebida precisa ser síncrona (sem await), o que também evita que outra
// requisição "entre no meio" da transação.
export function withTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// Popula alguns produtos na primeira execução para a tela não começar vazia.
export function seedIfEmpty(db) {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM products').get();
  if (total > 0) return;

  const insert = db.prepare(
    'INSERT INTO products (name, sku, price_cents, stock, active, created_at) VALUES (?, ?, ?, ?, 1, ?)',
  );
  const now = new Date().toISOString();
  withTransaction(db, () => {
    for (const p of SEED_PRODUCTS) insert.run(p.name, p.sku, p.priceCents, p.stock, now);
  });
}
