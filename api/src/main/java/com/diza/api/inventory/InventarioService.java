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
    private final RegularizacionLoteRepository regularizaciones;

    public InventarioService(
        LoteProductoRepository loteProductoRepository,
        MovimientoInventarioRepository movimientoInventarioRepository,
        ProductoRepository productoRepository,
        UsuarioRepository usuarioRepository,
        RegularizacionLoteRepository regularizaciones
    ) {
        this.loteProductoRepository = loteProductoRepository;
        this.movimientoInventarioRepository = movimientoInventarioRepository;
        this.productoRepository = productoRepository;
        this.usuarioRepository = usuarioRepository;
        this.regularizaciones = regularizaciones;
    }

    @Transactional
    public LoteResponse registrarEntrada(EntradaInventarioRequest request, String userEmail) {
        Producto producto = productoRepository.findForUpdate(request.productoId())
            .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado con ID: " + request.productoId()));

        if (!producto.isActivo()) {
            throw new BusinessException("No se pueden registrar entradas de stock para un producto inactivo");
        }

        Usuario usuario = usuarioRepository.findByEmail(userEmail)
            .orElseThrow(() -> new BusinessException("Usuario autenticado no encontrado"));

        validarCantidad(request.cantidad());
        if (request.codigoLote() == null || request.codigoLote().isBlank()) throw new BusinessException("El código de lote es obligatorio");
        VencimientoRequest dato = VencimientoRequest.resolver(request.fechaVencimiento(), request.vencimiento());
        dato.validar(producto);
        LoteProducto lote = loteProductoRepository.findByProductoIdAndCodigoLote(producto.getId(), request.codigoLote().trim()).orElse(null);
        if (lote == null) {
            lote = new LoteProducto(producto, request.codigoLote().trim(), BigDecimal.ZERO, LocalDate.now(java.time.ZoneId.of("America/Lima")), null);
            lote.regularizar(dato);
        } else {
            lote.comprobarCompatibilidad(dato);
        }

        lote.incrementarStock(request.cantidad());
        lote = loteProductoRepository.saveAndFlush(lote);

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
        lote = loteProductoRepository.saveAndFlush(lote);

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
        LocalDate hoy = LocalDate.now(java.time.ZoneId.of("America/Lima"));
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
        if (dias != null && !List.of(0, 7, 15, 30, 90).contains(dias))
            throw new BusinessException("Horizontes permitidos: 7, 15, 30, 90 o 0 (todos)");
        int limiteDias = dias == null ? 7 : dias;
        LocalDate fechaLimite = LocalDate.now(java.time.ZoneId.of("America/Lima")).plusDays(limiteDias);
        return loteProductoRepository.findByCantidadDisponibleGreaterThanOrderByFechaVencimientoAsc(BigDecimal.ZERO).stream()
            .filter(l -> limiteDias == 0 || l.getFechaVencimiento() == null || !l.getFechaVencimiento().isAfter(fechaLimite))
            .map(LoteResponse::from)
            .toList();
    }

    @Transactional
    public List<LoteResponse> recibirLotes(RecepcionLotesRequest request, String email) {
        if (request.lotes() == null || request.lotes().isEmpty()) throw new BusinessException("Indica al menos un lote");
        var codigos = new java.util.HashSet<String>();
        for (var entrada : request.lotes()) {
            if (!codigos.add(entrada.productoId() + ":" + entrada.codigoLote().trim()))
                throw new BusinessException("No repitas un código de lote en la misma recepción");
        }
        return request.lotes().stream().map(e -> registrarEntrada(e, email)).toList();
    }

    private void validarCantidad(BigDecimal cantidad) {
        if (cantidad == null || cantidad.signum() <= 0 || cantidad.stripTrailingZeros().scale() > 3
            || cantidad.compareTo(new BigDecimal("999999999.999")) > 0)
            throw new BusinessException("La cantidad debe ser positiva y tener hasta 3 decimales");
    }

    private Usuario administrador(String email) {
        Usuario usuario = usuarioRepository.findByEmail(email)
            .orElseThrow(() -> new BusinessException("Usuario autenticado no encontrado"));
        if (usuario.getRol() != com.diza.api.user.Rol.ADMIN)
            throw new org.springframework.security.access.AccessDeniedException("La regularización requiere un administrador");
        return usuario;
    }

    @Transactional
    public List<LoteResponse> regularizar(RegularizacionLoteRequest request, String email) {
        Usuario usuario = administrador(email);
        LoteProducto origen = loteProductoRepository.findById(request.loteId())
            .orElseThrow(() -> new ResourceNotFoundException("Lote no encontrado"));
        productoRepository.findForUpdate(origen.getProducto().getId()).orElseThrow();
        if (request.version() == null || request.version() != origen.getVersion())
            throw new BusinessException("El lote cambió; recarga antes de regularizar");
        validarCantidad(request.cantidad());
        if (request.motivo() == null || request.motivo().isBlank()) throw new BusinessException("Indica el motivo de regularización");
        if (request.vencimiento() == null) throw new BusinessException("Indica el vencimiento");
        request.vencimiento().validar(origen.getProducto());
        if (request.cantidad().compareTo(origen.getCantidadDisponible()) > 0)
            throw new BusinessException("La cantidad supera el stock físico del lote");
        String antes = origen.vencimientoActual() + "; stock=" + origen.getCantidadDisponible() + "; heredada=" + origen.isFechaHeredada();
        LoteProducto destino = origen;
        boolean dividir = request.cantidad().compareTo(origen.getCantidadDisponible()) < 0;
        if (dividir) {
            String codigo = request.nuevoCodigoLote() == null ? "" : request.nuevoCodigoLote().trim();
            if (codigo.isBlank() || loteProductoRepository.findByProductoIdAndCodigoLote(origen.getProducto().getId(), codigo).isPresent())
                throw new BusinessException("La división requiere un código de lote nuevo y único");
            destino = new LoteProducto(origen.getProducto(), codigo, request.cantidad(), origen.getFechaIngreso(), null);
            destino.regularizar(request.vencimiento());
            origen.descontarStock(request.cantidad());
            destino = loteProductoRepository.save(destino);
        } else {
            if (request.nuevoCodigoLote() != null && !request.nuevoCodigoLote().isBlank())
                throw new BusinessException("La corrección completa conserva el código original");
            origen.regularizar(request.vencimiento());
        }
        regularizaciones.save(new RegularizacionLote(origen.getProducto(), origen, destino, usuario,
            dividir ? "DIVISION" : "CORRECCION", request.cantidad(), antes,
            destino.vencimientoActual() + "; stock origen=" + origen.getCantidadDisponible() + "; stock destino=" + destino.getCantidadDisponible(), request.motivo().trim()));
        loteProductoRepository.flush();
        return dividir ? List.of(LoteResponse.from(origen), LoteResponse.from(destino)) : List.of(LoteResponse.from(origen));
    }

    @Transactional
    public void definirPolitica(PoliticaVencimientoRequest request, String email) {
        Usuario usuario = administrador(email);
        Producto producto = productoRepository.findForUpdate(request.productoId())
            .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));
        if (request.motivo() == null || request.motivo().isBlank()) throw new BusinessException("Justifica la política del producto");
        String antes = "permite=" + producto.isPermiteSinVencimiento() + "; " + producto.getJustificacionSinVencimiento();
        producto.definirPoliticaVencimiento(request.permiteSinVencimiento(), request.motivo().trim());
        regularizaciones.save(new RegularizacionLote(producto, null, null, usuario, "POLITICA", BigDecimal.ZERO,
            antes, "permite=" + request.permiteSinVencimiento(), request.motivo().trim()));
    }

    @Transactional(readOnly = true)
    public List<RegularizacionLote.Response> historial(Long loteId) {
        return regularizaciones.historial(loteId).stream().map(RegularizacionLote::response).toList();
    }
}
