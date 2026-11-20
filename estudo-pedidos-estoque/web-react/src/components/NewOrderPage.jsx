import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { brl } from '../format.js';

export default function NewOrderPage({ notify, onCreated }) {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState({}); // { [productId]: quantidade }
  const [customerName, setCustomerName] = useState('');
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.products
      .list({ onlyActive: true })
      .then(setProducts)
      .catch((error) => notify(error.message, 'error'));
  }, [notify]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, quantity]) => quantity > 0)
        .map(([productId, quantity]) => ({ productId: Number(productId), quantity })),
    [cart],
  );

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  // Sempre que o carrinho ou o cupom mudam, pede um novo orçamento (calculado pelo serviço Java).
  // A flag "ignore" evita que uma resposta antiga sobrescreva uma mais nova.
  useEffect(() => {
    if (cartItems.length === 0) {
      setQuote(null);
      setQuoteError('');
      setQuoting(false);
      return undefined;
    }

    let ignore = false;
    setQuoting(true);
    const timer = setTimeout(async () => {
      try {
        const result = await api.orders.quote({ items: cartItems, coupon: coupon.trim() || null });
        if (!ignore) {
          setQuote(result);
          setQuoteError('');
        }
      } catch (error) {
        if (!ignore) {
          setQuote(null);
          setQuoteError(error.message);
        }
      } finally {
        if (!ignore) setQuoting(false);
      }
    }, 400);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [cartItems, coupon]);

  function setQuantity(product, value) {
    const wanted = Number.isFinite(value) ? value : 0;
    const quantity = Math.max(0, Math.min(product.stock, wanted));
    setCart((current) => ({ ...current, [product.id]: quantity }));
  }

  const canSubmit =
    customerName.trim().length >= 2 &&
    cartItems.length > 0 &&
    quote !== null &&
    quote.couponValid &&
    !quoting &&
    !submitting;

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const order = await api.orders.create({
        customerName: customerName.trim(),
        coupon: coupon.trim() || null,
        items: cartItems,
      });
      notify(`Pedido #${order.id} confirmado!`);
      onCreated();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid-2" onSubmit={handleSubmit}>
      <section className="card">
        <h2>Escolha os produtos</h2>
        {products.length === 0 && <p className="muted">Nenhum produto ativo cadastrado.</p>}

        <ul className="product-list">
          {products.map((product) => {
            const quantity = cart[product.id] ?? 0;
            const soldOut = product.stock === 0;
            return (
              <li key={product.id} className="product-row">
                <div>
                  <strong>{product.name}</strong>
                  <div className="muted">
                    {brl(product.priceCents)} · {soldOut ? 'sem estoque' : `${product.stock} em estoque`}
                  </div>
                </div>
                <div className="qty">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={soldOut || quantity === 0}
                    onClick={() => setQuantity(product, quantity - 1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="0"
                    max={product.stock}
                    disabled={soldOut}
                    value={quantity}
                    onChange={(event) => setQuantity(product, parseInt(event.target.value, 10))}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={soldOut || quantity >= product.stock}
                    onClick={() => setQuantity(product, quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <h2>Resumo do pedido</h2>

        <label className="field">
          <span>Nome do cliente</span>
          <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
        </label>
        <label className="field">
          <span>Cupom (opcional)</span>
          <input
            value={coupon}
            placeholder="BEMVINDO10 ou FRETEGRATIS"
            onChange={(event) => setCoupon(event.target.value)}
          />
        </label>

        {cartItems.length === 0 && <p className="muted">Adicione produtos para ver o valor.</p>}
        {quoteError && <p className="field-error">{quoteError}</p>}

        {quote && (
          <div className={quoting ? 'summary summary-loading' : 'summary'}>
            <ul className="summary-lines">
              {quote.lines.map((line) => (
                <li key={line.productId}>
                  <span>
                    {productsById.get(line.productId)?.name ?? `Produto ${line.productId}`} × {line.quantity}
                  </span>
                  <span>{brl(line.lineTotalCents)}</span>
                </li>
              ))}
            </ul>

            <dl className="totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{brl(quote.subtotalCents)}</dd>
              </div>
              {quote.volumeDiscountCents > 0 && (
                <div>
                  <dt>Desconto por quantidade</dt>
                  <dd>− {brl(quote.volumeDiscountCents)}</dd>
                </div>
              )}
              {quote.couponDiscountCents > 0 && (
                <div>
                  <dt>Cupom {quote.couponCode}</dt>
                  <dd>− {brl(quote.couponDiscountCents)}</dd>
                </div>
              )}
              <div>
                <dt>Frete</dt>
                <dd>{quote.shippingCents === 0 ? 'Grátis' : brl(quote.shippingCents)}</dd>
              </div>
              <div className="total">
                <dt>Total</dt>
                <dd>{brl(quote.totalCents)}</dd>
              </div>
            </dl>

            {quote.couponMessage && (
              <p className={quote.couponValid ? 'coupon-ok' : 'field-error'}>{quote.couponMessage}</p>
            )}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={!canSubmit}>
          {submitting ? 'Confirmando...' : 'Confirmar pedido'}
        </button>
      </section>
    </form>
  );
}
