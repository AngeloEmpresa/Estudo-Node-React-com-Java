package com.estudo.pricing.domain;

import java.util.List;

/** Orçamento completo: itens, descontos, cupom, frete e total. */
public record Quote(
        List<QuoteLine> lines,
        long subtotalCents,
        long volumeDiscountCents,
        String couponCode,
        boolean couponValid,
        String couponMessage,
        long couponDiscountCents,
        long shippingCents,
        long totalCents) {
}
