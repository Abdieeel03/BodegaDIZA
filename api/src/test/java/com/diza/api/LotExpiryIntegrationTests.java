package com.diza.api;

import static org.assertj.core.api.Assertions.*;
import com.diza.api.category.*;
import com.diza.api.common.BusinessException;
import com.diza.api.inventory.*;
import com.diza.api.product.*;
import com.diza.api.sale.*;
import com.diza.api.supplier.*;
import com.diza.api.user.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;

// Sin @Transactional: se verifica rollback real entre llamadas de servicio.
@SpringBootTest(properties = {"spring.config.location=classpath:application-test.properties", "spring.datasource.url=jdbc:h2:mem:diza_lot_tests;MODE=PostgreSQL;DB_CLOSE_DELAY=-1"})
@ActiveProfiles("test")
class LotExpiryIntegrationTests {
    @Autowired InventarioService inventory;
    @Autowired ProductoService products;
    @Autowired ProductoRepository productRepo;
    @Autowired CategoriaService categories;
    @Autowired ProveedorService suppliers;
    @Autowired UsuarioRepository users;
    @Autowired VentaService sales;
    @Autowired LoteProductoRepository lots;
    @Autowired PlatformTransactionManager transactions;
    String email;
    Long productId;
    final LocalDate today = LocalDate.now(ZoneId.of("America/Lima"));

    @BeforeEach void fixture() {
        String key = UUID.randomUUID().toString();
        email = key + "@diza.invalid";
        users.save(new Usuario("Administrador pruebas", email, "unused-hash", Rol.ADMIN));
        var category = categories.crear(new CategoriaRequest("Categoría " + key, "Prueba aislada"));
        var supplier = suppliers.crear(new ProveedorRequest("Proveedor " + key, String.format("%011d", Math.abs(UUID.randomUUID().getMostSignificantBits() % 100000000000L)), null, null));
        productId = products.crear(new ProductoRequest("SKU-" + key, "Producto de prueba", "",
            category.id(), supplier.id(), new BigDecimal("4.50"), BigDecimal.ONE, UnidadMedida.UNIDAD, null), email).id();
    }

    VencimientoRequest exact(int days) { return new VencimientoRequest(PrecisionVencimiento.EXACTA, today.plusDays(days), null); }
    VencimientoRequest pending() { return new VencimientoRequest(PrecisionVencimiento.PENDIENTE, null, null); }
    EntradaInventarioRequest entry(String code, String quantity, VencimientoRequest date) {
        return new EntradaInventarioRequest(productId, code, new BigDecimal(quantity), null, "Recepción", date);
    }
    LoteResponse receive(String code, String quantity, VencimientoRequest date) { return inventory.registrarEntrada(entry(code, quantity, date), email); }
    VentaResponse sell(String quantity, Long lotId) {
        return sales.registrarVenta(new VentaRequest(List.of(new ItemVentaRequest(productId, new BigDecimal(quantity), lotId, null))), email);
    }
    RegularizacionLoteRequest regularization(LoteResponse lot, String qty, String code, VencimientoRequest date) {
        return new RegularizacionLoteRequest(lot.id(), lot.version(), new BigDecimal(qty), code, date, "Verificación de etiqueta");
    }

