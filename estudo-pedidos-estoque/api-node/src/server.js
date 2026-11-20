import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from './app.js';
import { openDatabase, seedIfEmpty } from './db.js';
import { createPricingClient } from './pricingClient.js';

const PORT = Number(process.env.PORT ?? 3001);
const DB_FILE = process.env.DB_FILE ?? './data/loja.db';
const PRICING_URL = process.env.PRICING_URL ?? 'http://localhost:8081';

mkdirSync(dirname(DB_FILE), { recursive: true });
const db = openDatabase(DB_FILE);
seedIfEmpty(db);

const pricing = createPricingClient({ baseUrl: PRICING_URL });
const app = createApp({ db, pricing });

app.listen(PORT, () => {
  console.log(`API Node rodando em http://localhost:${PORT}`);
  console.log(`Serviço de preços (Java) esperado em ${PRICING_URL}`);
});
