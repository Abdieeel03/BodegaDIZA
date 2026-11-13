package com.diza.api.testdata;

import com.diza.api.common.ApiResponse;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Analítica histórica paginada. Nunca altera ventas ni stock operativo. */
@RestController
@RequestMapping("/test-data/reportes")
@ConditionalOnProperty(name = "diza.demo.enabled", havingValue = "true")
public class TestSalesReportController {
    private final JdbcTemplate jdbc;
    public TestSalesReportController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/ventas")
    public ApiResponse<Map<String, Object>> ventas(
        @RequestParam(required = false) LocalDate desde,
        @RequestParam(required = false) LocalDate hasta,
        @RequestParam(required = false) String productoId,
        @RequestParam(defaultValue = "mes") String agrupacion,
        @RequestParam(defaultValue = "0") int pagina,
        @RequestParam(defaultValue = "40") int tamanio
    ) {
        String database = jdbc.queryForObject("select current_database()", String.class);
        if (!"bodega_diza_test".equals(database)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Los reportes históricos se habilitan solo en bodega_diza_test");
        }
        if (desde != null && hasta != null && desde.isAfter(hasta)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La fecha inicial debe ser anterior a la final");
        }
        if (pagina < 0 || tamanio < 1 || tamanio > 100 || pagina > 100000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Paginación no válida");
        }
        String unidad = switch (agrupacion) {
            case "dia" -> "day";
            case "semana" -> "week";
            case "mes" -> "month";
            case "anio" -> "year";
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Agrupación no válida");
        };

        StringBuilder condicion = new StringBuilder(" where 1=1 ");
        List<Object> args = new ArrayList<>();
        if (desde != null) { condicion.append(" and fecha >= ? "); args.add(Date.valueOf(desde)); }
        if (hasta != null) { condicion.append(" and fecha <= ? "); args.add(Date.valueOf(hasta)); }
        if (productoId != null && !productoId.isBlank()) {
            condicion.append(" and id_producto = ? "); args.add(productoId.trim());
        }
        String where = condicion.toString();
        Object[] a = args.toArray();
        Map<String, Object> totals = jdbc.queryForMap("""
            select count(*) as filas, coalesce(sum(cantidad_vendida),0) as unidades,
              coalesce(sum(cantidad_vendida * precio_venta_unitario),0) as ingresos,
              count(distinct id_producto) as productos
            from staging_diza.ventas_csv
            """ + where, a);
        String groupDate = "date_trunc('" + unidad + "', fecha)::date"; // unidad proviene de switch cerrado
        String tendenciaSql = "select " + groupDate
            + " as periodo, sum(cantidad_vendida) as unidades, "
            + "sum(cantidad_vendida * precio_venta_unitario) as ingresos "
            + "from staging_diza.ventas_csv " + where + " group by 1 order by 1";
        List<Map<String, Object>> tendencia = jdbc.query(tendenciaSql,
            (rs, n) -> Map.of(
                "periodo", rs.getDate("periodo").toLocalDate().toString(),
                "unidades", rs.getBigDecimal("unidades"),
                "ingresos", rs.getBigDecimal("ingresos")
            ), a);
        List<Object> paged = new ArrayList<>(args);
        paged.add(tamanio);
        paged.add((long) pagina * tamanio);
        List<Map<String, Object>> registros = jdbc.query("""
            select fecha, id_producto, nombre_producto, cantidad_vendida,
              precio_venta_unitario, stock_final_dia
            from staging_diza.ventas_csv
            """ + where + " order by fecha desc, id_producto limit ? offset ?",
            (rs, n) -> Map.of(
                "fecha", rs.getDate("fecha").toLocalDate().toString(),
                "id", rs.getString("id_producto"),
                "nombre", rs.getString("nombre_producto"),
                "cantidad", rs.getBigDecimal("cantidad_vendida"),
                "precio", rs.getBigDecimal("precio_venta_unitario"),
                "stockFinal", rs.getBigDecimal("stock_final_dia")
            ), paged.toArray());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("filas", totals.get("filas"));
        result.put("unidades", totals.get("unidades"));
        result.put("ingresos", totals.get("ingresos"));
        result.put("productos", totals.get("productos"));
        result.put("tendencia", tendencia);
        result.put("registros", registros);
        result.put("pagina", pagina);
        result.put("tamanio", tamanio);
        result.put("soloHistorico", true);
        return ApiResponse.success(result);
    }
}
