package com.diza.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.diza.api.category.Categoria;
import com.diza.api.category.CategoriaRepository;
import com.diza.api.inventory.LoteProducto;
import com.diza.api.inventory.LoteProductoRepository;
import com.diza.api.inventory.MovimientoInventario;
import com.diza.api.inventory.MovimientoInventarioRepository;
import com.diza.api.inventory.TipoMovimientoInventario;
import com.diza.api.product.Producto;
import com.diza.api.product.ProductoRepository;
import com.diza.api.product.UnidadMedida;
import com.diza.api.purchase.Compra;
import com.diza.api.purchase.CompraRepository;
import com.diza.api.purchase.DetalleCompra;
import com.diza.api.purchase.DetalleCompraRepository;
import com.diza.api.purchase.EstadoCompra;
import com.diza.api.sale.DetalleVenta;
import com.diza.api.sale.DetalleVentaRepository;
import com.diza.api.sale.Venta;
import com.diza.api.sale.VentaRepository;
import com.diza.api.supplier.Proveedor;
import com.diza.api.supplier.ProveedorRepository;
import com.diza.api.user.Rol;
import com.diza.api.user.Usuario;
import com.diza.api.user.UsuarioRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DomainPersistenceTests {

    @Autowired
    private CategoriaRepository categoriaRepository;

    @Autowired
    private ProveedorRepository proveedorRepository;

    @Autowired
    private ProductoRepository productoRepository;

    @Autowired
    private LoteProductoRepository loteProductoRepository;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private CompraRepository compraRepository;

    @Autowired
    private DetalleCompraRepository detalleCompraRepository;

    @Autowired
    private VentaRepository ventaRepository;

    @Autowired
    private DetalleVentaRepository detalleVentaRepository;

    @Autowired
    private MovimientoInventarioRepository movimientoInventarioRepository;

    @Test
    void persistsInventoryPurchaseAndSaleTraceability() {
        Categoria categoria = categoriaRepository.save(new Categoria("Vinos", "Vinos nacionales"));
        Proveedor proveedor = proveedorRepository.save(
            new Proveedor("Distribuidora DIZA", "20123456789", "999999999", "ventas@diza.pe")
        );
        Producto producto = productoRepository.save(new Producto(
            "VIN-001",
            "Vino tinto",
            "Botella de vino tinto",
            categoria,
            proveedor,
            new BigDecimal("55.00"),
            new BigDecimal("10.000"),
            UnidadMedida.BOTELLA
        ));
        LoteProducto lote = loteProductoRepository.save(new LoteProducto(
            producto,
            "LT-2026-001",
            new BigDecimal("24.000"),
            LocalDate.now(),
            LocalDate.now().plusYears(2)
        ));
        Usuario usuario = usuarioRepository.save(new Usuario(
            "Administrador",
            "admin@diza.pe",
            "encoded-password",
            Rol.ADMIN
        ));
        Compra compra = compraRepository.save(new Compra(
            proveedor,
            LocalDateTime.now(),
            EstadoCompra.RECIBIDA,
            new BigDecimal("720.00")
        ));
        detalleCompraRepository.save(new DetalleCompra(
            compra,
            producto,
            lote,
            new BigDecimal("24.000"),
            new BigDecimal("30.00"),
            new BigDecimal("720.00")
        ));
        Venta venta = ventaRepository.save(new Venta(
            LocalDateTime.now(),
            new BigDecimal("110.00"),
            usuario
        ));
        detalleVentaRepository.save(new DetalleVenta(
            venta,
            producto,
            lote,
            new BigDecimal("2.000"),
            new BigDecimal("55.00"),
            new BigDecimal("110.00")
        ));
        movimientoInventarioRepository.save(new MovimientoInventario(
            producto,
            lote,
            TipoMovimientoInventario.SALIDA,
            new BigDecimal("2.000"),
            LocalDateTime.now(),
            "Venta registrada",
            usuario,
            null,
            venta
        ));

        assertThat(producto.getUnidadMedida()).isEqualTo(UnidadMedida.BOTELLA);
        assertThat(loteProductoRepository.count()).isEqualTo(1);
        assertThat(detalleCompraRepository.count()).isEqualTo(1);
        assertThat(detalleVentaRepository.count()).isEqualTo(1);
        assertThat(movimientoInventarioRepository.count()).isEqualTo(1);
    }
}
