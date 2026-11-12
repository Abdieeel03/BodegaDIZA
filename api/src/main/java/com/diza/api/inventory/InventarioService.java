package com.diza.api.inventory;

import com.diza.api.common.BusinessException;
import com.diza.api.common.ResourceNotFoundException;
import com.diza.api.product.Producto;
import com.diza.api.product.ProductoRepository;
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
public class InventarioService {

    private final LoteProductoRepository loteProductoRepository;
    private final MovimientoInventarioRepository movimientoInventarioRepository;
    private final ProductoRepository productoRepository;
    private final UsuarioRepository usuarioRepository;

    public InventarioService(
        LoteProductoRepository loteProductoRepository,
        MovimientoInventarioRepository movimientoInventarioRepository,
        ProductoRepository productoRepository,
        UsuarioRepository usuarioRepository
    ) {
        this.loteProductoRepository = loteProductoRepository;
        this.movimientoInventarioRepository = movimientoInventarioRepository;
        this.productoRepository = productoRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional
    public LoteResponse registrarEntrada(EntradaInventarioRequest request, String userEmail) {
        Producto producto = productoRepository.findById(request.productoId())
            .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado con ID: " + request.productoId()));

        if (!producto.isActivo()) {
            throw new BusinessException("No se pueden registrar entradas de stock para un producto inactivo");
        }

        Usuario usuario = usuarioRepository.findByEmail(userEmail)
            .orElseThrow(() -> new BusinessException("Usuario autenticado no encontrado"));

        LoteProducto lote = loteProductoRepository
            .findByProductoIdAndCodigoLote(producto.getId(), request.codigoLote().trim())
            .orElseGet(() -> new LoteProducto(
                producto,
                request.codigoLote().trim(),
                BigDecimal.ZERO,
                LocalDate.now(),
                request.fechaVencimiento()
            ));

        lote.incrementarStock(request.cantidad());
        lote = loteProductoRepository.save(lote);

        String motivo = (request.motivo() != null && !request.motivo().isBlank())
            ? request.motivo().trim()
            : "Entrada directa a inventario";

        MovimientoInventario movimiento = new MovimientoInventario(
            producto,
            lote,
            TipoMovimientoInventario.ENTRADA,
            request.cantidad(),
            LocalDateTime.now(),
            motivo,
            usuario,
            null,
            null
        );
        movimientoInventarioRepository.save(movimiento);

        return LoteResponse.from(lote);
    }

    @Transactional
    public LoteResponse ajustarInventario(AjusteInventarioRequest request, String userEmail) {
        LoteProducto lote = loteProductoRepository.findById(request.loteId())
            .orElseThrow(() -> new ResourceNotFoundException("Lote no encontrado con ID: " + request.loteId()));

        Usuario usuario = usuarioRepository.findByEmail(userEmail)
            .orElseThrow(() -> new BusinessException("Usuario autenticado no encontrado"));

        BigDecimal cantidadPrevia = lote.getCantidadDisponible();
        BigDecimal nuevaCantidad = request.nuevaCantidadDisponible();
        BigDecimal diferencia = nuevaCantidad.subtract(cantidadPrevia).abs();

        if (diferencia.compareTo(BigDecimal.ZERO) == 0) {
            return LoteResponse.from(lote);
        }

        lote.ajustarStock(nuevaCantidad);
        lote = loteProductoRepository.save(lote);

        MovimientoInventario movimiento = new MovimientoInventario(
            lote.getProducto(),
            lote,
            TipoMovimientoInventario.AJUSTE,
            diferencia,
            LocalDateTime.now(),
            request.motivo().trim(),
            usuario,
            null,
            null
        );
        movimientoInventarioRepository.save(movimiento);

        return LoteResponse.from(lote);
    }

    @Transactional(readOnly = true)
    public List<LoteResponse> listarLotes(Long productoId, Boolean soloDisponibles) {
        List<LoteProducto> lotes;
        if (productoId != null) {
            lotes = loteProductoRepository.findByProductoIdOrderByFechaVencimientoAsc(productoId);
        } else {
            lotes = loteProductoRepository.findAllByOrderByFechaVencimientoAsc();
        }

        if (Boolean.TRUE.equals(soloDisponibles)) {
            lotes = lotes.stream()
                .filter(l -> l.getCantidadDisponible().compareTo(BigDecimal.ZERO) > 0)
                .toList();
        }

        return lotes.stream().map(LoteResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<MovimientoResponse> listarMovimientos(Long productoId, TipoMovimientoInventario tipo) {
        List<MovimientoInventario> movimientos;
        if (productoId != null && tipo != null) {
            movimientos = movimientoInventarioRepository.findByProductoIdAndTipoOrderByFechaDesc(productoId, tipo);
        } else if (productoId != null) {
            movimientos = movimientoInventarioRepository.findByProductoIdOrderByFechaDesc(productoId);
        } else if (tipo != null) {
            movimientos = movimientoInventarioRepository.findByTipoOrderByFechaDesc(tipo);
        } else {
            movimientos = movimientoInventarioRepository.findAllByOrderByFechaDesc();
        }
        return movimientos.stream().map(MovimientoResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AlertaBajoStockResponse> obtenerAlertasBajoStock() {
        List<Producto> productos = productoRepository.findByActivoTrueOrderByNombreAsc();
        LocalDate hoy = LocalDate.now();
        List<AlertaBajoStockResponse> alertas = new ArrayList<>();

        for (Producto producto : productos) {
            BigDecimal stockActual = loteProductoRepository.sumStockDisponibleByProductoId(producto.getId(), hoy);
            if (stockActual.compareTo(producto.getStockMinimo()) <= 0) {
                BigDecimal deficit = producto.getStockMinimo().subtract(stockActual);
                alertas.add(new AlertaBajoStockResponse(
                    producto.getId(),
                    producto.getSku(),
                    producto.getNombre(),
                    stockActual,
                    producto.getStockMinimo(),
                    deficit.max(BigDecimal.ZERO),
                    producto.getUnidadMedida().name()
                ));
            }
        }

        alertas.sort((a, b) -> b.deficit().compareTo(a.deficit()));
        return alertas;
    }

    @Transactional(readOnly = true)
    public List<LoteResponse> obtenerAlertasVencimiento(Integer dias) {
        int limiteDias = (dias != null && dias > 0) ? dias : 7;
        LocalDate fechaLimite = LocalDate.now().plusDays(limiteDias);
        return loteProductoRepository.findLotesPorVencer(fechaLimite).stream()
            .map(LoteResponse::from)
            .toList();
    }
}
