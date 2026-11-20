import express from 'express';
import { HttpError } from './errors.js';
import { parseId, parseOrderInput, parseProductInput } from './validators.js';
import { createProductService } from './services/productService.js';
import { createOrderService } from './services/orderService.js';

export function createApp({ db, pricing }) {
  const app = express();
  app.use(express.json());

  const products = createProductService(db);
  const orders = createOrderService({ db, pricing });

  // --- Saúde (inclui o status do serviço Java) ---
  app.get('/api/health', async (req, res) => {
    let pricingStatus = 'UP';
    try {
      await pricing.health();
    } catch {
      pricingStatus = 'DOWN';
    }
    res.json({ status: 'UP', service: 'api-node', pricing: pricingStatus });
  });

  // --- Produtos (CRUD) ---
  app.get('/api/products', (req, res) => {
    res.json(
      products.list({
        search: String(req.query.search ?? ''),
        onlyActive: req.query.onlyActive === 'true',
      }),
    );
  });

  app.get('/api/products/:id', (req, res) => {
    res.json(products.getById(parseId(req.params.id)));
  });

  app.post('/api/products', (req, res) => {
    res.status(201).json(products.create(parseProductInput(req.body)));
  });

  app.put('/api/products/:id', (req, res) => {
    res.json(products.update(parseId(req.params.id), parseProductInput(req.body)));
  });

  app.delete('/api/products/:id', (req, res) => {
    products.remove(parseId(req.params.id));
    res.status(204).end();
  });

  // --- Pedidos ---
  app.get('/api/orders', (req, res) => {
    res.json(orders.list());
  });

  // A rota /quote precisa vir antes de /:id para não ser confundida com um id.
  app.post('/api/orders/quote', async (req, res) => {
    const input = parseOrderInput(req.body, { requireCustomer: false });
    res.json(await orders.quote(input));
  });

  app.get('/api/orders/:id', (req, res) => {
    res.json(orders.getById(parseId(req.params.id)));
  });

  app.post('/api/orders', async (req, res) => {
    res.status(201).json(await orders.create(parseOrderInput(req.body)));
  });

  app.post('/api/orders/:id/cancel', (req, res) => {
    res.json(orders.cancel(parseId(req.params.id)));
  });

  // --- 404 e tratamento de erros ---
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Rota não encontrada.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON inválido no corpo da requisição.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Erro interno do servidor.' });
  });

  return app;
}
