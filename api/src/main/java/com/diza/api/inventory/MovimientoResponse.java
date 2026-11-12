package com.diza.api.inventory;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record MovimientoResponse(
    Long id,
    Long productoId,
    String productoNombre,
    String productoSku,
    Long loteId,
    String codigoLote,
    TipoMovimientoInventario tipo,
    BigDecimal cantidad,
    LocalDateTime fecha,
    String motivo,
    String usuarioNombre,
    Long compraId,
    Long ventaId
) {
    public static MovimientoResponse from(MovimientoInventario mov) {
        return new MovimientoResponse(
            mov.getId(),
            mov.getProducto().getId(),
            mov.getProducto().getNombre(),
            mov.getProducto().getSku(),
            mov.getLote() != null ? mov.getLote().getId() : null,
            mov.getLote() != null ? mov.getLote().getCodigoLote() : null,
            mov.getTipo(),
            mov.getCantidad(),
            mov.getFecha(),
            mov.getMotivo(),
            mov.getUsuario().getNombre(),
            mov.getCompra() != null ? mov.getCompra().getId() : null,
            mov.getVenta() != null ? mov.getVenta().getId() : null
        );
    }
}
