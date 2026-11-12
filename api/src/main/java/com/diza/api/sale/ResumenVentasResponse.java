package com.diza.api.sale;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record ResumenVentasResponse(
    long totalVentas,
    BigDecimal ingresosTotales,
    BigDecimal ticketPromedio,
    LocalDateTime desde,
    LocalDateTime hasta,
    List<ProductoVendidoResumen> topProductos
) {}
