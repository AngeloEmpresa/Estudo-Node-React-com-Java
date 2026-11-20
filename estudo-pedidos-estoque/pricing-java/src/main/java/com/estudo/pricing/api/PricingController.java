package com.estudo.pricing.api;

import com.estudo.pricing.domain.CartItem;
import com.estudo.pricing.domain.PricingEngine;
import com.estudo.pricing.domain.Quote;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PricingController {

    private final PricingEngine engine;

    public PricingController(PricingEngine engine) {
        this.engine = engine;
    }

    @PostMapping("/quotes")
    public Quote quote(@Valid @RequestBody QuoteRequest request) {
        List<CartItem> items = request.items().stream()
                .map(item -> new CartItem(item.productId(), item.unitPriceCents(), item.quantity()))
                .toList();
        return engine.calculate(items, request.coupon());
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "UP", "service", "pricing-java");
    }
}
