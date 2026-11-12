package com.diza.api.product;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record LoteInicialRequest(
    @NotBlank(message = "El código de lote es obligatorio")
    String codigoLote,

    @NotNull(message = "La cantidad inicial es obligatoria")
    @DecimalMin(value = "0.001", message = "La cantidad inicial debe ser mayor a 0")
    BigDecimal cantidad,

    @NotNull(message = "La fecha de vencimiento es obligatoria")
    @Future(message = "La fecha de vencimiento debe ser una fecha futura")
    LocalDate fechaVencimiento
) {}
