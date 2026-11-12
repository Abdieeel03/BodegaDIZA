package com.diza.api.purchase;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record CompraResponse(
    Long id,
    Long proveedorId,
    String proveedorNombre,
    String proveedorRuc,
    LocalDateTime fecha,
    EstadoCompra estado,
    BigDecimal total,
    List<DetalleCompraResponse> detalles
) {
    public static CompraResponse of(Compra compra, List<DetalleCompra> detalles) {
        List<DetalleCompraResponse> itemResponses = detalles != null
            ? detalles.stream().map(DetalleCompraResponse::from).toList()
            : List.of();

        return new CompraResponse(
            compra.getId(),
            compra.getProveedor().getId(),
            compra.getProveedor().getNombre(),
            compra.getProveedor().getRuc(),
            compra.getFecha(),
            compra.getEstado(),
            compra.getTotal(),
            itemResponses
        );
    }
}
