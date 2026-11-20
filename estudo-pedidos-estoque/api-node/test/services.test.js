import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db.js';
import { HttpError } from '../src/errors.js';
import { createProductService } from '../src/services/productService.js';
import { createOrderService } from '../src/services/orderService.js';
import { parseOrderInput, parseProductInput } from '../src/validators.js';

// Dublê do serviço Java: segue o mesmo contrato, mas com regras simplificadas.
function fakePricing({ down = false, onQuote } = {}) {
  return {
    async quote({ items, coupon }) {
      if (down) throw new HttpError(503, 'O serviço de preços está indisponível.');
      if (onQuote) onQuote();

      const lines = items.map((item) => {
        const gross = item.unitPriceCents * item.quantity;
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          grossCents: gross,
          volumeDiscountCents: 0,
          lineTotalCents: gross,
        };
      });
      const subtotal = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
      const couponValid = !coupon || coupon === 'OK10';
      const couponDiscount = coupon === 'OK10' ? Math.round(subtotal * 0.1) : 0;
      return {
        lines,
        subtotalCents: subtotal,
        volumeDiscountCents: 0,
        couponCode: coupon ?? null,
        couponValid,
        couponMessage: couponValid ? null : 'Cupom inexistente.',
        couponDiscountCents: couponDiscount,
        shippingCents: 1990,
        totalCents: subtotal - couponDiscount + 1990,
      };
    },
    async health() {
      return { status: 'UP' };
    },
  };
}

function setup(pricing = fakePricing()) {
  const db = openDatabase(':memory:');
  const products = createProductService(db);
  const orders = createOrderService({ db, pricing });
  const teclado = products.create({ name: 'Teclado', sku: 'TEC-1', priceCents: 10000, stock: 10, active: true });
  const mouse = products.create({ name: 'Mouse', sku: 'MOU-1', priceCents: 5000, stock: 2, active: true });
  const antigo = products.create({ name: 'Antigo', sku: 'OLD-1', priceCents: 1000, stock: 5, active: false });
  return { db, products, orders, teclado, mouse, antigo };
}

const stockOf = (products, id) => products.getById(id).stock;

// ---------- Pedidos ----------

test('cria pedido, grava os totais do serviço de preços e baixa o estoque', async () => {
  const { products, orders, teclado } = setup();

  const order = await orders.create({
    customerName: 'Maria',
    coupon: 'OK10',
    items: [{ productId: teclado.id, quantity: 2 }],
  });

  assert.equal(order.status, 'CONFIRMADO');
  assert.equal(order.subtotalCents, 20000);
  assert.equal(order.discountCents, 2000);
  assert.equal(order.shippingCents, 1990);
  assert.equal(order.totalCents, 19990);
  assert.equal(order.couponCode, 'OK10');
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].productName, 'Teclado');
  assert.equal(order.items[0].lineTotalCents, 20000);
  assert.equal(stockOf(products, teclado.id), 8);
});

test('soma as quantidades quando o mesmo produto aparece duas vezes', async () => {
  const { products, orders, teclado } = setup();

  const order = await orders.create({
    customerName: 'João',
    coupon: null,
    items: [
      { productId: teclado.id, quantity: 1 },
      { productId: teclado.id, quantity: 3 },
    ],
  });

  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].quantity, 4);
  assert.equal(stockOf(products, teclado.id), 6);
});

test('rejeita pedido com estoque insuficiente (409) sem alterar nada', async () => {
  const { products, orders, mouse } = setup();

  await assert.rejects(
    orders.create({ customerName: 'Ana', coupon: null, items: [{ productId: mouse.id, quantity: 3 }] }),
    { status: 409 },
  );
  assert.equal(stockOf(products, mouse.id), 2);
  assert.equal(orders.list().length, 0);
});

test('rejeita produto inativo e produto inexistente (422)', async () => {
  const { orders, antigo } = setup();

  await assert.rejects(
    orders.create({ customerName: 'Ana', coupon: null, items: [{ productId: antigo.id, quantity: 1 }] }),
    { status: 422 },
  );
  await assert.rejects(
    orders.create({ customerName: 'Ana', coupon: null, items: [{ productId: 999, quantity: 1 }] }),
    { status: 422 },
  );
});

test('rejeita cupom inválido (422) e não baixa estoque', async () => {
  const { products, orders, teclado } = setup();

  await assert.rejects(
    orders.create({ customerName: 'Ana', coupon: 'FAKE', items: [{ productId: teclado.id, quantity: 1 }] }),
    { status: 422, message: 'Cupom inexistente.' },
  );
  assert.equal(stockOf(products, teclado.id), 10);
});

test('retorna 503 quando o serviço de preços está fora do ar', async () => {
  const { products, orders, teclado } = setup(fakePricing({ down: true }));

  await assert.rejects(
    orders.create({ customerName: 'Ana', coupon: null, items: [{ productId: teclado.id, quantity: 1 }] }),
    { status: 503 },
  );
  assert.equal(stockOf(products, teclado.id), 10);
});

