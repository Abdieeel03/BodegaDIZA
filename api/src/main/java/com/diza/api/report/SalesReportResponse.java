package com.diza.api.report;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record SalesReportResponse(
    BigDecimal total, BigDecimal historico, BigDecimal operativo,
    long tickets, int productos, int coincidencias, boolean historicoDisponible,
    List<Point> tendencia, List<Row> registros, List<Product> catalogo,
    List<Ranking> ranking, int filas, int pagina, int tamanio
) {
    public record Row(LocalDate fecha, String sku, String nombre, String origen,
                      BigDecimal cantidad, String unidad, BigDecimal importe, BigDecimal stockCierre) {}
    public record Point(LocalDate periodo, BigDecimal historico, BigDecimal operativo) {}
    public record Product(String sku, String nombre) {}
    public record Ranking(String sku, String nombre, BigDecimal importe) {}
}
