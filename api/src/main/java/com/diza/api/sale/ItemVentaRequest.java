package com.diza.api.sale;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record ItemVentaRequest(
    @NotNull(message = "El producto es obligatorio")
    Long productoId,

    @NotNull(message = "La cantidad es obligatoria")
    @DecimalMin(value = "0.001", message = "La cantidad debe ser mayor a 0")
    BigDecimal cantidad,

    Long loteId,

    @DecimalMin(value = "0.00", message = "El precio unitario debe ser mayor o igual a 0")
    BigDecimal precioUnitario
) {}
