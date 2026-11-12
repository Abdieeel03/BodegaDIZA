package com.diza.api.sale;

import com.diza.api.common.BusinessException;
import com.diza.api.common.ResourceNotFoundException;
import com.diza.api.inventory.LoteProducto;
import com.diza.api.inventory.LoteProductoRepository;
import com.diza.api.inventory.MovimientoInventario;
import com.diza.api.inventory.MovimientoInventarioRepository;
import com.diza.api.inventory.TipoMovimientoInventario;
import com.diza.api.product.Producto;
import com.diza.api.product.ProductoRepository;
import com.diza.api.user.Usuario;
import com.diza.api.user.UsuarioRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VentaService {

    private final VentaRepository ventaRepository;
    private final DetalleVentaRepository detalleVentaRepository;
    private final ProductoRepository productoRepository;
    private final LoteProductoRepository loteProductoRepository;
    private final MovimientoInventarioRepository movimientoInventarioRepository;
    private final UsuarioRepository usuarioRepository;

    public VentaService(
        VentaRepository ventaRepository,
        DetalleVentaRepository detalleVentaRepository,
        ProductoRepository productoRepository,
        LoteProductoRepository loteProductoRepository,
        MovimientoInventarioRepository movimientoInventarioRepository,
        UsuarioRepository usuarioRepository
    ) {
        this.ventaRepository = ventaRepository;
        this.detalleVentaRepository = detalleVentaRepository;
        this.productoRepository = productoRepository;
        this.loteProductoRepository = loteProductoRepository;
        this.movimientoInventarioRepository = movimientoInventarioRepository;
        this.usuarioRepository = usuarioRepository;
    }

    private record AsignacionLote(
        Producto producto,
        LoteProducto lote,
        BigDecimal cantidad,
        BigDecimal precioUnitario,
        BigDecimal subtotal
    ) {}

    @Transactional
    public VentaResponse registrarVenta(VentaRequest request, String userEmail) {
        Usuario usuario = usuarioRepository.findByEmail(userEmail)
            .orElseThrow(() -> new BusinessException("Usuario autenticado no encontrado"));

        LocalDate hoy = LocalDate.now();
        List<AsignacionLote> asignaciones = new ArrayList<>();
        BigDecimal totalVenta = BigDecimal.ZERO;

        for (ItemVentaRequest item : request.items()) {
            Producto producto = productoRepository.findById(item.productoId())
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado con ID: " + item.productoId()));

            if (!producto.isActivo()) {
                throw new BusinessException("El producto '" + producto.getNombre() + "' se encuentra inactivo y no se puede vender");
            }

            BigDecimal precioUnitario = item.precioUnitario() != null
                ? item.precioUnitario()
                : producto.getPrecioVenta();

            if (item.loteId() != null) {
                LoteProducto lote = loteProductoRepository.findById(item.loteId())
                    .orElseThrow(() -> new ResourceNotFoundException("Lote no encontrado con ID: " + item.loteId()));

                if (!lote.getProducto().getId().equals(producto.getId())) {
                    throw new BusinessException("El lote " + lote.getCodigoLote() + " no pertenece al producto " + producto.getNombre());
                }

                if (lote.getFechaVencimiento().isBefore(hoy)) {
                    throw new BusinessException("El lote " + lote.getCodigoLote() + " se encuentra vencido desde " + lote.getFechaVencimiento());
                }

                if (lote.getCantidadDisponible().compareTo(item.cantidad()) < 0) {
                    throw new BusinessException("Stock insuficiente en el lote " + lote.getCodigoLote()
                        + ". Disponible: " + lote.getCantidadDisponible() + ", Solicitado: " + item.cantidad());
                }

                BigDecimal subtotal = precioUnitario.multiply(item.cantidad());
                asignaciones.add(new AsignacionLote(producto, lote, item.cantidad(), precioUnitario, subtotal));
                totalVenta = totalVenta.add(subtotal);
            } else {
                List<LoteProducto> lotesDisponibles = loteProductoRepository.findLotesDisponiblesParaVenta(producto.getId(), hoy);
                BigDecimal totalDisponible = lotesDisponibles.stream()
                    .map(LoteProducto::getCantidadDisponible)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

                if (totalDisponible.compareTo(item.cantidad()) < 0) {
                    throw new BusinessException("Stock insuficiente para el producto '" + producto.getNombre()
                        + "'. Stock disponible: " + totalDisponible + ", Solicitado: " + item.cantidad());
                }

                BigDecimal restante = item.cantidad();
                for (LoteProducto lote : lotesDisponibles) {
                    if (restante.compareTo(BigDecimal.ZERO) <= 0) {
                        break;
                    }
                    BigDecimal tomar = lote.getCantidadDisponible().min(restante);
                    BigDecimal subtotal = precioUnitario.multiply(tomar);
                    asignaciones.add(new AsignacionLote(producto, lote, tomar, precioUnitario, subtotal));
                    totalVenta = totalVenta.add(subtotal);
                    restante = restante.subtract(tomar);
                }
            }
        }

        Venta venta = new Venta(LocalDateTime.now(), totalVenta, usuario);
        venta = ventaRepository.save(venta);

        List<DetalleVenta> detallesGuardados = new ArrayList<>();
        for (AsignacionLote asignacion : asignaciones) {
            LoteProducto lote = asignacion.lote();
            lote.descontarStock(asignacion.cantidad());
            loteProductoRepository.save(lote);

            DetalleVenta detalle = new DetalleVenta(
                venta,
                asignacion.producto(),
                lote,
                asignacion.cantidad(),
                asignacion.precioUnitario(),
                asignacion.subtotal()
            );
            detallesGuardados.add(detalleVentaRepository.save(detalle));

            MovimientoInventario movimiento = new MovimientoInventario(
                asignacion.producto(),
                lote,
                TipoMovimientoInventario.SALIDA,
                asignacion.cantidad(),
                venta.getFecha(),
                "Salida por venta #" + venta.getId(),
                usuario,
                null,
                venta
            );
            movimientoInventarioRepository.save(movimiento);
        }

        return VentaResponse.of(venta, detallesGuardados);
    }

    @Transactional(readOnly = true)
    public List<VentaResponse> listarVentas(LocalDate desde, LocalDate hasta) {
        List<Venta> ventas;
        if (desde != null && hasta != null) {
            LocalDateTime inicio = desde.atStartOfDay();
            LocalDateTime fin = hasta.atTime(LocalTime.MAX);
            ventas = ventaRepository.findByFechaBetweenOrderByFechaDesc(inicio, fin);
        } else {
            ventas = ventaRepository.findAllByOrderByFechaDesc();
        }

        return ventas.stream()
            .map(v -> {
                List<DetalleVenta> detalles = detalleVentaRepository.findByVentaId(v.getId());
                return VentaResponse.of(v, detalles);
            })
            .toList();
    }

    @Transactional(readOnly = true)
    public VentaResponse obtenerPorId(Long id) {
        Venta venta = ventaRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Venta no encontrada con ID: " + id));
        List<DetalleVenta> detalles = detalleVentaRepository.findByVentaId(id);
        return VentaResponse.of(venta, detalles);
    }

    @Transactional(readOnly = true)
    public ResumenVentasResponse obtenerResumen(LocalDate desde, LocalDate hasta) {
        LocalDate fechaInicio = desde != null ? desde : LocalDate.now();
        LocalDate fechaFin = hasta != null ? hasta : LocalDate.now();

        LocalDateTime inicio = fechaInicio.atStartOfDay();
        LocalDateTime fin = fechaFin.atTime(LocalTime.MAX);

        long totalVentas = ventaRepository.countByFechaBetween(inicio, fin);
        BigDecimal ingresosTotales = ventaRepository.sumTotalByFechaBetween(inicio, fin);
        BigDecimal ticketPromedio = totalVentas > 0
            ? ingresosTotales.divide(BigDecimal.valueOf(totalVentas), 2, RoundingMode.HALF_UP)
            : BigDecimal.ZERO;

        List<Object[]> rows = detalleVentaRepository.findTopProductosVendidos(inicio, fin);
        List<ProductoVendidoResumen> topProductos = rows.stream()
            .map(row -> new ProductoVendidoResumen(
                (Long) row[0],
                (String) row[1],
                (String) row[2],
                (BigDecimal) row[3],
                (BigDecimal) row[4]
            ))
            .toList();

        return new ResumenVentasResponse(
            totalVentas,
            ingresosTotales,
            ticketPromedio,
            inicio,
            fin,
            topProductos
        );
    }
}
