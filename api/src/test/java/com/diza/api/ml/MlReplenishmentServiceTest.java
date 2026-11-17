package com.diza.api.ml;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class MlReplenishmentServiceTest {
    private static ReplenishmentResponse predicted(String id, double demand) {
        return new ReplenishmentResponse(id, "Nombre ML", "Abarrotes",
            29, 18, demand, 0, "VERDE");
    }

    @Test
    void arrozUsaStockDePostgresNoElDelCsv() {
        var result = MlReplenishmentService.recalculate(predicted("P002", 9.174),
            "Arroz 1kg", new BigDecimal("17"), new BigDecimal("18"));
        assertEquals(17.0, result.stockActual());
        assertEquals(11.0, result.recommendedReplenishment());
        assertEquals("ROJO", result.alertStatus());
    }

    @Test
    void entradaEnInventarioReduceLaReposicion() {
        var result = MlReplenishmentService.recalculate(predicted("P002", 9.174),
            "Arroz 1kg", new BigDecimal("29"), new BigDecimal("18"));
        assertEquals(0.0, result.recommendedReplenishment());
        assertEquals("VERDE", result.alertStatus());
    }

    @Test
    void redondeaHaciaArribaParaUnidadesEnteras() {
        var result = MlReplenishmentService.recalculate(predicted("P012", 9.973),
            "Galletas de soda", new BigDecimal("25"), new BigDecimal("16"));
        assertEquals(1.0, result.recommendedReplenishment());
        assertEquals("AMARILLO", result.alertStatus());
    }

    @Test
    void rechazaValoresInvalidos() {
        assertThrows(IllegalArgumentException.class, () ->
            MlReplenishmentService.recalculate(predicted("P002", Double.NaN),
                "Arroz", BigDecimal.ONE, BigDecimal.ONE));
    }
}
