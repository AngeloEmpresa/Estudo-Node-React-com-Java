import { HttpError } from './errors.js';

// Cliente HTTP do serviço de preços (Java). Centraliza timeout e tratamento de falhas,
// para que o resto da API não precise saber se o serviço está fora do ar.
export function createPricingClient({ baseUrl, timeoutMs = 3000, fetchImpl = fetch }) {
  async function request(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new HttpError(503, 'O serviço de preços está indisponível. Tente novamente em instantes.');
    }

    if (!response.ok) {
      throw new HttpError(502, `O serviço de preços respondeu com erro (${response.status}).`);
    }
    return response.json();
  }

  return {
    quote: ({ items, coupon }) =>
      request('/api/quotes', {
        method: 'POST',
        body: JSON.stringify({ coupon: coupon ?? null, items }),
      }),
    health: () => request('/api/health'),
  };
}
