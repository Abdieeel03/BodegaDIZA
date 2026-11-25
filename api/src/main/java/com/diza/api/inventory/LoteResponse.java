package com.diza.api.inventory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public record LoteResponse(
    Long id, Long productoId, String productoNombre, String productoSku, String productoCategoria,
    String codigoLote, BigDecimal cantidadDisponible, LocalDate fechaIngreso, LocalDate fechaVencimiento,
    boolean vencido, Long diasParaVencer, PrecisionVencimiento precisionVencimiento, String mesVencimiento,
    boolean vendible, String estadoVencimiento, boolean fechaHeredada, String advertencia,
    long version, boolean permiteSinVencimiento
) {
    public static LoteResponse from(LoteProducto lote) {
        LocalDate hoy = LocalDate.now(java.time.ZoneId.of("America/Lima"));
        var dato = lote.vencimientoActual();
        Long dias = dato.precision() == PrecisionVencimiento.EXACTA && dato.fecha() != null
            ? ChronoUnit.DAYS.between(hoy, dato.fecha()) : null;
        String estado = dias == null ? (dato.precision() == PrecisionVencimiento.NO_APLICA ? "NO_APLICA" : "PENDIENTE")
            : dias < 0 ? "VENCIDO" : dias == 0 ? "HOY" : dias <= 3 ? "CRITICO" : dias <= 7 ? "PROXIMO"
            : dias <= 30 ? "PREVENTIVO" : "SEGUIMIENTO";
        String aviso = dato.precision() == PrecisionVencimiento.MES_ANIO
            ? "Mes/año conservado. Pendiente de verificar un límite seguro; no vendible."
            : lote.isFechaHeredada() && dato.fecha() != null && (dato.fecha().getDayOfMonth() == 1 || dato.fecha().getDayOfYear() == dato.fecha().lengthOfYear())
            ? "Fecha histórica potencialmente genérica: verificar etiqueta, sin asumir que sea incorrecta."
            : lote.isFechaHeredada() ? "Fecha histórica conservada; pendiente de revisión explícita." : null;
        return new LoteResponse(lote.getId(), lote.getProducto().getId(), lote.getProducto().getNombre(),
            lote.getProducto().getSku(), lote.getProducto().getCategoria().getNombre(), lote.getCodigoLote(),
            lote.getCantidadDisponible(), lote.getFechaIngreso(), dato.fecha(), dias != null && dias < 0, dias,
            dato.precision(), dato.mes(), lote.esVendible(hoy), estado, lote.isFechaHeredada(), aviso,
            lote.getVersion(), lote.getProducto().isPermiteSinVencimiento());
    }
}
