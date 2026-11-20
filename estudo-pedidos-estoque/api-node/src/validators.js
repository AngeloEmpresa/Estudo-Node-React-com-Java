import { HttpError } from './errors.js';

const isInt = (value) => Number.isInteger(value);

function fail(details) {
  throw new HttpError(400, 'Dados inválidos.', details);
}

export function parseId(value) {
  const id = Number(value);
  if (!isInt(id) || id <= 0) throw new HttpError(400, 'Id inválido.');
  return id;
}

export function parseProductInput(body) {
  const data = body ?? {};
  const details = {};

  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (name.length < 2 || name.length > 120) {
    details.name = 'Informe um nome entre 2 e 120 caracteres.';
  }

  const sku = typeof data.sku === 'string' ? data.sku.trim().toUpperCase() : '';
  if (!/^[A-Z0-9-]{2,40}$/.test(sku)) {
    details.sku = 'O SKU deve ter de 2 a 40 caracteres (letras, números e hífen).';
  }

  if (!isInt(data.priceCents) || data.priceCents < 0) {
    details.priceCents = 'O preço deve ser um inteiro em centavos, maior ou igual a zero.';
  }

  if (!isInt(data.stock) || data.stock < 0) {
    details.stock = 'O estoque deve ser um inteiro maior ou igual a zero.';
  }

  if (data.active !== undefined && typeof data.active !== 'boolean') {
    details.active = 'O campo "active" deve ser verdadeiro ou falso.';
  }

  if (Object.keys(details).length > 0) fail(details);

  return { name, sku, priceCents: data.priceCents, stock: data.stock, active: data.active ?? true };
}

// requireCustomer = false é usado na pré-visualização do orçamento (ainda sem nome do cliente).
export function parseOrderInput(body, { requireCustomer = true } = {}) {
  const data = body ?? {};
  const details = {};

  const customerName = typeof data.customerName === 'string' ? data.customerName.trim() : '';
  if (requireCustomer && (customerName.length < 2 || customerName.length > 120)) {
    details.customerName = 'Informe o nome do cliente (2 a 120 caracteres).';
  }

  let coupon = null;
  if (data.coupon !== undefined && data.coupon !== null) {
    if (typeof data.coupon !== 'string' || data.coupon.length > 30) {
      details.coupon = 'Cupom inválido.';
    } else {
      coupon = data.coupon.trim() || null;
    }
  }

  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length < 1 || items.length > 50) {
    details.items = 'Informe de 1 a 50 itens.';
  } else if (
    !items.every(
      (item) =>
        item && isInt(item.productId) && item.productId > 0 &&
        isInt(item.quantity) && item.quantity >= 1 && item.quantity <= 1000,
    )
  ) {
    details.items = 'Cada item precisa de productId e quantity (1 a 1000), ambos inteiros.';
  }

  if (Object.keys(details).length > 0) fail(details);

  return {
    customerName,
    coupon,
    items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
  };
}
