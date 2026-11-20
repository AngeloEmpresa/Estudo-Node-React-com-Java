package com.estudo.pricing.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;

class PricingEngineTest {

    private final PricingEngine engine = new PricingEngine();

    private static List<CartItem> one(long unitPriceCents, int quantity) {
        return List.of(new CartItem(1L, unitPriceCents, quantity));
    }

    @Test
    void semDescontoCobraFreteFixo() {
        Quote quote = engine.calculate(one(1_000, 2), null);

        assertEquals(2_000, quote.subtotalCents());
        assertEquals(0, quote.volumeDiscountCents());
        assertEquals(1_990, quote.shippingCents());
        assertEquals(3_990, quote.totalCents());
        assertTrue(quote.couponValid());
        assertNull(quote.couponCode());
    }

    @Test
    void cincoUnidadesGanhamCincoPorCento() {
        Quote quote = engine.calculate(one(1_000, 5), null);

        assertEquals(5_000, quote.subtotalCents());
        assertEquals(250, quote.volumeDiscountCents());
        assertEquals(4_750, quote.lines().get(0).lineTotalCents());
        assertEquals(6_740, quote.totalCents());
    }

    @Test
    void dezUnidadesGanhamDezPorCentoEFreteGratisAcimaDeDuzentosReais() {
        Quote quote = engine.calculate(one(3_000, 10), null);

        assertEquals(3_000, quote.volumeDiscountCents());
        assertEquals(0, quote.shippingCents());
        assertEquals(27_000, quote.totalCents());
    }

    @Test
    void descontoArredondaMeioParaCima() {
        // 5 x 110 = 550; 5% = 27,5 -> 28
        Quote quote = engine.calculate(one(110, 5), null);
        assertEquals(28, quote.volumeDiscountCents());
    }

    @Test
    void cupomBemvindo10AplicaDezPorCento() {
        Quote quote = engine.calculate(one(10_000, 1), "BEMVINDO10");

        assertTrue(quote.couponValid());
        assertEquals(1_000, quote.couponDiscountCents());
        assertEquals(10_990, quote.totalCents());
    }

    @Test
    void cupomBemvindo10ExigeValorMinimo() {
        Quote quote = engine.calculate(one(4_000, 1), "BEMVINDO10");

        assertFalse(quote.couponValid());
        assertEquals(0, quote.couponDiscountCents());
        assertEquals(5_990, quote.totalCents());
    }

    @Test
    void cupomFreteGratisZeraOFrete() {
        Quote quote = engine.calculate(one(2_000, 1), "FRETEGRATIS");

        assertTrue(quote.couponValid());
        assertEquals(0, quote.shippingCents());
        assertEquals(2_000, quote.totalCents());
    }

    @Test
    void cupomInexistenteEInvalido() {
        Quote quote = engine.calculate(one(2_000, 1), "XYZ");

        assertFalse(quote.couponValid());
        assertEquals("Cupom inexistente.", quote.couponMessage());
        assertEquals(3_990, quote.totalCents());
    }

    @Test
    void cupomIgnoraMaiusculasEEspacos() {
        Quote quote = engine.calculate(one(10_000, 1), "  bemvindo10 ");

        assertEquals("BEMVINDO10", quote.couponCode());
        assertTrue(quote.couponValid());
    }
}
