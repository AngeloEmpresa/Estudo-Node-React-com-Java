import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { brl, centsToInput, parsePriceToCents } from '../format.js';

const EMPTY_FORM = { name: '', sku: '', price: '', stock: '0', active: true };

function Field({ label, error, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export default function ProductsPage({ notify }) {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (term) => {
      try {
        setProducts(await api.products.list({ search: term }));
      } catch (error) {
        notify(error.message, 'error');
      } finally {
        setLoading(false);
      }
    },
    [notify],
  );

  // Busca com "debounce": só consulta a API 300 ms depois da última tecla.
  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
  }, [search, load]);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  }

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: product.sku,
      price: centsToInput(product.priceCents),
      stock: String(product.stock),
      active: product.active,
    });
    setFormErrors({});
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const priceCents = parsePriceToCents(form.price);
    const stock = Number(form.stock);
    const errors = {};
    if (form.name.trim().length < 2) errors.name = 'Informe o nome (mínimo de 2 caracteres).';
    if (!/^[A-Za-z0-9-]{2,40}$/.test(form.sku.trim())) {
      errors.sku = 'SKU com 2 a 40 caracteres (letras, números e hífen).';
    }
    if (priceCents === null) errors.price = 'Preço inválido. Exemplo: 49,90';
    if (!Number.isInteger(stock) || stock < 0) errors.stock = 'O estoque deve ser um inteiro maior ou igual a zero.';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = { name: form.name.trim(), sku: form.sku.trim(), priceCents, stock, active: form.active };

    setSaving(true);
    try {
      if (editingId) {
        await api.products.update(editingId, payload);
        notify('Produto atualizado.');
      } else {
        await api.products.create(payload);
        notify('Produto criado.');
      }
      resetForm();
      await load(search);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product) {
    if (!window.confirm(`Excluir o produto "${product.name}"?`)) return;
    try {
      await api.products.remove(product.id);
      notify('Produto excluído.');
      if (editingId === product.id) resetForm();
      await load(search);
    } catch (error) {
      notify(error.message, 'error'); // ex.: 409 quando o produto já tem pedidos
    }
  }

  return (
    <div className="grid-2">
      <section className="card">
        <div className="card-header">
          <h2>Produtos</h2>
          <input
            className="search"
            type="search"
            placeholder="Buscar por nome ou SKU"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading && <p className="muted">Carregando...</p>}
        {!loading && products.length === 0 && <p className="muted">Nenhum produto encontrado.</p>}

        {!loading && products.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>SKU</th>
                  <th className="num">Preço</th>
                  <th className="num">Estoque</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td className="muted">{product.sku}</td>
                    <td className="num">{brl(product.priceCents)}</td>
                    <td className="num">
                      <span className={product.stock < 5 ? 'badge badge-warn' : 'badge'}>{product.stock}</span>
                    </td>
                    <td>
                      <span className={product.active ? 'badge badge-ok' : 'badge badge-off'}>
                        {product.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="actions">
                      <button type="button" className="btn btn-ghost" onClick={() => startEdit(product)}>
                        Editar
                      </button>{' '}
                      <button type="button" className="btn btn-danger" onClick={() => handleDelete(product)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>{editingId ? 'Editar produto' : 'Novo produto'}</h2>
        <form onSubmit={handleSubmit} noValidate>
          <Field label="Nome" error={formErrors.name}>
            <input value={form.name} onChange={(event) => setField('name', event.target.value)} />
          </Field>
          <Field label="SKU" error={formErrors.sku}>
            <input value={form.sku} onChange={(event) => setField('sku', event.target.value)} />
          </Field>
          <div className="row">
            <Field label="Preço (R$)" error={formErrors.price}>
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={form.price}
                onChange={(event) => setField('price', event.target.value)}
              />
            </Field>
            <Field label="Estoque" error={formErrors.stock}>
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(event) => setField('stock', event.target.value)}
              />
            </Field>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setField('active', event.target.checked)}
            />
            Produto ativo (disponível para venda)
          </label>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
