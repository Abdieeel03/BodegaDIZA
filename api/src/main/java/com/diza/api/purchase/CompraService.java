package com.diza.api.purchase;

import com.diza.api.common.BusinessException;
import com.diza.api.common.ResourceNotFoundException;
import com.diza.api.inventory.LoteProducto;
import com.diza.api.inventory.LoteProductoRepository;
import com.diza.api.inventory.MovimientoInventario;
import com.diza.api.inventory.MovimientoInventarioRepository;
import com.diza.api.inventory.TipoMovimientoInventario;
import com.diza.api.product.Producto;
import com.diza.api.product.ProductoRepository;
import com.diza.api.supplier.Proveedor;
import com.diza.api.supplier.ProveedorRepository;
import com.diza.api.user.Usuario;
import com.diza.api.user.UsuarioRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompraService {

    private final CompraRepository compraRepository;
    private final DetalleCompraRepository detalleCompraRepository;
    private final ProveedorRepository proveedorRepository;
    private final ProductoRepository productoRepository;
    private final LoteProductoRepository loteProductoRepository;
    private final MovimientoInventarioRepository movimientoInventarioRepository;
    private final UsuarioRepository usuarioRepository;

    public CompraService(
        CompraRepository compraRepository,
        DetalleCompraRepository detalleCompraRepository,
        ProveedorRepository proveedorRepository,
        ProductoRepository productoRepository,
        LoteProductoRepository loteProductoRepository,
        MovimientoInventarioRepository movimientoInventarioRepository,
        UsuarioRepository usuarioRepository
    ) {
        this.compraRepository = compraRepository;
        this.detalleCompraRepository = detalleCompraRepository;
        this.proveedorRepository = proveedorRepository;
        this.productoRepository = productoRepository;
        this.loteProductoRepository = loteProductoRepository;
        this.movimientoInventarioRepository = movimientoInventarioRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional
    public CompraResponse registrarCompra(CompraRequest request, String userEmail) {
        Proveedor proveedor = proveedorRepository.findById(request.proveedorId())
            .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado con ID: " + request.proveedorId()));

        if (!proveedor.isActivo()) {
            throw new BusinessException("No se pueden registrar compras a un proveedor inactivo");
        }

        Usuario usuario = usuarioRepository.findByEmail(userEmail)
            .orElseThrow(() -> new BusinessException("Usuario autenticado no encontrado"));

        BigDecimal total = BigDecimal.ZERO;
        for (ItemCompraRequest item : request.items()) {
            BigDecimal subtotal = item.costoUnitario().multiply(item.cantidad());
            total = total.add(subtotal);
        }

        Compra compra = new Compra(proveedor, LocalDateTime.now(), EstadoCompra.RECIBIDA, total);
        compra = compraRepository.save(compra);

        List<DetalleCompra> detalles = new ArrayList<>();

        for (ItemCompraRequest item : request.items()) {
            Producto producto = productoRepository.findById(item.productoId())
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado con ID: " + item.productoId()));

            if (!producto.isActivo()) {
                throw new BusinessException("No se pueden comprar productos inactivos: " + producto.getNombre());
            }

            LoteProducto lote = loteProductoRepository
                .findByProductoIdAndCodigoLote(producto.getId(), item.codigoLote().trim())
                .orElseGet(() -> new LoteProducto(
                    producto,
                    item.codigoLote().trim(),
                    BigDecimal.ZERO,
                    LocalDate.now(),
                    item.fechaVencimiento()
                ));

            lote.incrementarStock(item.cantidad());
            lote = loteProductoRepository.save(lote);

            BigDecimal subtotal = item.costoUnitario().multiply(item.cantidad());
            DetalleCompra detalle = new DetalleCompra(compra, producto, lote, item.cantidad(), item.costoUnitario(), subtotal);
            detalles.add(detalleCompraRepository.save(detalle));

            MovimientoInventario movimiento = new MovimientoInventario(
                producto,
                lote,
                TipoMovimientoInventario.ENTRADA,
                item.cantidad(),
                compra.getFecha(),
                "Entrada por compra #" + compra.getId(),
                usuario,
                compra,
                null
            );
            movimientoInventarioRepository.save(movimiento);
        }

        return CompraResponse.of(compra, detalles);
    }

    @Transactional(readOnly = true)
    public List<CompraResponse> listarCompras(Long proveedorId) {
        List<Compra> compras = (proveedorId != null)
            ? compraRepository.findByProveedorIdOrderByFechaDesc(proveedorId)
            : compraRepository.findAllByOrderByFechaDesc();

        return compras.stream()
            .map(c -> {
                List<DetalleCompra> detalles = detalleCompraRepository.findByCompraId(c.getId());
                return CompraResponse.of(c, detalles);
            })
            .toList();
    }

    @Transactional(readOnly = true)
    public CompraResponse obtenerPorId(Long id) {
        Compra compra = compraRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Compra no encontrada con ID: " + id));
        List<DetalleCompra> detalles = detalleCompraRepository.findByCompraId(id);
        return CompraResponse.of(compra, detalles);
    }
}
