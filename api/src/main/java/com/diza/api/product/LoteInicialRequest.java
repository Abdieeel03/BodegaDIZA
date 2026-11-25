package com.diza.api.product;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record LoteInicialRequest(
    @NotBlank(message = "El código de lote es obligatorio")
    String codigoLote,

    @NotNull(message = "La cantidad inicial es obligatoria")
    @DecimalMin(value = "0.001", message = "La cantidad inicial debe ser mayor a 0")
    @jakarta.validation.constraints.Digits(integer = 9, fraction = 3)
    BigDecimal cantidad,

    LocalDate fechaVencimiento,
    @jakarta.validation.Valid com.diza.api.inventory.VencimientoRequest vencimiento
) {
    public LoteInicialRequest(String codigoLote, BigDecimal cantidad, LocalDate fechaVencimiento) {
        this(codigoLote, cantidad, fechaVencimiento, null);
    }
}
