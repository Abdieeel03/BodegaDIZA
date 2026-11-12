package com.diza.api.sale;

import java.math.BigDecimal;

public record ProductoVendidoResumen(
    Long productoId,
    String productoNombre,
    String productoSku,
    BigDecimal cantidadVendida,
    BigDecimal totalVendido
) {}
