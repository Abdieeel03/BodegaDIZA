package com.diza.api.inventory;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record EntradaInventarioRequest(
    @NotNull(message = "El producto es obligatorio")
    Long productoId,

    @NotBlank(message = "El código de lote es obligatorio")
    @Size(max = 100, message = "El código de lote no puede superar 100 caracteres")
    String codigoLote,

    @NotNull(message = "La cantidad es obligatoria")
    @DecimalMin(value = "0.001", message = "La cantidad debe ser mayor a 0")
    BigDecimal cantidad,

    @NotNull(message = "La fecha de vencimiento es obligatoria")
    @Future(message = "La fecha de vencimiento debe ser una fecha futura")
    LocalDate fechaVencimiento,

    @Size(max = 500, message = "El motivo no puede superar los 500 caracteres")
    String motivo
) {}
