package com.diza.api.purchase;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

public record PedidoCompraRequest(
    @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal presupuesto,
    @NotEmpty @Size(max = 500) List<@NotNull @Valid Item> items
) {
    public record Item(
        @NotBlank @Size(max = 50) String sku,
        @NotBlank @Size(max = 150) String proveedor,
        @NotNull @Min(1) @Max(999999999) Integer cantidad,
        @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2) BigDecimal costoUnitario
    ) {}
}
