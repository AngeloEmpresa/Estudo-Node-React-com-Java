package com.estudo.pricing.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Corpo da requisição de POST /api/quotes. */
public record QuoteRequest(
        @Size(max = 30) String coupon,
        @NotEmpty @Size(max = 50) List<@Valid ItemRequest> items) {

    public record ItemRequest(
            @NotNull Long productId,
            @Min(0) long unitPriceCents,
            @Min(1) @Max(1000) int quantity) {
    }
}
