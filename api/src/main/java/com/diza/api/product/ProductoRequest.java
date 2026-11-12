package com.diza.api.product;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record ProductoRequest(
    @NotBlank(message = "El SKU es obligatorio")
    @Size(max = 50, message = "El SKU no puede exceder 50 caracteres")
    String sku,

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 150, message = "El nombre no puede exceder 150 caracteres")
    String nombre,

    @Size(max = 500, message = "La descripción no puede exceder 500 caracteres")
    String descripcion,

    @NotNull(message = "La categoría es obligatoria")
    Long categoriaId,

    @NotNull(message = "El proveedor es obligatorio")
    Long proveedorId,

    @NotNull(message = "El precio de venta es obligatorio")
    @DecimalMin(value = "0.00", message = "El precio de venta debe ser mayor o igual a 0")
    BigDecimal precioVenta,

    @NotNull(message = "El stock mínimo es obligatorio")
    @DecimalMin(value = "0.000", message = "El stock mínimo debe ser mayor o igual a 0")
    BigDecimal stockMinimo,

    @NotNull(message = "La unidad de medida es obligatoria")
    UnidadMedida unidadMedida,

    @Valid
    LoteInicialRequest loteInicial
) {}
