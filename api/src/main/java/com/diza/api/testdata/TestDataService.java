package com.diza.api.testdata;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Datos históricos AISLADOS: no modifica productos, ventas ni lotes operativos.
 * Guardarraíl adicional: únicamente permite ejecutarse en bodega_diza_test.
 */
@Service
@ConditionalOnProperty(name = "diza.demo.enabled", havingValue = "true")
public class TestDataService {
    private final JdbcTemplate jdbc;

    public TestDataService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    private static final String[] PRODUCTOS = {
        "id_producto", "nombre_producto", "categoria", "costo_compra_unitario",
        "precio_venta_unitario", "stock_actual", "stock_minimo_seguridad", "estado_alerta"
    };
    private static final String[] VENTAS = {
        "fecha", "dia_semana", "es_fin_de_semana", "id_producto", "nombre_producto",
        "categoria", "costo_compra_unitario", "precio_venta_unitario", "cantidad_repuesta",
        "stock_inicial_dia", "cantidad_vendida", "stock_final_dia",
        "stock_minimo_seguridad", "estado_alerta"
    };
    private static final String[] PREDICCIONES = {
        "id_producto", "fecha", "ventas_reales", "prediccion", "periodo"
    };

    private void preparar() {
        String base = jdbc.queryForObject("select current_database()", String.class);
        if (!"bodega_diza_test".equals(base)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                "Endpoint deshabilitado: requiere exclusivamente la base bodega_diza_test");
        }
        jdbc.execute("create schema if not exists staging_diza");
        jdbc.execute("""
            create table if not exists staging_diza.productos_csv (
              id_producto varchar(12) primary key,
              nombre_producto varchar(160) not null,
              categoria varchar(100) not null,
              costo_compra_unitario numeric(12,2) not null,
              precio_venta_unitario numeric(12,2) not null,
              stock_actual numeric(12,3) not null,
              stock_minimo_seguridad numeric(12,3) not null,
              estado_alerta varchar(12) not null
            )
            """);
        jdbc.execute("""
            create table if not exists staging_diza.ventas_csv (
              fecha date not null,
              dia_semana integer not null,
              es_fin_de_semana integer not null,
              id_producto varchar(12) not null references staging_diza.productos_csv(id_producto),
              nombre_producto varchar(160) not null,
              categoria varchar(100) not null,
              costo_compra_unitario numeric(12,2) not null,
              precio_venta_unitario numeric(12,2) not null,
              cantidad_repuesta numeric(12,3) not null,
              stock_inicial_dia numeric(12,3) not null,
              cantidad_vendida numeric(12,3) not null,
              stock_final_dia numeric(12,3) not null,
              stock_minimo_seguridad numeric(12,3) not null,
              estado_alerta varchar(12) not null,
              primary key (fecha,id_producto)
            )
            """);
        jdbc.execute("""
            create table if not exists staging_diza.predicciones_csv (
              id_producto varchar(12) not null references staging_diza.productos_csv(id_producto),
              fecha date not null,
              ventas_reales numeric(12,3),
              prediccion numeric(12,3) not null,
              periodo varchar(12) not null,
              primary key (id_producto,fecha,periodo)
            )
            """);
    }

    private long contar(String tabla) {
        // Nombres elegidos internamente, jamás por parámetros del usuario.
        return jdbc.queryForObject("select count(*) from staging_diza." + tabla, Long.class);
    }

    @Transactional
    public Map<String, Object> importar(String tipo, MultipartFile archivo) {
        preparar();
        return switch (tipo) {
            case "productos" -> importarProductos(archivo);
            case "ventas" -> importarVentas(archivo);
            case "predicciones" -> importarPredicciones(archivo);
            default -> throw TestCsvParser.error("Tipo desconocido: productos, ventas o predicciones");
        };
    }

    private Map<String, Object> importarProductos(MultipartFile archivo) {
        if (contar("productos_csv") != 0) throw conflict("El catálogo histórico ya está cargado; no se sobrescribirá");
        List<String[]> rows = TestCsvParser.leer(archivo, PRODUCTOS);
        Set<String> ids = new HashSet<>();
        List<Object[]> args = new ArrayList<>();
        for (String[] r : rows) {
            if (r[0].isBlank() || !ids.add(r[0])) throw TestCsvParser.error("ID de producto vacío o duplicado: " + r[0]);
            args.add(new Object[] {r[0], r[1], r[2], numero(r[3]), numero(r[4]),
                numero(r[5]), numero(r[6]), r[7]});
        }
        jdbc.batchUpdate("""
            insert into staging_diza.productos_csv
            (id_producto,nombre_producto,categoria,costo_compra_unitario,precio_venta_unitario,
             stock_actual,stock_minimo_seguridad,estado_alerta)
            values (?,?,?,?,?,?,?,?)
            """, args);
        return Map.of("tipo", "productos", "filasImportadas", rows.size(), "destino", "staging_diza.productos_csv");
    }

    private Map<String, Object> importarVentas(MultipartFile archivo) {
        if (contar("ventas_csv") != 0) throw conflict("El histórico de ventas ya está cargado; no se sobrescribirá");
        if (contar("productos_csv") == 0) throw TestCsvParser.error("Primero importa productos_diza.csv");
        Set<String> productos = new HashSet<>(jdbc.queryForList(
            "select id_producto from staging_diza.productos_csv", String.class));
        List<String[]> rows = TestCsvParser.leer(archivo, VENTAS);
        Set<String> claves = new HashSet<>();
        List<Object[]> args = new ArrayList<>();
        for (String[] r : rows) {
            LocalDate fecha = fecha(r[0]);
            int dia = entero(r[1], 1, 7);
            int fin = entero(r[2], 0, 1);
            if (!productos.contains(r[3])) throw TestCsvParser.error("Producto sin catálogo: " + r[3]);
            if (!claves.add(r[0] + "|" + r[3])) throw TestCsvParser.error("Fecha y producto duplicados: " + r[0] + "/" + r[3]);
            BigDecimal inicial = numero(r[9]);
            BigDecimal vendido = numero(r[10]);
            BigDecimal finalDia = numero(r[11]);
            if (inicial.subtract(vendido).compareTo(finalDia) != 0) {
                throw TestCsvParser.error("Balance de stock incorrecto: " + r[0] + " producto " + r[3]);
            }
            args.add(new Object[] {fecha, dia, fin, r[3], r[4], r[5], numero(r[6]), numero(r[7]),
                numero(r[8]), inicial, vendido, finalDia, numero(r[12]), r[13]});
        }
        jdbc.batchUpdate("""
            insert into staging_diza.ventas_csv
            (fecha,dia_semana,es_fin_de_semana,id_producto,nombre_producto,categoria,
             costo_compra_unitario,precio_venta_unitario,cantidad_repuesta,stock_inicial_dia,
             cantidad_vendida,stock_final_dia,stock_minimo_seguridad,estado_alerta)
            values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, args);
        return Map.of("tipo", "ventas", "filasImportadas", rows.size(), "destino", "staging_diza.ventas_csv");
    }

    private Map<String, Object> importarPredicciones(MultipartFile archivo) {
        if (contar("predicciones_csv") != 0) throw conflict("Las predicciones ya están cargadas; no se sobrescribirán");
        if (contar("ventas_csv") == 0) throw TestCsvParser.error("Primero importa el histórico de ventas");
        List<String[]> rows = TestCsvParser.leer(archivo, PREDICCIONES);
        Set<String> productos = new HashSet<>(jdbc.queryForList(
            "select id_producto from staging_diza.productos_csv", String.class));
        Set<String> claves = new HashSet<>();
        List<Object[]> args = new ArrayList<>();
        for (String[] r : rows) {
            if (!productos.contains(r[0])) throw TestCsvParser.error("Predicción de producto inexistente: " + r[0]);
            if (!"EVALUACION".equals(r[4]) && !"FUTURO".equals(r[4])) throw TestCsvParser.error("Periodo incorrecto: " + r[4]);
            if (!claves.add(r[0] + "|" + r[1] + "|" + r[4])) throw TestCsvParser.error("Predicción duplicada");
            BigDecimal real = r[2].isBlank() ? null : numero(r[2]);
            if ("EVALUACION".equals(r[4]) && real == null) throw TestCsvParser.error("Falta valor real para evaluación");
            if ("FUTURO".equals(r[4]) && real != null) throw TestCsvParser.error("La predicción futura no debe llevar venta real");
            args.add(new Object[] {r[0], fecha(r[1]), real, numero(r[3]), r[4]});
        }
        jdbc.batchUpdate("""
            insert into staging_diza.predicciones_csv
            (id_producto,fecha,ventas_reales,prediccion,periodo) values (?,?,?,?,?)
            """, args);
        return Map.of("tipo", "predicciones", "filasImportadas", rows.size(), "destino", "staging_diza.predicciones_csv");
    }

    public Map<String, Object> resumen() {
        preparar();
        Map<String, Object> resultado = new LinkedHashMap<>();
        resultado.put("productos", contar("productos_csv"));
        resultado.put("ventasDiarias", contar("ventas_csv"));
        resultado.put("predicciones", contar("predicciones_csv"));
        var totales = jdbc.queryForMap("""
            select min(fecha) as desde, max(fecha) as hasta,
              coalesce(sum(cantidad_vendida),0) as unidades,
              coalesce(sum(cantidad_vendida * precio_venta_unitario),0) as ingresos
            from staging_diza.ventas_csv
            """);
        resultado.put("desde", totales.get("desde") == null ? null : totales.get("desde").toString());
        resultado.put("hasta", totales.get("hasta") == null ? null : totales.get("hasta").toString());
        resultado.put("unidades", totales.get("unidades"));
        resultado.put("ingresos", totales.get("ingresos"));
        resultado.put("origen", "Histórico agregado por fecha y producto; no son tickets operativos");
        return resultado;
    }

    public List<Map<String, Object>> productos() {
        preparar();
        return jdbc.query("""
            select id_producto as "id", nombre_producto as "nombre", categoria,
              precio_venta_unitario as "precio", stock_actual as "stock",
              stock_minimo_seguridad as "stockMinimo", estado_alerta as "alerta"
            from staging_diza.productos_csv order by id_producto
            """, (rs, n) -> Map.of(
                "id", rs.getString("id"), "nombre", rs.getString("nombre"),
                "categoria", rs.getString("categoria"), "precio", rs.getBigDecimal("precio"),
                "stock", rs.getBigDecimal("stock"), "stockMinimo", rs.getBigDecimal("stockMinimo"),
                "alerta", rs.getString("alerta")
            ));
    }

    public List<Map<String, Object>> top() {
        preparar();
        return jdbc.query("""
            select v.id_producto as id, min(v.nombre_producto) as nombre,
              sum(v.cantidad_vendida) as unidades,
              sum(v.cantidad_vendida * v.precio_venta_unitario) as ingresos
            from staging_diza.ventas_csv v
            group by v.id_producto order by unidades desc limit 10
            """, (rs, n) -> Map.of(
                "id", rs.getString("id"), "nombre", rs.getString("nombre"),
                "unidades", rs.getBigDecimal("unidades"), "ingresos", rs.getBigDecimal("ingresos")
            ));
    }

    public List<Map<String, Object>> ventasDiarias(String productoId) {
        preparar();
        String sql = """
            select fecha,id_producto,nombre_producto,cantidad_vendida,precio_venta_unitario,stock_final_dia
            from staging_diza.ventas_csv
            """ + ((productoId == null || productoId.isBlank()) ? "" : " where id_producto = ? ") +
            " order by fecha desc, id_producto limit 200";
        Object[] args = (productoId == null || productoId.isBlank()) ? new Object[]{} : new Object[]{productoId};
        return jdbc.query(sql, (rs, n) -> Map.of(
            "fecha", rs.getDate("fecha").toLocalDate().toString(),
            "id", rs.getString("id_producto"), "nombre", rs.getString("nombre_producto"),
            "cantidad", rs.getBigDecimal("cantidad_vendida"),
            "precio", rs.getBigDecimal("precio_venta_unitario"),
            "stockFinal", rs.getBigDecimal("stock_final_dia")
        ), args);
    }

    public Map<String, Object> prediccion(String productoId) {
        preparar();
        if (productoId == null || productoId.isBlank()) throw TestCsvParser.error("Selecciona un producto");
        var historico = jdbc.query("""
            select fecha,cantidad_vendida from staging_diza.ventas_csv
            where id_producto=? order by fecha
            """, (rs, n) -> Map.of(
                "fecha", rs.getDate("fecha").toLocalDate().toString(),
                "ventas", rs.getBigDecimal("cantidad_vendida")
            ), productoId);
        var predicciones = jdbc.query("""
            select fecha,ventas_reales,prediccion,periodo from staging_diza.predicciones_csv
            where id_producto=? order by fecha
            """, (rs, n) -> {
            Map<String, Object> fila = new LinkedHashMap<>();
            fila.put("fecha", rs.getDate("fecha").toLocalDate().toString());
            fila.put("real", rs.getBigDecimal("ventas_reales"));
            fila.put("prediccion", rs.getBigDecimal("prediccion"));
            fila.put("periodo", rs.getString("periodo"));
            return fila;
        }, productoId);
        var metricas = jdbc.queryForMap("""
            select count(*) as n,
              coalesce(avg(abs(prediccion-ventas_reales)),0) as mae,
              coalesce(sqrt(avg(power(prediccion-ventas_reales,2))),0) as rmse
            from staging_diza.predicciones_csv
            where id_producto=? and periodo='EVALUACION'
            """, productoId);
        return Map.of("historico", historico, "predicciones", predicciones, "metricas", metricas);
    }

    private static BigDecimal numero(String texto) {
        try {
            BigDecimal n = new BigDecimal(texto);
            if (n.signum() < 0) throw new NumberFormatException("negativo");
            return n;
        } catch (NumberFormatException e) {
            throw TestCsvParser.error("Número inválido: " + texto);
        }
    }

    private static LocalDate fecha(String texto) {
        try { return LocalDate.parse(texto); }
        catch (Exception e) { throw TestCsvParser.error("Fecha inválida: " + texto); }
    }

    private static int entero(String texto, int min, int max) {
        try {
            int n = Integer.parseInt(texto);
            if (n < min || n > max) throw new NumberFormatException();
            return n;
        } catch (NumberFormatException e) {
            throw TestCsvParser.error("Entero fuera de rango: " + texto);
        }
    }

    private static ResponseStatusException conflict(String mensaje) {
        return new ResponseStatusException(HttpStatus.CONFLICT, mensaje);
    }
}
