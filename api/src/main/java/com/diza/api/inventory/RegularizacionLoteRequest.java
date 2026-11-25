package com.diza.api.inventory;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/** cantidad == stock actual corrige el lote; una cantidad menor crea un lote hijo. */
public record RegularizacionLoteRequest(
    @NotNull Long loteId,
    @NotNull Long version,
    @NotNull @DecimalMin("0.001") @Digits(integer = 9, fraction = 3) BigDecimal cantidad,
    @Size(max = 100) String nuevoCodigoLote,
    @NotNull @Valid VencimientoRequest vencimiento,
    @NotBlank @Size(max = 500) String motivo
) {}
