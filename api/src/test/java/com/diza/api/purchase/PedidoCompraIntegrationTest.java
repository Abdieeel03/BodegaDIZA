package com.diza.api.purchase;

import com.diza.api.category.*;
import com.diza.api.common.BusinessException;
import com.diza.api.inventory.*;
import com.diza.api.ml.*;
import com.diza.api.product.*;
import com.diza.api.supplier.*;
import com.diza.api.user.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.Mockito.when;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PedidoCompraIntegrationTest {
    @Autowired PedidoCompraService service;
    @Autowired CompraRepository compras;
    @Autowired DetalleCompraRepository detalles;
    @Autowired ProductoRepository productos;
    @Autowired CategoriaRepository categorias;
    @Autowired ProveedorRepository proveedores;
    @Autowired UsuarioRepository usuarios;
    @Autowired LoteProductoRepository lotes;
    @Autowired MovimientoInventarioRepository movimientos;
    @MockitoBean MlServiceClient ml;
    Producto a, b;
    String email = "pedidos-test@diza.pe";

    @BeforeEach void setup() {
        var cat = categorias.save(new Categoria("Categoria pedidos", "Prueba aislada"));
        var prov1 = proveedores.save(new Proveedor("Proveedor A", "20999999991", "999999999", "a@diza.pe"));
        var prov2 = proveedores.save(new Proveedor("Proveedor B", "20999999992", "999999998", "b@diza.pe"));
        a = new Producto("ORD-A", "Producto A", "", cat, prov1, new BigDecimal("4.20"), new BigDecimal("15"), UnidadMedida.UNIDAD);
        b = new Producto("ORD-B", "Producto B", "", cat, prov2, new BigDecimal("3.00"), new BigDecimal("10"), UnidadMedida.UNIDAD);
        a.definirPrecioCosto(new BigDecimal("3.45")); b.definirPrecioCosto(new BigDecimal("2.00"));
        a = productos.saveAndFlush(a); b = productos.saveAndFlush(b);
        usuarios.saveAndFlush(new Usuario("Administrador pedidos", email, "encoded-password", Rol.ADMIN));
        var items = List.of(new ReplenishmentOptimizationItemResponse("ORD-A", "Producto A", "Categoria pedidos", "ROJO", 10, 4, 6, 3.45, 13.8, "Proveedor A", 0.9),
            new ReplenishmentOptimizationItemResponse("ORD-B", "Producto B", "Categoria pedidos", "ROJO", 8, 2, 6, 2, 4, "Proveedor B", 0.8));
        when(ml.optimizeReplenishment(anyDouble())).thenReturn(new ReplenishmentOptimizationResponse("hill_climbing", 20, 17.8, 2.2, 0, 1, items, 1, 18, 6, 12, 33.3, false));
    }
    PedidoCompraRequest.Item item(Producto p, int qty) { return new PedidoCompraRequest.Item(p.getSku(), p.getProveedor().getNombre(), qty, p.getPrecioCosto()); }
    PedidoCompraRequest pedido(String presupuesto, PedidoCompraRequest.Item... items) { return new PedidoCompraRequest(new BigDecimal(presupuesto), List.of(items)); }
    CompraResponse confirmarA() { return service.confirmar(pedido("20", item(a, 4)), email).getFirst(); }
    RecepcionPedidoRequest.Lote lote(Producto p, String codigo, int cantidad) {
        return new RecepcionPedidoRequest.Lote(p.getId(), codigo, cantidad, new VencimientoRequest(PrecisionVencimiento.EXACTA, LocalDate.now(ZoneId.of("America/Lima")).plusMonths(2), null));
    }
    @Test void confirmsPerSupplierWithoutStockOrMovement() {
        long antes = movimientos.count(); long antesLotes = lotes.count();
        var orders = service.confirmar(pedido("20", item(a, 4), item(b, 2)), email);
        assertThat(orders).hasSize(2);
        assertThat(orders).allMatch(o -> o.estado() == EstadoCompra.PENDIENTE && o.detalles().getFirst().loteId() == null);
        assertThat(orders.stream().map(CompraResponse::total).reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo("17.80");
        assertThat(movimientos.count()).isEqualTo(antes); assertThat(lotes.count()).isEqualTo(antesLotes);
    }
    @Test void receivesMultipleLotsAndRejectsSecondReceipt() {
        var order = confirmarA(); long antes = movimientos.count();
        var req = new RecepcionPedidoRequest(List.of(lote(a, "ORD-01", 1), lote(a, "ORD-02", 3)));
        var recibido = service.recibir(order.id(), req, email);
        assertThat(recibido.estado()).isEqualTo(EstadoCompra.RECIBIDA);
        assertThat(recibido.fechaRecepcion()).isNotNull();
        assertThat(recibido.detalles()).hasSize(2);
        assertThat(recibido.detalles().stream().map(DetalleCompraResponse::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo("13.80");
        assertThat(lotes.sumStockDisponibleByProductoId(a.getId(), LocalDate.now(ZoneId.of("America/Lima")))).isEqualByComparingTo("4");
        assertThat(movimientos.count()).isEqualTo(antes + 2);
        assertThatThrownBy(() -> service.recibir(order.id(), req, email)).isInstanceOf(BusinessException.class);
    }
    @Test void rejectsOverBudget() {
        long count = compras.count();
        assertThatThrownBy(() -> service.confirmar(pedido("10", item(a, 4)), email)).isInstanceOf(BusinessException.class).hasMessageContaining("presupuesto");
        assertThat(compras.count()).isEqualTo(count);
    }
    @Test void rejectsStaleCost() {
        assertThatThrownBy(() -> service.confirmar(pedido("20", new PedidoCompraRequest.Item(a.getSku(), "Proveedor A", 4, new BigDecimal("3.00"))), email))
            .isInstanceOf(BusinessException.class).hasMessageContaining("costo");
    }
    @Test void rejectsExcessNeed() {
        assertThatThrownBy(() -> service.confirmar(pedido("100", item(a, 11)), email)).isInstanceOf(BusinessException.class).hasMessageContaining("necesidad");
    }
    @Test void rejectsDuplicatePendingProduct() {
        confirmarA();
        assertThatThrownBy(this::confirmarA).isInstanceOf(BusinessException.class).hasMessageContaining("pendiente");
    }
    @Test void rejectsIncompleteReceptionWithoutMovement() {
        var order = confirmarA(); long antes = movimientos.count();
        assertThatThrownBy(() -> service.recibir(order.id(), new RecepcionPedidoRequest(List.of(lote(a, "ORD-01", 3))), email))
            .isInstanceOf(BusinessException.class).hasMessageContaining("cantidad recibida");
        assertThat(movimientos.count()).isEqualTo(antes);
        assertThat(compras.findById(order.id()).orElseThrow().getEstado()).isEqualTo(EstadoCompra.PENDIENTE);
    }
    @Test void cancelDoesNotChangeStockAndCannotBeReceived() {
        var order = confirmarA(); long antes = movimientos.count();
        assertThat(service.cancelar(order.id(), email).estado()).isEqualTo(EstadoCompra.CANCELADA);
        assertThat(movimientos.count()).isEqualTo(antes);
        assertThatThrownBy(() -> service.recibir(order.id(), new RecepcionPedidoRequest(List.of(lote(a, "ORD-01", 4))), email)).isInstanceOf(BusinessException.class);
    }
    @Test void pendingExpiryIsPhysicalNotSellable() {
        var order = confirmarA();
        var entrada = new RecepcionPedidoRequest.Lote(a.getId(), "ORD-PEND", 4, new VencimientoRequest(PrecisionVencimiento.PENDIENTE, null, null));
        service.recibir(order.id(), new RecepcionPedidoRequest(List.of(entrada)), email);
        assertThat(lotes.sumStockFisicoByProductoId(a.getId())).isEqualByComparingTo("4");
        assertThat(lotes.sumStockDisponibleByProductoId(a.getId(), LocalDate.now(ZoneId.of("America/Lima")))).isEqualByComparingTo("0");
    }
    @Test void refusesUnauthorizedNoExpiry() {
        var order = confirmarA();
        var entrada = new RecepcionPedidoRequest.Lote(a.getId(), "ORD-NA", 4, new VencimientoRequest(PrecisionVencimiento.NO_APLICA, null, null));
        assertThatThrownBy(() -> service.recibir(order.id(), new RecepcionPedidoRequest(List.of(entrada)), email)).isInstanceOf(BusinessException.class);
    }
}
