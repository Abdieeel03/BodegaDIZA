package com.diza.api.purchase;

import java.math.BigDecimal;

public record DetalleCompraResponse(
    Long id,
    Long productoId,
    String productoNombre,
    String productoSku,
    Long loteId,
    String codigoLote,
    BigDecimal cantidad,
    BigDecimal costoUnitario,
    BigDecimal subtotal
) {
    public static DetalleCompraResponse from(DetalleCompra detalle) {
        return new DetalleCompraResponse(
            detalle.getId(),
            detalle.getProducto().getId(),
            detalle.getProducto().getNombre(),
            detalle.getProducto().getSku(),
            detalle.getLote().getId(),
            detalle.getLote().getCodigoLote(),
            detalle.getCantidad(),
            detalle.getCostoUnitario(),
            detalle.getSubtotal()
        );
    }
}
