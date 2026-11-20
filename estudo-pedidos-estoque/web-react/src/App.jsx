import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import ProductsPage from './components/ProductsPage.jsx';
import NewOrderPage from './components/NewOrderPage.jsx';
import OrdersPage from './components/OrdersPage.jsx';

const TABS = [
  { id: 'products', label: 'Produtos' },
  { id: 'new-order', label: 'Novo pedido' },
  { id: 'orders', label: 'Pedidos' },
];

// Mostra se a API Node e o serviço de preços (Java) estão no ar. Atualiza a cada 10 segundos.
function ServiceStatus() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let active = true;
    const check = () =>
      api
        .health()
        .then((data) => active && setHealth(data))
        .catch(() => active && setHealth({ status: 'DOWN', pricing: 'DOWN' }));

    check();
    const timer = setInterval(check, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const dot = (up) => <span className={`dot ${up ? 'dot-up' : 'dot-down'}`} />;

  return (
    <div className="status">
      <span>{dot(health?.status === 'UP')} API Node</span>
      <span>{dot(health?.pricing === 'UP')} Preços (Java)</span>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('products');
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Pedidos &amp; Estoque</h1>
          <p className="muted">Projeto de estudo: React + Node.js + Java</p>
        </div>
        <ServiceStatus />
      </header>

      <nav className="tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'tab tab-active' : 'tab'}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'products' && <ProductsPage notify={notify} />}
        {tab === 'new-order' && <NewOrderPage notify={notify} onCreated={() => setTab('orders')} />}
        {tab === 'orders' && <OrdersPage notify={notify} />}
      </main>

      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </div>
  );
}
