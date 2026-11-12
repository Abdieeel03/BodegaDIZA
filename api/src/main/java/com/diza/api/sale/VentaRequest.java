package com.diza.api.sale;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record VentaRequest(
    @NotEmpty(message = "La venta debe incluir al menos un producto")
    @Valid
    List<ItemVentaRequest> items
) {}
