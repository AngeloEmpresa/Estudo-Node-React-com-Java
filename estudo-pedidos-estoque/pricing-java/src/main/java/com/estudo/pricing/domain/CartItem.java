package com.estudo.pricing.domain;

/** Item recebido para cálculo. Valores monetários sempre em centavos (long) para evitar erros de ponto flutuante. */
public record CartItem(long productId, long unitPriceCents, int quantity) {
}
