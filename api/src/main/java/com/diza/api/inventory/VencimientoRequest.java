package com.diza.api.inventory;

import com.diza.api.common.BusinessException;
import com.diza.api.product.Producto;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.YearMonth;

/** MES_ANIO conserva la etiqueta; sin significado confirmado no habilita la venta. */
public record VencimientoRequest(
    @NotNull PrecisionVencimiento precision,
    LocalDate fecha,
    String mes
) {
    public void validar(Producto producto) {
        if (precision == null) throw new BusinessException("Indica la precisión del vencimiento");
        switch (precision) {
            case EXACTA -> {
                if (fecha == null || mes != null) throw new BusinessException("La fecha exacta requiere únicamente día, mes y año");
            }
            case MES_ANIO -> {
                if (fecha != null || mes == null || !mes.matches("[0-9]{4}-(0[1-9]|1[0-2])"))
                    throw new BusinessException("Indica únicamente mes y año (AAAA-MM)");
                try { YearMonth.parse(mes); }
                catch (java.time.DateTimeException ex) { throw new BusinessException("Mes y año inválidos"); }
            }
            case PENDIENTE, NO_APLICA -> {
                if (fecha != null || mes != null) throw new BusinessException("Este estado no admite una fecha inventada");
                if (precision == PrecisionVencimiento.NO_APLICA && !producto.isPermiteSinVencimiento())
                    throw new BusinessException("El producto requiere vencimiento; un administrador debe justificar su política antes de usar No aplica");
            }
        }
    }

    public static VencimientoRequest resolver(LocalDate fechaAnterior, VencimientoRequest vencimiento) {
        if (vencimiento != null && fechaAnterior != null)
            throw new BusinessException("Envía fechaVencimiento o vencimiento, no ambos");
        return vencimiento != null ? vencimiento : new VencimientoRequest(
            fechaAnterior == null ? PrecisionVencimiento.PENDIENTE : PrecisionVencimiento.EXACTA, fechaAnterior, null);
    }
}
