package com.diza.api.report;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Consulta analítica: nunca crea tickets, importa datos ni modifica existencias. */
@Service
public class SalesReportService {
    private record DaySku(LocalDate fecha, String sku) {}
    private final JdbcTemplate jdbc;
    public SalesReportService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    private static final String OPERATIONAL = """
        select cast(v.fecha as date) as fecha, p.sku, p.nombre, 'operativo' as origen,
               sum(d.cantidad) as cantidad, p.unidad_medida as unidad,
               sum(d.subtotal) as importe, cast(null as numeric) as stock_cierre
        from public.ventas v
        join public.detalles_venta d on d.venta_id = v.id
        join public.productos p on p.id = d.producto_id
        group by cast(v.fecha as date), p.sku, p.nombre, p.unidad_medida
        """;
    private static final String HISTORICAL = """
        select fecha, id_producto as sku, nombre_producto as nombre, 'historico' as origen,
               cantidad_vendida as cantidad, cast(null as varchar) as unidad,
               cantidad_vendida * precio_venta_unitario as importe, stock_final_dia as stock_cierre
        from staging_diza.ventas_csv
        """;

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public SalesReportResponse get(LocalDate desde, LocalDate hasta, String sku, String origen,
                                   String agrupacion, int pagina, int tamanio) {
        if (desde != null && hasta != null && desde.isAfter(hasta))
            throw new IllegalArgumentException("La fecha inicial debe ser anterior o igual a la final.");
        if (!Set.of("todos", "historico", "operativo").contains(origen))
            throw new IllegalArgumentException("Origen de ventas no válido.");
        if (!Set.of("dia", "semana", "mes").contains(agrupacion))
            throw new IllegalArgumentException("Agrupación no válida.");
        if (pagina < 0 || pagina > 100000 || tamanio < 1 || tamanio > 100)
            throw new IllegalArgumentException("Paginación no válida.");

        boolean hasHistory = jdbc.queryForObject("""
            select count(*) from information_schema.tables
            where lower(table_schema) = 'staging_diza' and lower(table_name) = 'ventas_csv'
            """, Integer.class) > 0;
        String source = OPERATIONAL + (hasHistory ? " union all " + HISTORICAL : "");
        StringBuilder where = new StringBuilder(" where 1=1");
        List<Object> args = new ArrayList<>();
        if (desde != null) { where.append(" and fecha >= ?"); args.add(Date.valueOf(desde)); }
        if (hasta != null) { where.append(" and fecha <= ?"); args.add(Date.valueOf(hasta)); }
        if (sku != null && !sku.isBlank()) { where.append(" and sku = ?"); args.add(sku.trim()); }
        if (!origen.equals("todos")) { where.append(" and origen = ?"); args.add(origen); }
        // Primero se agregan los detalles por día/producto. La página nunca limita los indicadores.
        List<SalesReportResponse.Row> sourceRows = jdbc.query("select * from (" + source + ") sales" + where
            + " order by fecha desc, sku, origen", (rs, n) -> new SalesReportResponse.Row(
                rs.getDate("fecha").toLocalDate(), rs.getString("sku"), rs.getString("nombre"),
                rs.getString("origen"), rs.getBigDecimal("cantidad"), rs.getString("unidad"),
                rs.getBigDecimal("importe"), rs.getBigDecimal("stock_cierre")), args.toArray());

        // El staging conocido contiene la importación histórica de estas ventas.
        // Una coincidencia única en fecha/SKU/cantidad/importe se cuenta una vez.
        // Las coincidencias ambiguas no se resuelven por aproximación.
        Map<DaySku, List<SalesReportResponse.Row>> byDaySku = new LinkedHashMap<>();
        for (var row : sourceRows) {
            byDaySku.computeIfAbsent(new DaySku(row.fecha(), row.sku()), key -> new ArrayList<>()).add(row);
        }
        Set<DaySku> reconciled = new HashSet<>();
        int overlaps = 0, conflicts = 0;
        if (origen.equals("todos")) {
            for (var entry : byDaySku.entrySet()) {
                var historicRows = entry.getValue().stream().filter(row -> row.origen().equals("historico")).toList();
                var operationalRows = entry.getValue().stream().filter(row -> row.origen().equals("operativo")).toList();
                boolean overlap = !historicRows.isEmpty() && !operationalRows.isEmpty();
                if (overlap) overlaps++;
                if (historicRows.size() > 1 || operationalRows.size() > 1) {
                    conflicts++;
                } else if (overlap) {
                    var h = historicRows.getFirst();
                    var o = operationalRows.getFirst();
                    if (h.cantidad() != null && o.cantidad() != null && h.importe() != null && o.importe() != null
                        && h.cantidad().compareTo(o.cantidad()) == 0 && h.importe().compareTo(o.importe()) == 0) {
                        reconciled.add(entry.getKey());
                    } else {
                        conflicts++;
                    }
                }
            }
        }
        // No se modifica ninguna fuente. Los filtros de origen siguen devolviendo los datos de esa fuente.
        List<SalesReportResponse.Row> rows = sourceRows.stream().filter(row ->
            !row.origen().equals("historico") || !reconciled.contains(new DaySku(row.fecha(), row.sku()))).toList();
        Map<LocalDate, BigDecimal[]> trend = new TreeMap<>();
        Map<String, SalesReportResponse.Ranking> ranking = new HashMap<>();
        BigDecimal historical = BigDecimal.ZERO, operational = BigDecimal.ZERO;
        for (var row : rows) {
            boolean historic = row.origen().equals("historico");
            if (historic) historical = historical.add(row.importe());
            else operational = operational.add(row.importe());
            LocalDate period = switch (agrupacion) {
                case "mes" -> row.fecha().withDayOfMonth(1);
                case "semana" -> row.fecha().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
                default -> row.fecha();
            };
            BigDecimal[] amounts = trend.computeIfAbsent(period, key -> new BigDecimal[]{null, null});
            int index = historic ? 0 : 1;
            amounts[index] = (amounts[index] == null ? BigDecimal.ZERO : amounts[index]).add(row.importe());
            ranking.compute(row.sku(), (key, previous) -> new SalesReportResponse.Ranking(
                key, row.nombre(), row.importe().add(previous == null ? BigDecimal.ZERO : previous.importe())));
        }
        // Si quedan conflictos no se publica una serie consolidada ni un ranking parcial engañoso.
        BigDecimal total = conflicts == 0 ? historical.add(operational) : null;
        var points = conflicts == 0 ? trend.entrySet().stream()
            .map(e -> new SalesReportResponse.Point(e.getKey(), e.getValue()[0], e.getValue()[1])).toList()
            : List.<SalesReportResponse.Point>of();
        var top = conflicts == 0 ? ranking.values().stream()
            .sorted(Comparator.comparing(SalesReportResponse.Ranking::importe).reversed()
                .thenComparing(SalesReportResponse.Ranking::sku)).limit(5).toList() : List.<SalesReportResponse.Ranking>of();
        String catalogSql = "select sku, max(nombre) as nombre from (select sku, nombre from public.productos"
            + (hasHistory ? " union all select id_producto as sku, nombre_producto as nombre from staging_diza.ventas_csv" : "")
            + ") catalog group by sku order by nombre, sku";
        var catalog = jdbc.query(catalogSql, (rs, n) -> new SalesReportResponse.Product(rs.getString("sku"), rs.getString("nombre")));

        // COUNT DISTINCT evita contar varias veces un ticket con varios productos o lotes.
        StringBuilder ticketsSql = new StringBuilder("select count(distinct v.id) from public.ventas v join public.detalles_venta d on d.venta_id=v.id join public.productos p on p.id=d.producto_id where 1=1");
        List<Object> ticketArgs = new ArrayList<>();
        if (desde != null) { ticketsSql.append(" and cast(v.fecha as date) >= ?"); ticketArgs.add(Date.valueOf(desde)); }
        if (hasta != null) { ticketsSql.append(" and cast(v.fecha as date) <= ?"); ticketArgs.add(Date.valueOf(hasta)); }
        if (sku != null && !sku.isBlank()) { ticketsSql.append(" and p.sku = ?"); ticketArgs.add(sku.trim()); }
        long tickets = origen.equals("historico") ? 0 : jdbc.queryForObject(ticketsSql.toString(), Long.class, ticketArgs.toArray());
        int lastPage = Math.max(0, (rows.size() - 1) / tamanio);
        int actualPage = Math.min(pagina, lastPage);
        int start = actualPage * tamanio;
        return new SalesReportResponse(total, historical, operational, tickets, ranking.size(), overlaps, reconciled.size(), conflicts, hasHistory,
            points, rows.subList(start, Math.min(start + tamanio, rows.size())), catalog, top, rows.size(), actualPage, tamanio);
    }
}
