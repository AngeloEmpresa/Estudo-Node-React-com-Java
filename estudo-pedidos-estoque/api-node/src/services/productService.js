import { HttpError } from '../errors.js';

const toProduct = (row) => ({
  id: row.id,
  name: row.name,
  sku: row.sku,
  priceCents: row.price_cents,
  stock: row.stock,
  active: row.active === 1,
  createdAt: row.created_at,
});

export function createProductService(db) {
  const selectByIdStmt = db.prepare('SELECT * FROM products WHERE id = ?');
  const insertStmt = db.prepare(
    'INSERT INTO products (name, sku, price_cents, stock, active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const updateStmt = db.prepare(
    'UPDATE products SET name = ?, sku = ?, price_cents = ?, stock = ?, active = ? WHERE id = ?',
  );
  const countOrderItemsStmt = db.prepare('SELECT COUNT(*) AS total FROM order_items WHERE product_id = ?');
  const deleteStmt = db.prepare('DELETE FROM products WHERE id = ?');

  function getById(id) {
    const row = selectByIdStmt.get(id);
    if (!row) throw new HttpError(404, 'Produto não encontrado.');
    return toProduct(row);
  }

  // Traduz erro de banco (SKU duplicado) para uma resposta HTTP 409 amigável.
  function translateDbError(error) {
    if (String(error.message).includes('UNIQUE constraint failed: products.sku')) {
      return new HttpError(409, 'Já existe um produto com esse SKU.');
    }
    return error;
  }

  return {
    list({ search = '', onlyActive = false } = {}) {
      const term = `%${search.trim().toLowerCase()}%`;
      const sql =
        'SELECT * FROM products WHERE (LOWER(name) LIKE ? OR LOWER(sku) LIKE ?)' +
        (onlyActive ? ' AND active = 1' : '') +
        ' ORDER BY name COLLATE NOCASE';
      return db.prepare(sql).all(term, term).map(toProduct);
    },

    getById,

    create(input) {
      try {
        const result = insertStmt.run(
          input.name, input.sku, input.priceCents, input.stock, input.active ? 1 : 0, new Date().toISOString(),
        );
        return getById(Number(result.lastInsertRowid));
      } catch (error) {
        throw translateDbError(error);
      }
    },

    update(id, input) {
      getById(id); // garante o 404 antes de tentar atualizar
      try {
        updateStmt.run(input.name, input.sku, input.priceCents, input.stock, input.active ? 1 : 0, id);
      } catch (error) {
        throw translateDbError(error);
      }
      return getById(id);
    },

    remove(id) {
      getById(id);
      // Regra de negócio: produto que já foi vendido não pode ser excluído (histórico de pedidos).
      if (countOrderItemsStmt.get(id).total > 0) {
        throw new HttpError(409, 'Este produto já possui pedidos. Desative-o em vez de excluir.');
      }
      deleteStmt.run(id);
    },
  };
}