    @Test void monthAndPendingHavePhysicalStockButCannotBeSoldEvenManually() {
        var month = receive("MES", "3.125", new VencimientoRequest(PrecisionVencimiento.MES_ANIO, null, "2027-03"));
        var unknown = receive("PENDIENTE", "2", pending());
        assertThat(month.fechaVencimiento()).isNull();
        assertThat(month.mesVencimiento()).isEqualTo("2027-03");
        assertThat(month.estadoVencimiento()).isEqualTo("PENDIENTE");
        assertThat(month.diasParaVencer()).isNull();
        assertThat(products.obtenerPorId(productId).stockFisico()).isEqualByComparingTo("5.125");
        assertThat(products.obtenerPorId(productId).stockTotal()).isZero();
        assertThatThrownBy(() -> sell("1", month.id())).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> sell("1", unknown.id())).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> sell("1", null)).isInstanceOf(BusinessException.class);
        assertThat(inventory.listarMovimientos(productId, TipoMovimientoInventario.SALIDA)).isEmpty();
    }

    @Test void receivingIncompatibleDatesOrRepeatedCodesIsAtomic() {
        receive("EXISTENTE", "2", exact(10));
        assertThatThrownBy(() -> inventory.recibirLotes(new RecepcionLotesRequest(List.of(
            entry("NUEVO", "5", pending()), entry("EXISTENTE", "1", exact(20)))), email)).isInstanceOf(BusinessException.class);
        assertThat(lots.findByProductoIdAndCodigoLote(productId, "NUEVO")).isEmpty();
        assertThat(products.obtenerPorId(productId).stockFisico()).isEqualByComparingTo("2");
        assertThat(inventory.listarMovimientos(productId, null)).hasSize(1);
        assertThatThrownBy(() -> inventory.recibirLotes(new RecepcionLotesRequest(List.of(
            entry("DUP", "1", pending()), entry("DUP", "1", pending()))), email)).isInstanceOf(BusinessException.class);
        var received = inventory.recibirLotes(new RecepcionLotesRequest(List.of(entry("A", "1.125", exact(3)), entry("B", "2.375", pending()))), email);
        assertThat(received).hasSize(2);
        assertThat(products.obtenerPorId(productId).stockFisico()).isEqualByComparingTo("5.500");
        var updated = receive("A", "1", exact(3));
        assertThat(updated.version()).isEqualTo(lots.findById(updated.id()).orElseThrow().getVersion());
        assertThat(products.obtenerPorId(productId).stockFisico()).isEqualByComparingTo("6.500");
    }

    @Test void splitPreservesPhysicalStockAndHistoryThenCorrectionUnblocksStock() {
        var lot = receive("ORIGEN", "10", exact(15));
        var ticket = sales.obtenerPorId(sell("2", lot.id()).id());
        var oldMovements = inventory.listarMovimientos(productId, null);
        lot = inventory.listarLotes(productId, true).getFirst();
        var result = inventory.regularizar(regularization(lot, "3.125", "HIJO", pending()), email);
        assertThat(result).hasSize(2);
        assertThat(result.getFirst().id()).isEqualTo(lot.id());
        assertThat(result.getFirst().cantidadDisponible()).isEqualByComparingTo("4.875");
        assertThat(products.obtenerPorId(productId).stockFisico()).isEqualByComparingTo("8");
        assertThat(products.obtenerPorId(productId).stockVendible()).isEqualByComparingTo("4.875");
        assertThat(sales.obtenerPorId(ticket.id())).isEqualTo(ticket);
        assertThat(inventory.listarMovimientos(productId, null)).isEqualTo(oldMovements);
        assertThat(inventory.historial(lot.id())).hasSize(1);
        assertThat(inventory.historial(result.get(1).id())).hasSize(1);
        var child = result.get(1);
        inventory.regularizar(regularization(child, "3.125", null, exact(2)), email);
        assertThat(products.obtenerPorId(productId).stockFisico()).isEqualByComparingTo("8");
        assertThat(products.obtenerPorId(productId).stockVendible()).isEqualByComparingTo("8");
        assertThat(inventory.historial(child.id())).hasSize(2);
    }

    @Test void invalidSplitAndStaleVersionDoNotChangeStockOrAudit() {
        var lot = receive("ORIGEN", "5", pending());
        receive("OCUPADO", "1", pending());
        assertThatThrownBy(() -> inventory.regularizar(regularization(lot, "6", "HIJO", exact(1)), email)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> inventory.regularizar(regularization(lot, "2", "OCUPADO", exact(1)), email)).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> inventory.regularizar(regularization(lot, "0.0001", "HIJO", exact(1)), email)).isInstanceOf(BusinessException.class);
        assertThat(products.obtenerPorId(productId).stockFisico()).isEqualByComparingTo("6");
        assertThat(inventory.historial(lot.id())).isEmpty();
        receive("ORIGEN", "1", pending());
        assertThatThrownBy(() -> inventory.regularizar(regularization(lot, "5", null, exact(1)), email)).hasMessageContaining("recarga");
        assertThat(products.obtenerPorId(productId).stockFisico()).isEqualByComparingTo("7");
    }

    @Test void fefoIncludesTodayThenExactDatesThenNonExpiringFifo() {
        var none = new VencimientoRequest(PrecisionVencimiento.NO_APLICA, null, null);
        assertThatThrownBy(() -> receive("SIN", "1", none)).isInstanceOf(BusinessException.class);
        inventory.definirPolitica(new PoliticaVencimientoRequest(productId, true, "Producto durable sin caducidad según ficha"), email);
        var first = receive("SIN-1", "1", none);
        receive("SIN-2", "1", none);
        receive("FUTURO", "1", exact(2));
        receive("HOY", "1", exact(0));
        var expired = receive("VENCIDO", "1", exact(-1));
        receive("PENDIENTE", "1", pending());
        assertThatThrownBy(() -> sell("1", expired.id())).isInstanceOf(BusinessException.class);
        assertThat(sell("4", null).detalles()).extracting(DetalleVentaResponse::codigoLote)
            .containsExactly("HOY", "FUTURO", "SIN-1", "SIN-2");
        receive("SIN-1", "2", none);
        inventory.definirPolitica(new PoliticaVencimientoRequest(productId, false, "Se verificó que sí requiere fecha"), email);
        assertThatThrownBy(() -> sell("1", first.id())).isInstanceOf(BusinessException.class);
        assertThat(products.obtenerPorId(productId).stockVendible()).isZero();
    }

    @Test void repeatedSaleItemsReserveStockAndFailureRollsBackEverything() {
        receive("PRIMERO", "2", exact(1));
        receive("SEGUNDO", "3", exact(2));
        var repeated = List.of(new ItemVentaRequest(productId, new BigDecimal("2"), null, null), new ItemVentaRequest(productId, new BigDecimal("2"), null, null));
        var sale = sales.registrarVenta(new VentaRequest(repeated), email);
        assertThat(sale.detalles()).extracting(DetalleVentaResponse::codigoLote).containsExactly("PRIMERO", "SEGUNDO");
        assertThat(products.obtenerPorId(productId).stockFisico()).isEqualByComparingTo("1");
        var movements = inventory.listarMovimientos(productId, null);
        assertThatThrownBy(() -> sales.registrarVenta(new VentaRequest(List.of(
            new ItemVentaRequest(productId, BigDecimal.ONE, null, null), new ItemVentaRequest(productId, BigDecimal.ONE, null, null))), email)).isInstanceOf(BusinessException.class);
        assertThat(products.obtenerPorId(productId).stockFisico()).isEqualByComparingTo("1");
        assertThat(inventory.listarMovimientos(productId, null)).isEqualTo(movements);
    }

    @ParameterizedTest @CsvSource({"-1,VENCIDO", "0,HOY", "1,CRITICO", "3,CRITICO", "4,PROXIMO", "7,PROXIMO", "8,PREVENTIVO", "30,PREVENTIVO", "31,SEGUIMIENTO", "91,SEGUIMIENTO"})
    void expiryStateBoundaries(int days, String state) {
        var lot = receive("LIMITE", "1", exact(days));
        assertThat(lot.estadoVencimiento()).isEqualTo(state);
        assertThat(lot.vendible()).isEqualTo(days >= 0);
        assertThat(lot.diasParaVencer()).isEqualTo((long) days);
    }

    @Test void horizonsIncludeExpiredAndUndatedPhysicalLots() {
        for (int d : List.of(-2, 0, 7, 8, 15, 16, 30, 31, 90, 91)) receive("D" + d, "1", exact(d));
        receive("P", "1", pending());
        int[] horizons = {7, 15, 30, 90, 0};
        int[] counts = {4, 6, 8, 10, 11};
        for (int i = 0; i < horizons.length; i++) {
            var matching = inventory.obtenerAlertasVencimiento(horizons[i]).stream().filter(l -> l.productoId().equals(productId)).toList();
            assertThat(matching).hasSize(counts[i]);
            assertThat(matching).extracting(LoteResponse::codigoLote).contains("D-2", "P");
        }
        assertThatThrownBy(() -> inventory.obtenerAlertasVencimiento(14)).isInstanceOf(BusinessException.class);
    }

    @Test void legacyDatesStayUnchangedUntilExplicitCorrection() {
        Long id = new TransactionTemplate(transactions).execute(status -> lots.saveAndFlush(new LoteProducto(
            productRepo.findById(productId).orElseThrow(), "HISTORICO", new BigDecimal("3"), today.minusDays(10), today.plusDays(5))).getId());
        var historical = inventory.listarLotes(productId, true).getFirst();
        assertThat(historical.fechaHeredada()).isTrue();
        assertThat(historical.vendible()).isTrue();
        assertThat(historical.fechaVencimiento()).isEqualTo(today.plusDays(5));
        inventory.regularizar(regularization(historical, "3", null, pending()), email);
        assertThat(inventory.listarLotes(productId, true).getFirst().id()).isEqualTo(id);
        assertThat(products.obtenerPorId(productId).stockFisico()).isEqualByComparingTo("3");
        assertThat(products.obtenerPorId(productId).stockVendible()).isZero();
    }

    @Test void cashierCannotRegularizeOrAuthorizePolicy() {
        String cashier = UUID.randomUUID() + "@diza.invalid";
        users.save(new Usuario("Cajero", cashier, "unused-hash", Rol.CAJERO));
        var lot = receive("P", "1", pending());
        assertThatThrownBy(() -> inventory.regularizar(regularization(lot, "1", null, exact(5)), cashier))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThatThrownBy(() -> inventory.definirPolitica(new PoliticaVencimientoRequest(productId, true, "Sin permiso"), cashier))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test void rejectsAmbiguousExpiryPayloads() {
        assertThatThrownBy(() -> receive("M", "1", new VencimientoRequest(PrecisionVencimiento.MES_ANIO, today, "2027-03"))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> receive("M", "1", new VencimientoRequest(PrecisionVencimiento.MES_ANIO, null, "2027-13"))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> receive("E", "1", new VencimientoRequest(PrecisionVencimiento.EXACTA, null, null))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> receive("P", "1", new VencimientoRequest(PrecisionVencimiento.PENDIENTE, today, null))).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> inventory.registrarEntrada(new EntradaInventarioRequest(productId, "X", BigDecimal.ONE, today, "", pending()), email)).isInstanceOf(BusinessException.class);
        assertThat(products.obtenerPorId(productId).stockFisico()).isZero();
    }
}
