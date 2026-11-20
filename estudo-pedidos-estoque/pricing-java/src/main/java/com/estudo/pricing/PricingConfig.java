package com.estudo.pricing;

import com.estudo.pricing.domain.PricingEngine;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registra o motor de preços como bean. A regra de negócio (PricingEngine) fica em Java puro,
 * sem anotações do Spring, o que facilita testá-la isoladamente.
 */
@Configuration
public class PricingConfig {

    @Bean
    public PricingEngine pricingEngine() {
        return new PricingEngine();
    }
}
