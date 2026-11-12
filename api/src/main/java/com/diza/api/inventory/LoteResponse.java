package com.diza.api.inventory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public record LoteResponse(
    Long id,
    Long productoId,
    String productoNombre,
    String productoSku,
    String codigoLote,
    BigDecimal cantidadDisponible,
    LocalDate fechaIngreso,
    LocalDate fechaVencimiento,
    boolean vencido,
    long diasParaVencer
) {
    public static LoteResponse from(LoteProducto lote) {
        LocalDate hoy = LocalDate.now();
        boolean vencido = lote.getFechaVencimiento().isBefore(hoy);
        long dias = ChronoUnit.DAYS.between(hoy, lote.getFechaVencimiento());

        return new LoteResponse(
            lote.getId(),
            lote.getProducto().getId(),
            lote.getProducto().getNombre(),
            lote.getProducto().getSku(),
            lote.getCodigoLote(),
            lote.getCantidadDisponible(),
            lote.getFechaIngreso(),
            lote.getFechaVencimiento(),
            vencido,
            dias
        );
    }
}
