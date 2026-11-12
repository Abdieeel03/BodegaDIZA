package com.diza.api.purchase;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CompraRequest(
    @NotNull(message = "El proveedor es obligatorio")
    Long proveedorId,

    @NotEmpty(message = "La compra debe tener al menos un ítem")
    @Valid
    List<ItemCompraRequest> items
) {}
