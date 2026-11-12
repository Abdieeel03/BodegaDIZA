package com.diza.api.inventory;

import java.math.BigDecimal;

public record AlertaBajoStockResponse(
    Long productoId,
    String sku,
    String nombre,
    BigDecimal stockActual,
    BigDecimal stockMinimo,
    BigDecimal deficit,
    String unidadMedida
) {}
