package com.diza.api.sale;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record VentaResponse(
    Long id,
    LocalDateTime fecha,
    BigDecimal total,
    Long usuarioId,
    String usuarioNombre,
    List<DetalleVentaResponse> detalles
) {
    public static VentaResponse of(Venta venta, List<DetalleVenta> detalles) {
        List<DetalleVentaResponse> items = detalles != null
            ? detalles.stream().map(DetalleVentaResponse::from).toList()
            : List.of();

        return new VentaResponse(
            venta.getId(),
            venta.getFecha(),
            venta.getTotal(),
            venta.getUsuario().getId(),
            venta.getUsuario().getNombre(),
            items
        );
    }
}
