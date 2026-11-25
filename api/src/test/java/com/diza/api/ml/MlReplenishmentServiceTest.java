package com.diza.api.ml;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNull;
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
    void conservaProbabilidadSiCoincideElStock() {
        var prediction = new ReplenishmentResponse("P002", "Arroz", "Abarrotes", 29, 18, 9, 0, "VERDE", 0.42, "MEDIO", 22.5);
        var result = MlReplenishmentService.recalculate(prediction, "Arroz", new BigDecimal("29"), new BigDecimal("18"));
        assertEquals(0.42, result.stockoutProbability(), 1e-9);
        assertEquals("MEDIO", result.stockoutRiskLevel());
    }

    @Test
    void invalidaProbabilidadCuandoCambiaStockOMinimo() {
        var prediction = new ReplenishmentResponse("P002", "Arroz", "Abarrotes", 29, 18, 9, 0, "VERDE", 0.42, "MEDIO", 22.5);
        var result = MlReplenishmentService.recalculate(prediction, "Arroz", BigDecimal.ZERO, new BigDecimal("18"));
        assertNull(result.stockoutProbability());
        assertNull(result.stockoutRiskLevel());
        assertEquals("ROJO", result.alertStatus());
        var changedMinimum = MlReplenishmentService.recalculate(prediction, "Arroz", new BigDecimal("29"), new BigDecimal("20"));
        assertNull(changedMinimum.stockoutProbability());
    }

    @Test
    void rechazaValoresInvalidos() {
        assertThrows(IllegalArgumentException.class, () ->
            MlReplenishmentService.recalculate(predicted("P002", Double.NaN),
                "Arroz", BigDecimal.ONE, BigDecimal.ONE));
    }
}
