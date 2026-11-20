// Camada de acesso à API. Os componentes não usam fetch diretamente.

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Não foi possível conectar à API. Ela está rodando?', 0);
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.error ?? `Erro inesperado (${response.status}).`, response.status, data?.details);
  }
  return data;
}

export const api = {
  health: () => request('/health'),

  products: {
    list: ({ search = '', onlyActive = false } = {}) =>
      request(`/products?search=${encodeURIComponent(search)}&onlyActive=${onlyActive}`),
    create: (body) => request('/products', { method: 'POST', body }),
    update: (id, body) => request(`/products/${id}`, { method: 'PUT', body }),
    remove: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  },

  orders: {
    list: () => request('/orders'),
    quote: (body) => request('/orders/quote', { method: 'POST', body }),
    create: (body) => request('/orders', { method: 'POST', body }),
    cancel: (id) => request(`/orders/${id}/cancel`, { method: 'POST' }),
  },
};
