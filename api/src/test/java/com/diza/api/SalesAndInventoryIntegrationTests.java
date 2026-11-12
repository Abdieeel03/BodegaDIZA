package com.diza.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.diza.api.category.CategoriaRequest;
import com.diza.api.category.CategoriaResponse;
import com.diza.api.category.CategoriaService;
import com.diza.api.common.BusinessException;
import com.diza.api.inventory.AjusteInventarioRequest;
import com.diza.api.inventory.AlertaBajoStockResponse;
import com.diza.api.inventory.EntradaInventarioRequest;
import com.diza.api.inventory.InventarioService;
import com.diza.api.inventory.LoteProducto;
import com.diza.api.inventory.LoteProductoRepository;
import com.diza.api.inventory.LoteResponse;
import com.diza.api.inventory.MovimientoResponse;
import com.diza.api.inventory.TipoMovimientoInventario;
import com.diza.api.product.LoteInicialRequest;
import com.diza.api.product.ProductoRequest;
import com.diza.api.product.ProductoResponse;
import com.diza.api.product.ProductoService;
import com.diza.api.product.UnidadMedida;
import com.diza.api.purchase.CompraRequest;
import com.diza.api.purchase.CompraResponse;
import com.diza.api.purchase.CompraService;
import com.diza.api.purchase.ItemCompraRequest;
import com.diza.api.sale.ItemVentaRequest;
import com.diza.api.sale.ResumenVentasResponse;
import com.diza.api.sale.VentaRequest;
import com.diza.api.sale.VentaResponse;
import com.diza.api.sale.VentaService;
import com.diza.api.supplier.ProveedorRequest;
import com.diza.api.supplier.ProveedorResponse;
import com.diza.api.supplier.ProveedorService;
import com.diza.api.user.Rol;
import com.diza.api.user.Usuario;
import com.diza.api.user.UsuarioRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SalesAndInventoryIntegrationTests {

    @Autowired
    private CategoriaService categoriaService;

    @Autowired
    private ProveedorService proveedorService;

    @Autowired
    private ProductoService productoService;

    @Autowired
    private InventarioService inventarioService;

    @Autowired
    private CompraService compraService;

    @Autowired
    private VentaService ventaService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private LoteProductoRepository loteProductoRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Usuario adminUser;

    @BeforeEach
    void setUp() {
        adminUser = usuarioRepository.save(new Usuario(
            "Cajero Diza",
            "cajero@diza.pe",
            passwordEncoder.encode("secret123"),
            Rol.ADMIN
        ));
    }

    @Test
    void completeSalesAndInventoryWorkflow() {
        // 1. Crear Categoría y Proveedor
        CategoriaResponse lacteos = categoriaService.crear(new CategoriaRequest("Lácteos", "Productos lácteos y derivados"));
        assertThat(lacteos.id()).isNotNull();

        ProveedorResponse gloria = proveedorService.crear(new ProveedorRequest(
            "Distribuidora Gloria S.A.",
            "20100010724",
            "999888777",
            "ventas@gloria.pe"
        ));
        assertThat(gloria.id()).isNotNull();

        // 2. Registrar Producto con Lote Inicial (10 latas que vencen en 1 mes)
        LocalDate vencimientoLote1 = LocalDate.now().plusMonths(1);
        ProductoResponse productoLeche = productoService.crear(new ProductoRequest(
            "LEC-001",
            "Leche Evaporada Entera 400g",
            "Lata de leche",
            lacteos.id(),
            gloria.id(),
            new BigDecimal("4.50"),
            new BigDecimal("15.000"), // Stock mínimo 15 latas
            UnidadMedida.LATA,
            new LoteInicialRequest("LT-001", new BigDecimal("10.000"), vencimientoLote1)
        ), adminUser.getEmail());

        assertThat(productoLeche.id()).isNotNull();
        assertThat(productoLeche.stockTotal()).isEqualByComparingTo("10.000");
        assertThat(productoLeche.bajoStock()).isTrue(); // 10 < stockMinimo 15

        // 3. Registrar Compra para ingresar Lote 2 (20 latas con vencimiento en 6 meses)
        LocalDate vencimientoLote2 = LocalDate.now().plusMonths(6);
        CompraResponse compra = compraService.registrarCompra(new CompraRequest(
            gloria.id(),
            List.of(new ItemCompraRequest(
                productoLeche.id(),
                "LT-002",
                new BigDecimal("20.000"),
                new BigDecimal("3.50"),
                vencimientoLote2
            ))
        ), adminUser.getEmail());

        assertThat(compra.id()).isNotNull();
        assertThat(compra.total()).isEqualByComparingTo("70.00"); // 20 * 3.50

        // Verificar stock acumulado del producto (10 + 20 = 30)
        ProductoResponse productoActualizado = productoService.obtenerPorId(productoLeche.id());
        assertThat(productoActualizado.stockTotal()).isEqualByComparingTo("30.000");
        assertThat(productoActualizado.bajoStock()).isFalse(); // 30 >= 15

        // 4. Verificar Kardex de movimientos (2 entradas: inicial y por compra)
        List<MovimientoResponse> movimientos = inventarioService.listarMovimientos(productoLeche.id(), null);
        assertThat(movimientos).hasSize(2);
        assertThat(movimientos.get(0).tipo()).isEqualTo(TipoMovimientoInventario.ENTRADA);

        // 5. Realizar Venta automática FEFO (pedir 15 latas: debe tomar 10 del LT-001 y 5 del LT-002)
        VentaResponse venta = ventaService.registrarVenta(new VentaRequest(
            List.of(new ItemVentaRequest(productoLeche.id(), new BigDecimal("15.000"), null, null))
        ), adminUser.getEmail());

        assertThat(venta.id()).isNotNull();
        assertThat(venta.total()).isEqualByComparingTo("67.50"); // 15 * 4.50
        assertThat(venta.detalles()).hasSize(2);

        // Detalle 1: LT-001 consumido completamente (10 latas)
        assertThat(venta.detalles().get(0).codigoLote()).isEqualTo("LT-001");
        assertThat(venta.detalles().get(0).cantidad()).isEqualByComparingTo("10.000");

        // Detalle 2: LT-002 consumido parcialmente (5 latas)
        assertThat(venta.detalles().get(1).codigoLote()).isEqualTo("LT-002");
        assertThat(venta.detalles().get(1).cantidad()).isEqualByComparingTo("5.000");

        // Verificar stock de los lotes en base de datos
        LoteProducto lote1 = loteProductoRepository.findByProductoIdAndCodigoLote(productoLeche.id(), "LT-001").orElseThrow();
        LoteProducto lote2 = loteProductoRepository.findByProductoIdAndCodigoLote(productoLeche.id(), "LT-002").orElseThrow();
        assertThat(lote1.getCantidadDisponible()).isEqualByComparingTo("0.000");
        assertThat(lote2.getCantidadDisponible()).isEqualByComparingTo("15.000");

        // 6. Intentar vender más stock del disponible (quedan 15 latas, pedir 20 debe fallar)
        assertThatThrownBy(() -> ventaService.registrarVenta(new VentaRequest(
            List.of(new ItemVentaRequest(productoLeche.id(), new BigDecimal("20.000"), null, null))
        ), adminUser.getEmail()))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("Stock insuficiente");

        // 7. Ajuste de inventario (1 lata rota en LT-002, nueva cantidad 14)
        LoteResponse loteAjustado = inventarioService.ajustarInventario(new AjusteInventarioRequest(
            lote2.getId(),
            new BigDecimal("14.000"),
            "Rotura de 1 lata"
        ), adminUser.getEmail());
        assertThat(loteAjustado.cantidadDisponible()).isEqualByComparingTo("14.000");

        // 8. Resumen de Ventas
        ResumenVentasResponse resumen = ventaService.obtenerResumen(LocalDate.now(), LocalDate.now());
        assertThat(resumen.totalVentas()).isEqualTo(1);
        assertThat(resumen.ingresosTotales()).isEqualByComparingTo("67.50");
        assertThat(resumen.topProductos()).hasSize(1);
        assertThat(resumen.topProductos().get(0).cantidadVendida()).isEqualByComparingTo("15.000");

        // 9. Alerta de bajo stock (quedan 14 latas y el mínimo es 15 -> déficit 1)
        List<AlertaBajoStockResponse> alertas = inventarioService.obtenerAlertasBajoStock();
        assertThat(alertas).isNotEmpty();
        assertThat(alertas.get(0).sku()).isEqualTo("LEC-001");
        assertThat(alertas.get(0).deficit()).isEqualByComparingTo("1.000");
    }
}
