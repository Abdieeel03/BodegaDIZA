package com.diza.api.sale;

import java.math.BigDecimal;

public record DetalleVentaResponse(
    Long id,
    Long productoId,
    String productoNombre,
    String productoSku,
    Long loteId,
    String codigoLote,
    BigDecimal cantidad,
    BigDecimal precioUnitario,
    BigDecimal subtotal
) {
    public static DetalleVentaResponse from(DetalleVenta detalle) {
        return new DetalleVentaResponse(
            detalle.getId(),
            detalle.getProducto().getId(),
            detalle.getProducto().getNombre(),
            detalle.getProducto().getSku(),
            detalle.getLote().getId(),
            detalle.getLote().getCodigoLote(),
            detalle.getCantidad(),
            detalle.getPrecioUnitario(),
            detalle.getSubtotal()
        );
    }
}
