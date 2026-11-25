package com.diza.api.inventory;

import jakarta.validation.constraints.*;

public record PoliticaVencimientoRequest(
    @NotNull Long productoId,
    @NotNull Boolean permiteSinVencimiento,
    @NotBlank @Size(max = 500) String motivo
) {}
