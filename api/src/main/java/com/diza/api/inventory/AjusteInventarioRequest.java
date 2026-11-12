package com.diza.api.inventory;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record AjusteInventarioRequest(
    @NotNull(message = "El lote es obligatorio")
    Long loteId,

    @NotNull(message = "La nueva cantidad es obligatoria")
    @DecimalMin(value = "0.000", message = "La cantidad no puede ser negativa")
    BigDecimal nuevaCantidadDisponible,

    @NotBlank(message = "El motivo del ajuste es obligatorio")
    @Size(max = 500, message = "El motivo no puede superar 500 caracteres")
    String motivo
) {}
