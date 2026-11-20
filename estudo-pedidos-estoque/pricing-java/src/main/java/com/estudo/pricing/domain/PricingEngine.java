package com.estudo.pricing.domain;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Regras de preço do sistema (tudo em centavos):
 *
 * <ol>
 *   <li>Desconto por quantidade em cada item: 5 ou mais unidades = 5%; 10 ou mais = 10%.</li>
 *   <li>Cupom BEMVINDO10: 10% sobre o valor já com desconto por quantidade, para compras de R$ 50,00 ou mais.</li>
 *   <li>Cupom FRETEGRATIS: zera o frete.</li>
 *   <li>Frete: R$ 19,90, grátis quando o valor após descontos for de R$ 200,00 ou mais.</li>
 * </ol>
 *
 * Cupom inexistente ou fora das condições não gera erro: o orçamento volta com couponValid = false
 * e uma mensagem, e quem chamou decide o que fazer.
 */
public class PricingEngine {

    static final long BEMVINDO10_MIN_CENTS = 5_000;
    static final long FREE_SHIPPING_FROM_CENTS = 20_000;
    static final long FLAT_SHIPPING_CENTS = 1_990;

    public Quote calculate(List<CartItem> items, String couponInput) {
        List<QuoteLine> lines = new ArrayList<>();
        long subtotal = 0;
        long volumeDiscount = 0;

        for (CartItem item : items) {
            long gross = item.unitPriceCents() * item.quantity();
            long discount = percentOf(gross, volumeDiscountPercent(item.quantity()));
            lines.add(new QuoteLine(
                    item.productId(), item.quantity(), item.unitPriceCents(),
                    gross, discount, gross - discount));
            subtotal += gross;
            volumeDiscount += discount;
        }

        long afterVolume = subtotal - volumeDiscount;

        String coupon = normalize(couponInput);
        boolean couponValid = true;
        String couponMessage = null;
        long couponDiscount = 0;
        boolean freeShippingCoupon = false;

        if (coupon != null) {
            switch (coupon) {
                case "BEMVINDO10" -> {
                    if (afterVolume >= BEMVINDO10_MIN_CENTS) {
                        couponDiscount = percentOf(afterVolume, 10);
                        couponMessage = "Cupom aplicado: 10% de desconto.";
                    } else {
                        couponValid = false;
                        couponMessage = "O cupom BEMVINDO10 exige compras a partir de R$ 50,00.";
                    }
                }
                case "FRETEGRATIS" -> {
                    freeShippingCoupon = true;
                    couponMessage = "Cupom aplicado: frete grátis.";
                }
                default -> {
                    couponValid = false;
                    couponMessage = "Cupom inexistente.";
                }
            }
        }

        long amountAfterDiscounts = afterVolume - couponDiscount;
        long shipping = shippingFor(items.isEmpty(), amountAfterDiscounts, freeShippingCoupon);
        long total = amountAfterDiscounts + shipping;

        return new Quote(lines, subtotal, volumeDiscount, coupon, couponValid,
                couponMessage, couponDiscount, shipping, total);
    }

    private static long shippingFor(boolean emptyCart, long amountAfterDiscounts, boolean freeShippingCoupon) {
        if (emptyCart || freeShippingCoupon || amountAfterDiscounts >= FREE_SHIPPING_FROM_CENTS) {
            return 0;
        }
        return FLAT_SHIPPING_CENTS;
    }

    private static int volumeDiscountPercent(int quantity) {
        if (quantity >= 10) return 10;
        if (quantity >= 5) return 5;
        return 0;
    }

    /** Percentual inteiro com arredondamento "meio para cima" (HALF_UP), usando só aritmética de inteiros. */
    private static long percentOf(long amountCents, int percent) {
        return (amountCents * percent + 50) / 100;
    }

    private static String normalize(String coupon) {
        if (coupon == null || coupon.isBlank()) return null;
        return coupon.trim().toUpperCase(Locale.ROOT);
    }
}
