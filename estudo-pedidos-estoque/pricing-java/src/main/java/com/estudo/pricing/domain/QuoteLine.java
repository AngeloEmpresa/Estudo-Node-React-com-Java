package com.estudo.pricing.domain;

/** Resultado do cálculo para um item do carrinho. */
public record QuoteLine(
        long productId,
        int quantity,
        long unitPriceCents,
        long grossCents,
        long volumeDiscountCents,
        long lineTotalCents) {
}