test('desfaz tudo (rollback) se o estoque acabar entre o orçamento e a gravação', async () => {
  // Simula outro pedido consumindo o estoque do mouse enquanto aguardamos o serviço de preços.
  let ids;
  const pricing = fakePricing({
    onQuote: () => ids.db.prepare('UPDATE products SET stock = 1 WHERE id = ?').run(ids.mouse.id),
  });
  ids = setup(pricing);
  const { products, orders, teclado, mouse } = ids;

  await assert.rejects(
    orders.create({
      customerName: 'Ana',
      coupon: null,
      items: [
        { productId: teclado.id, quantity: 2 },
        { productId: mouse.id, quantity: 2 },
      ],
    }),
    { status: 409 },
  );

  assert.equal(stockOf(products, teclado.id), 10, 'a baixa do teclado deve ter sido desfeita');
  assert.equal(orders.list().length, 0);
});

test('cancelar devolve o estoque; cancelar de novo dá 409; id inexistente dá 404', async () => {
  const { products, orders, teclado } = setup();
  const order = await orders.create({
    customerName: 'Ana',
    coupon: null,
    items: [{ productId: teclado.id, quantity: 4 }],
  });
  assert.equal(stockOf(products, teclado.id), 6);

  const cancelled = orders.cancel(order.id);
  assert.equal(cancelled.status, 'CANCELADO');
  assert.equal(stockOf(products, teclado.id), 10);

  assert.throws(() => orders.cancel(order.id), { status: 409 });
  assert.throws(() => orders.cancel(12345), { status: 404 });
});

test('lista pedidos do mais recente para o mais antigo, com itens', async () => {
  const { orders, teclado, mouse } = setup();
  await orders.create({ customerName: 'Primeiro', coupon: null, items: [{ productId: teclado.id, quantity: 1 }] });
  await orders.create({ customerName: 'Segundo', coupon: null, items: [{ productId: mouse.id, quantity: 1 }] });

  const list = orders.list();
  assert.deepEqual(list.map((o) => o.customerName), ['Segundo', 'Primeiro']);
  assert.equal(list[0].items[0].productName, 'Mouse');
});

test('quote não grava pedido nem altera estoque', async () => {
  const { products, orders, teclado } = setup();
  const quote = await orders.quote({ coupon: null, items: [{ productId: teclado.id, quantity: 3 }] });

  assert.equal(quote.subtotalCents, 30000);
  assert.equal(orders.list().length, 0);
  assert.equal(stockOf(products, teclado.id), 10);
});

// ---------- Produtos ----------

test('produto: SKU duplicado dá 409 e busca filtra por nome ou SKU', () => {
  const { products } = setup();

  assert.throws(
    () => products.create({ name: 'Outro', sku: 'TEC-1', priceCents: 1, stock: 1, active: true }),
    { status: 409 },
  );
  assert.deepEqual(products.list({ search: 'tecl' }).map((p) => p.sku), ['TEC-1']);
  assert.deepEqual(products.list({ search: 'mou-1' }).map((p) => p.sku), ['MOU-1']);
  assert.equal(products.list({ onlyActive: true }).length, 2);
});

test('produto: atualizar, 404 e exclusão bloqueada quando há pedidos', async () => {
  const { products, orders, teclado, mouse } = setup();

  const updated = products.update(mouse.id, { name: 'Mouse Gamer', sku: 'MOU-1', priceCents: 7000, stock: 9, active: true });
  assert.equal(updated.name, 'Mouse Gamer');
  assert.equal(updated.priceCents, 7000);
  assert.throws(() => products.update(999, { name: 'X', sku: 'XX', priceCents: 1, stock: 1, active: true }), { status: 404 });

  await orders.create({ customerName: 'Ana', coupon: null, items: [{ productId: teclado.id, quantity: 1 }] });
  assert.throws(() => products.remove(teclado.id), { status: 409 });

  products.remove(mouse.id);
  assert.throws(() => products.getById(mouse.id), { status: 404 });
});

// ---------- Validação de entrada ----------

test('validação de produto normaliza o SKU e acumula erros', () => {
  const ok = parseProductInput({ name: '  Cabo  ', sku: ' cab-01 ', priceCents: 1500, stock: 3 });
  assert.deepEqual(ok, { name: 'Cabo', sku: 'CAB-01', priceCents: 1500, stock: 3, active: true });

  try {
    parseProductInput({ name: 'A', sku: '!!', priceCents: 10.5, stock: -1 });
    assert.fail('deveria lançar erro');
  } catch (error) {
    assert.equal(error.status, 400);
    assert.deepEqual(Object.keys(error.details).sort(), ['name', 'priceCents', 'sku', 'stock']);
  }
  assert.throws(() => parseProductInput(undefined), { status: 400 });
});

test('validação de pedido', () => {
  const ok = parseOrderInput({ customerName: ' Ana ', coupon: ' ', items: [{ productId: 1, quantity: 2 }] });
  assert.deepEqual(ok, { customerName: 'Ana', coupon: null, items: [{ productId: 1, quantity: 2 }] });

  assert.throws(() => parseOrderInput({ customerName: 'Ana', items: [] }), { status: 400 });
  assert.throws(() => parseOrderInput({ customerName: 'Ana', items: [{ productId: 1, quantity: 0 }] }), { status: 400 });
  assert.throws(() => parseOrderInput({ customerName: '', items: [{ productId: 1, quantity: 1 }] }), { status: 400 });
  // pré-visualização não exige o nome do cliente
  assert.doesNotThrow(() => parseOrderInput({ items: [{ productId: 1, quantity: 1 }] }, { requireCustomer: false }));
});
