import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { brl, formatDate } from '../format.js';

export default function OrdersPage({ notify }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setOrders(await api.orders.list());
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel(order) {
    if (!window.confirm(`Cancelar o pedido #${order.id}? Os itens voltam ao estoque.`)) return;
    try {
      await api.orders.cancel(order.id);
      notify(`Pedido #${order.id} cancelado.`);
      await load();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;
  if (orders.length === 0) return <p className="muted">Nenhum pedido realizado ainda.</p>;

  return (
    <div className="orders">
      {orders.map((order) => (
        <article key={order.id} className="card">
          <div className="card-header">
            <div>
              <h2>Pedido #{order.id}</h2>
              <div className="muted">
                {order.customerName} · {formatDate(order.createdAt)}
              </div>
            </div>
            <span className={order.status === 'CONFIRMADO' ? 'badge badge-ok' : 'badge badge-off'}>
              {order.status === 'CONFIRMADO' ? 'Confirmado' : 'Cancelado'}
            </span>
          </div>

          <ul className="summary-lines">
            {order.items.map((item) => (
              <li key={item.productId}>
                <span>
                  {item.productName} × {item.quantity}
                </span>
                <span>{brl(item.lineTotalCents)}</span>
              </li>
            ))}
          </ul>

          <div className="order-footer">
            <div className="muted">
              Desconto: {brl(order.discountCents)} · Frete: {order.shippingCents === 0 ? 'grátis' : brl(order.shippingCents)}
              {order.couponCode ? ` · Cupom ${order.couponCode}` : ''}
            </div>
            <strong>{brl(order.totalCents)}</strong>
          </div>

          {order.status === 'CONFIRMADO' && (
            <button type="button" className="btn btn-danger" onClick={() => handleCancel(order)}>
              Cancelar pedido
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
