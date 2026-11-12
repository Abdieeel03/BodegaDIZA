package com.diza.api.purchase;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ItemCompraRequest(
    @NotNull(message = "El producto es obligatorio")
    Long productoId,

    @NotBlank(message = "El código de lote es obligatorio")
    String codigoLote,

    @NotNull(message = "La cantidad es obligatoria")
    @DecimalMin(value = "0.001", message = "La cantidad debe ser mayor a 0")
    BigDecimal cantidad,

    @NotNull(message = "El costo unitario es obligatorio")
    @DecimalMin(value = "0.00", message = "El costo unitario debe ser mayor o igual a 0")
    BigDecimal costoUnitario,

    @NotNull(message = "La fecha de vencimiento es obligatoria")
    @Future(message = "La fecha de vencimiento debe ser una fecha futura")
    LocalDate fechaVencimiento
) {}
