package com.diza.api.report;

import static org.assertj.core.api.Assertions.*;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class SalesReportServiceTest {
    private JdbcTemplate jdbc;
    private SalesReportService service;

    @BeforeEach
    void setup() {
        jdbc = new JdbcTemplate(new DriverManagerDataSource(
            "jdbc:h2:mem:report_" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", ""));
        jdbc.execute("create table productos(id bigint primary key, sku varchar(50), nombre varchar(150), unidad_medida varchar(20), activo boolean)");
        jdbc.execute("create table ventas(id bigint primary key, fecha timestamp, total numeric(12,2))");
        jdbc.execute("create table detalles_venta(id bigint primary key, venta_id bigint, producto_id bigint, cantidad numeric(12,3), subtotal numeric(12,2))");
        jdbc.update("insert into productos values (1, 'P001', 'Arroz', 'KILOGRAMO', false), (2, 'P002', 'Leche', 'LATA', true)");
        jdbc.update("insert into ventas values (1, '2026-11-16 23:59:00', 23), (2, '2026-11-17 00:00:00', 8)");
        // Un ticket, dos lotes de arroz y otro producto. El precio cobrado puede variar.
        jdbc.update("insert into detalles_venta values (1,1,1,2,10), (2,1,1,1,7), (3,1,2,1,6), (4,2,2,1,8)");
        service = new SalesReportService(jdbc);
    }

    private void history() {
        jdbc.execute("create schema staging_diza");
        jdbc.execute("create table staging_diza.ventas_csv(fecha date, id_producto varchar(12), nombre_producto varchar(150), cantidad_vendida numeric(12,3), precio_venta_unitario numeric(12,2), stock_final_dia numeric(12,3))");
        jdbc.update("insert into staging_diza.ventas_csv values ('2026-10-01','P001','Arroz histórico',10,4,20), ('2026-10-02','H001','Producto antiguo',2,3,5)");
    }

    @Test
    void operationalReportUsesSubtotalsIncludesInactiveProductsAndCountsDistinctTickets() {
        var report = service.get(LocalDate.parse("2026-11-16"), LocalDate.parse("2026-11-16"), null, "todos", "dia", 0, 20);
        assertThat(report.total()).isEqualByComparingTo("23");
        assertThat(report.tickets()).isEqualTo(1);
        assertThat(report.productos()).isEqualTo(2);
        assertThat(report.historicoDisponible()).isFalse();
        var rice = report.registros().stream().filter(row -> row.sku().equals("P001")).findFirst().orElseThrow();
        assertThat(rice.importe()).isEqualByComparingTo("17");
        assertThat(rice.cantidad()).isEqualByComparingTo("3");
        assertThat(report.tendencia().getFirst().historico()).isNull();
    }

    @Test
    void historicalAndOperationalPeriodsCombineWithoutDroppingUnmappedProducts() {
        history();
        var report = service.get(null, null, null, "todos", "mes", 0, 20);
        assertThat(report.total()).isEqualByComparingTo("77");
        assertThat(report.historico()).isEqualByComparingTo("46");
        assertThat(report.operativo()).isEqualByComparingTo("31");
        assertThat(report.catalogo()).anyMatch(product -> product.sku().equals("H001"));
        assertThat(report.ranking().getFirst().importe()).isEqualByComparingTo("57");
        assertThat(report.tendencia()).hasSize(2);
        assertThat(report.tendencia().getFirst().operativo()).isNull();
        assertThat(jdbc.queryForObject("select count(*) from ventas", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select count(*) from staging_diza.ventas_csv", Integer.class)).isEqualTo(2);
    }

    @Test
    void conflictingOverlapSuppressesConsolidatedTotalsTrendAndRanking() {
        history();
        jdbc.update("insert into staging_diza.ventas_csv values ('2026-11-16','P001','Arroz',3,4,10)");
        var report = service.get(null, null, null, "todos", "dia", 0, 20);
        assertThat(report.coincidencias()).isEqualTo(1);
        assertThat(report.conciliadas()).isZero();
        assertThat(report.conflictos()).isEqualTo(1);
        assertThat(report.tendencia()).isEmpty();
        assertThat(report.total()).isNull();
        assertThat(report.ranking()).isEmpty();
        assertThat(report.historico()).isEqualByComparingTo("58");
        assertThat(report.operativo()).isEqualByComparingTo("31");
        var operational = service.get(null, null, "P001", "operativo", "dia", 0, 20);
        assertThat(operational.total()).isEqualByComparingTo("17");
        assertThat(operational.coincidencias()).isZero();
        assertThat(operational.tickets()).isEqualTo(1);
    }

    @Test
    void exactOverlapCountsOnceAndPreservesOriginalHistory() {
        history();
        jdbc.update("insert into staging_diza.ventas_csv values ('2026-11-16','P002','Leche',1,6,10), ('2026-11-18','P001','Arroz',0,4,10)");
        var report = service.get(null, null, null, "todos", "dia", 0, 20);
        assertThat(report.coincidencias()).isEqualTo(1);
        assertThat(report.conciliadas()).isEqualTo(1);
        assertThat(report.conflictos()).isZero();
        assertThat(report.total()).isEqualByComparingTo("77");
        assertThat(report.historico()).isEqualByComparingTo("46");
        assertThat(report.operativo()).isEqualByComparingTo("31");
        assertThat(report.filas()).isEqualTo(6);
        assertThat(report.tickets()).isEqualTo(2);
        assertThat(report.registros()).filteredOn(row -> row.fecha().equals(LocalDate.parse("2026-11-16")) && row.sku().equals("P002"))
            .singleElement().satisfies(row -> assertThat(row.origen()).isEqualTo("operativo"));
        assertThat(report.registros()).anyMatch(row -> row.fecha().equals(LocalDate.parse("2026-11-18")) && row.importe().signum() == 0);
        assertThat(report.ranking()).filteredOn(row -> row.sku().equals("P002"))
            .singleElement().satisfies(row -> assertThat(row.importe()).isEqualByComparingTo("14"));
        var day = report.tendencia().stream().filter(point -> point.periodo().equals(LocalDate.parse("2026-11-16"))).findFirst().orElseThrow();
        assertThat(day.historico()).isNull();
        assertThat(day.operativo()).isEqualByComparingTo("23");
        var raw = service.get(null, null, null, "historico", "dia", 0, 20);
        assertThat(raw.total()).isEqualByComparingTo("52");
        assertThat(raw.conciliadas()).isZero();
        assertThat(raw.filas()).isEqualTo(4);
        assertThat(jdbc.queryForObject("select count(*) from staging_diza.ventas_csv", Integer.class)).isEqualTo(4);
        var paged = service.get(null, null, null, "todos", "dia", 1, 1);
        assertThat(paged.total()).isEqualByComparingTo("77");
        assertThat(paged.conciliadas()).isEqualTo(1);
        assertThat(paged.tendencia()).isEqualTo(report.tendencia());
    }

    @Test
    void equalAmountWithDifferentQuantityRemainsAConflict() {
        history();
        jdbc.update("insert into staging_diza.ventas_csv values ('2026-11-16','P002','Leche',2,3,10)");
        var report = service.get(null, null, null, "todos", "mes", 0, 20);
        assertThat(report.conciliadas()).isZero();
        assertThat(report.conflictos()).isEqualTo(1);
        assertThat(report.total()).isNull();
        assertThat(report.tendencia()).isEmpty();
    }

    @Test
    void multipleHistoricalRowsAreAmbiguousEvenIfAmountsMatch() {
        history();
        jdbc.update("insert into staging_diza.ventas_csv values ('2026-11-16','P002','Leche',1,6,10), ('2026-11-16','P002','Leche',0,6,10), ('2026-10-01','P001','Arroz',0,4,20)");
        var report = service.get(null, null, null, "todos", "mes", 0, 20);
        assertThat(report.coincidencias()).isEqualTo(1);
        assertThat(report.conflictos()).isEqualTo(2);
        assertThat(report.conciliadas()).isZero();
        assertThat(report.total()).isNull();
        assertThat(report.ranking()).isEmpty();
        assertThat(report.tendencia()).isEmpty();
        assertThat(report.filas()).isEqualTo(8);
        var operational = service.get(null, null, null, "operativo", "mes", 0, 20);
        assertThat(operational.total()).isEqualByComparingTo("31");
        assertThat(operational.conflictos()).isZero();
    }

    @Test
    void paginationNeverLimitsTrendTotalsOrRanking() {
        history();
        var first = service.get(null, null, null, "todos", "semana", 0, 1);
        var second = service.get(null, null, null, "todos", "semana", 1, 1);
        assertThat(first.total()).isEqualByComparingTo(second.total());
        assertThat(first.tendencia()).isEqualTo(second.tendencia());
        assertThat(first.ranking()).isEqualTo(second.ranking());
        assertThat(first.filas()).isEqualTo(5);
        assertThat(first.registros()).hasSize(1).isNotEqualTo(second.registros());
        assertThat(first.tendencia().getFirst().periodo()).isEqualTo(LocalDate.parse("2026-09-28"));
    }

    @Test
    void filtersApplyToRowsTotalsTrendAndTicketCount() {
        history();
        var report = service.get(null, LocalDate.parse("2026-10-01"), "P001", "historico", "dia", 0, 20);
        assertThat(report.total()).isEqualByComparingTo("40");
        assertThat(report.registros()).hasSize(1);
        assertThat(report.productos()).isEqualTo(1);
        assertThat(report.tickets()).isZero();
        assertThat(report.tendencia().getFirst().historico()).isEqualByComparingTo("40");
        var empty = service.get(null, null, "missing", "todos", "dia", 999, 20);
        assertThat(empty.total()).isEqualByComparingTo("0");
        assertThat(empty.registros()).isEmpty();
        assertThat(empty.pagina()).isZero();
    }

    @Test
    void rejectsInvalidRangesAndQueryOptions() {
        assertThatIllegalArgumentException().isThrownBy(() -> service.get(LocalDate.parse("2026-11-17"), LocalDate.parse("2026-11-16"), null, "todos", "dia", 0, 20));
        assertThatIllegalArgumentException().isThrownBy(() -> service.get(null, null, null, "invalid", "dia", 0, 20));
        assertThatIllegalArgumentException().isThrownBy(() -> service.get(null, null, null, "todos", "invalid", 0, 20));
        assertThatIllegalArgumentException().isThrownBy(() -> service.get(null, null, null, "todos", "dia", -1, 20));
    }
}
