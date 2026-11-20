const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// A API trabalha em centavos (inteiros); a conversão para reais acontece só na tela.
export const brl = (cents) => currency.format(cents / 100);

export const centsToInput = (cents) => (cents / 100).toFixed(2).replace('.', ',');

// Aceita "49,90", "49.90" e "1.234,56". Retorna null se o valor for inválido.
export function parsePriceToCents(text) {
  const raw = String(text).trim();
  if (!raw) return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export const formatDate = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
