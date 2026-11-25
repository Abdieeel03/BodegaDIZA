package com.diza.api.purchase;

import com.diza.api.inventory.VencimientoRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public record RecepcionPedidoRequest(@NotEmpty @Size(max = 1000) List<@NotNull @Valid Lote> lotes) {
    public record Lote(
        @NotNull Long productoId,
        @NotBlank @Size(max = 100) String codigoLote,
        @NotNull @Min(1) @Max(999999999) Integer cantidad,
        @NotNull @Valid VencimientoRequest vencimiento
    ) {}
}
