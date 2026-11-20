import { HttpError } from '../errors.js';
import { withTransaction } from '../db.js';

const toOrderItem = (row) => ({
  productId: row.product_id,
  productName: row.product_name,
  unitPriceCents: row.unit_price_cents,
  quantity: row.quantity,
  lineTotalCents: row.line_total_cents,
});

const toOrder = (row, itemRows) => ({
  id: row.id,
  customerName: row.customer_name,
  couponCode: row.coupon_code,
  subtotalCents: row.subtotal_cents,
  discountCents: row.discount_cents,
  shippingCents: row.shipping_cents,
  totalCents: row.total_cents,
  status: row.status,
  createdAt: row.created_at,
  items: itemRows.map(toOrderItem),
});

// Se o mesmo produto vier duas vezes no pedido, soma as quantidades.
function mergeItems(items) {
  const quantities = new Map();
  for (const { productId, quantity } of items) {
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

export function createOrderService({ db, pricing }) {
  const selectProductStmt = db.prepare('SELECT * FROM products WHERE id = ?');
  const decrementStockStmt = db.prepare(
    'UPDATE products SET stock = stock - ? WHERE id = ? AND active = 1 AND stock >= ?',
  );
  const incrementStockStmt = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  const insertOrderStmt = db.prepare(
    `INSERT INTO orders (customer_name, coupon_code, subtotal_cents, discount_cents, shipping_cents, total_cents, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMADO', ?)`,
  );
  const insertItemStmt = db.prepare(
    `INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity, line_total_cents)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const selectOrderStmt = db.prepare('SELECT * FROM orders WHERE id = ?');
  const selectItemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id');
  const setStatusStmt = db.prepare('UPDATE orders SET status = ? WHERE id = ?');

  // Regras de estoque: o produto precisa existir, estar ativo e ter quantidade suficiente.
  function loadAndValidate(items) {
    return items.map(({ productId, quantity }) => {
      const row = selectProductStmt.get(productId);
      if (!row) throw new HttpError(422, `Produto ${productId} não encontrado.`);
      if (row.active !== 1) throw new HttpError(422, `O produto "${row.name}" está inativo.`);
      if (row.stock < quantity) {
        throw new HttpError(
          409,
          `Estoque insuficiente para "${row.name}": disponível ${row.stock}, solicitado ${quantity}.`,
        );
      }
      return { productId, quantity, name: row.name, unitPriceCents: row.price_cents };
    });
  }

  // Integração: o preço (descontos, cupom, frete) é calculado pelo serviço Java.
  async function requestQuote({ items, coupon }) {
    const lines = loadAndValidate(mergeItems(items));
    const quote = await pricing.quote({
      coupon,
      items: lines.map(({ productId, unitPriceCents, quantity }) => ({ productId, unitPriceCents, quantity })),
    });
    return { lines, quote };
  }

  function getById(id) {
    const row = selectOrderStmt.get(id);
    if (!row) throw new HttpError(404, 'Pedido não encontrado.');
    return toOrder(row, selectItemsStmt.all(id));
  }

  return {
    getById,

    list() {
      const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 100').all();
      if (rows.length === 0) return [];

      // Uma única consulta para os itens de todos os pedidos (evita o problema de N+1).
      const ids = rows.map((row) => row.id);
      const itemRows = db
        .prepare(`SELECT * FROM order_items WHERE order_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`)
        .all(...ids);

      const itemsByOrder = new Map();
      for (const item of itemRows) {
        if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
        itemsByOrder.get(item.order_id).push(item);
      }
      return rows.map((row) => toOrder(row, itemsByOrder.get(row.id) ?? []));
    },

    // Pré-visualização do valor (não grava nada nem mexe no estoque).
    async quote(input) {
      const { quote } = await requestQuote(input);
      return quote;
    },

    async create({ customerName, coupon, items }) {
      const { lines, quote } = await requestQuote({ items, coupon });

      if (coupon && !quote.couponValid) {
        throw new HttpError(422, quote.couponMessage ?? 'Cupom inválido.');
      }

      // Entre pedir o orçamento (await) e gravar, outro pedido pode ter consumido o estoque.
      // Por isso a baixa é condicional (stock >= quantidade) e tudo ocorre em uma transação:
      // se qualquer item falhar, o ROLLBACK desfaz as baixas anteriores.
      const orderId = withTransaction(db, () => {
        for (const line of lines) {
          const { changes } = decrementStockStmt.run(line.quantity, line.productId, line.quantity);
          if (changes === 0) {
            throw new HttpError(
              409,
              `Estoque insuficiente para "${line.name}". Outro pedido pode ter sido confirmado agora.`,
            );
          }
        }

        const discountCents = quote.volumeDiscountCents + quote.couponDiscountCents;
        const result = insertOrderStmt.run(
          customerName, quote.couponCode ?? null, quote.subtotalCents, discountCents,
          quote.shippingCents, quote.totalCents, new Date().toISOString(),
        );
        const id = Number(result.lastInsertRowid);

        for (const line of lines) {
          const priced = quote.lines.find((l) => l.productId === line.productId);
          if (!priced) throw new HttpError(502, 'Resposta inválida do serviço de preços.');
          insertItemStmt.run(id, line.productId, line.name, line.unitPriceCents, line.quantity, priced.lineTotalCents);
        }
        return id;
      });

      return getById(orderId);
    },

    // Cancelar devolve os itens ao estoque. Não há await aqui, então a operação é atômica.
    cancel(id) {
      const order = getById(id);
      if (order.status === 'CANCELADO') throw new HttpError(409, 'Este pedido já foi cancelado.');

      withTransaction(db, () => {
        for (const item of order.items) incrementStockStmt.run(item.quantity, item.productId);
        setStatusStmt.run('CANCELADO', id);
      });
      return getById(id);
    },
  };
}
