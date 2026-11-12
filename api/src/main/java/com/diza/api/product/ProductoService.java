package com.diza.api.product;

import com.diza.api.category.Categoria;
import com.diza.api.category.CategoriaService;
import com.diza.api.common.BusinessException;
import com.diza.api.common.ResourceNotFoundException;
import com.diza.api.inventory.LoteProducto;
import com.diza.api.inventory.LoteProductoRepository;
import com.diza.api.inventory.MovimientoInventario;
import com.diza.api.inventory.MovimientoInventarioRepository;
import com.diza.api.inventory.TipoMovimientoInventario;
import com.diza.api.supplier.Proveedor;
import com.diza.api.supplier.ProveedorService;
import com.diza.api.user.Usuario;
import com.diza.api.user.UsuarioRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductoService {

    private final ProductoRepository productoRepository;
    private final CategoriaService categoriaService;
    private final ProveedorService proveedorService;
    private final LoteProductoRepository loteProductoRepository;
    private final MovimientoInventarioRepository movimientoInventarioRepository;
    private final UsuarioRepository usuarioRepository;

    public ProductoService(
        ProductoRepository productoRepository,
        CategoriaService categoriaService,
        ProveedorService proveedorService,
        LoteProductoRepository loteProductoRepository,
        MovimientoInventarioRepository movimientoInventarioRepository,
        UsuarioRepository usuarioRepository
    ) {
        this.productoRepository = productoRepository;
        this.categoriaService = categoriaService;
        this.proveedorService = proveedorService;
        this.loteProductoRepository = loteProductoRepository;
        this.movimientoInventarioRepository = movimientoInventarioRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public List<ProductoResponse> listar(String search, Long categoriaId, Boolean soloActivos) {
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;
        List<Producto> productos = productoRepository.buscarProductos(cleanSearch, categoriaId, soloActivos);
        LocalDate hoy = LocalDate.now();

        return productos.stream()
            .map(p -> {
                BigDecimal stock = loteProductoRepository.sumStockDisponibleByProductoId(p.getId(), hoy);
                return ProductoResponse.of(p, stock);
            })
            .toList();
    }

    @Transactional(readOnly = true)
    public ProductoResponse obtenerPorId(Long id) {
        Producto producto = buscarEntidadPorId(id);
        BigDecimal stock = loteProductoRepository.sumStockDisponibleByProductoId(id, LocalDate.now());
        return ProductoResponse.of(producto, stock);
    }

    @Transactional
    public ProductoResponse crear(ProductoRequest request, String userEmail) {
        if (productoRepository.existsBySkuIgnoreCase(request.sku().trim())) {
            throw new BusinessException("Ya existe un producto con el SKU: " + request.sku());
        }

        Categoria categoria = categoriaService.buscarEntidadPorId(request.categoriaId());
        if (!categoria.isActiva()) {
            throw new BusinessException("No se puede asociar una categoría inactiva");
        }

        Proveedor proveedor = proveedorService.buscarEntidadPorId(request.proveedorId());
        if (!proveedor.isActivo()) {
            throw new BusinessException("No se puede asociar un proveedor inactivo");
        }

        Producto producto = new Producto(
            request.sku().trim().toUpperCase(),
            request.nombre().trim(),
            request.descripcion(),
            categoria,
            proveedor,
            request.precioVenta(),
            request.stockMinimo(),
            request.unidadMedida()
        );
        producto = productoRepository.save(producto);

        if (request.loteInicial() != null) {
            Usuario usuario = usuarioRepository.findByEmail(userEmail)
                .orElseThrow(() -> new BusinessException("Usuario autenticado no encontrado"));

            LoteProducto lote = new LoteProducto(
                producto,
                request.loteInicial().codigoLote().trim(),
                request.loteInicial().cantidad(),
                LocalDate.now(),
                request.loteInicial().fechaVencimiento()
            );
            lote = loteProductoRepository.save(lote);

            MovimientoInventario movimiento = new MovimientoInventario(
                producto,
                lote,
                TipoMovimientoInventario.ENTRADA,
                request.loteInicial().cantidad(),
                LocalDateTime.now(),
                "Stock inicial al registrar producto",
                usuario,
                null,
                null
            );
            movimientoInventarioRepository.save(movimiento);
        }

        BigDecimal stock = loteProductoRepository.sumStockDisponibleByProductoId(producto.getId(), LocalDate.now());
        return ProductoResponse.of(producto, stock);
    }

    @Transactional
    public ProductoResponse actualizar(Long id, ProductoRequest request) {
        Producto producto = buscarEntidadPorId(id);

        if (productoRepository.existsBySkuIgnoreCaseAndIdNot(request.sku().trim(), id)) {
            throw new BusinessException("Ya existe otro producto con el SKU: " + request.sku());
        }

        Categoria categoria = categoriaService.buscarEntidadPorId(request.categoriaId());
        Proveedor proveedor = proveedorService.buscarEntidadPorId(request.proveedorId());

        producto.actualizar(
            request.sku().trim().toUpperCase(),
            request.nombre().trim(),
            request.descripcion(),
            categoria,
            proveedor,
            request.precioVenta(),
            request.stockMinimo(),
            request.unidadMedida()
        );

        BigDecimal stock = loteProductoRepository.sumStockDisponibleByProductoId(id, LocalDate.now());
        return ProductoResponse.of(producto, stock);
    }

    @Transactional
    public ProductoResponse cambiarEstado(Long id, boolean activo) {
        Producto producto = buscarEntidadPorId(id);
        producto.setActivo(activo);
        BigDecimal stock = loteProductoRepository.sumStockDisponibleByProductoId(id, LocalDate.now());
        return ProductoResponse.of(producto, stock);
    }

    public Producto buscarEntidadPorId(Long id) {
        return productoRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado con ID: " + id));
    }
}
