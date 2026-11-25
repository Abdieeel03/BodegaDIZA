package com.diza.api.purchase;

import com.diza.api.common.BusinessException;
import com.diza.api.common.ResourceNotFoundException;
import com.diza.api.inventory.*;
import com.diza.api.ml.MlServiceClient;
import com.diza.api.ml.ReplenishmentOptimizationItemResponse;
import com.diza.api.product.Producto;
import com.diza.api.product.ProductoRepository;
import com.diza.api.user.Rol;
import com.diza.api.user.Usuario;
import com.diza.api.user.UsuarioRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PedidoCompraService {
    private static final ZoneId LIMA = ZoneId.of("America/Lima");
    private static final BigDecimal MAX = new BigDecimal("9999999999.99");
    private final CompraRepository compras;
    private final DetalleCompraRepository detalles;
    private final ProductoRepository productos;
    private final LoteProductoRepository lotes;
    private final MovimientoInventarioRepository movimientos;
    private final UsuarioRepository usuarios;
    private final MlServiceClient ml;

    public PedidoCompraService(CompraRepository compras, DetalleCompraRepository detalles,
            ProductoRepository productos, LoteProductoRepository lotes,
            MovimientoInventarioRepository movimientos, UsuarioRepository usuarios, MlServiceClient ml) {
        this.compras = compras; this.detalles = detalles; this.productos = productos;
        this.lotes = lotes; this.movimientos = movimientos; this.usuarios = usuarios; this.ml = ml;
    }

    private Usuario admin(String email) {
        Usuario usuario = usuarios.findByEmail(email).orElseThrow(() -> new BusinessException("Usuario no encontrado"));
        if (usuario.getRol() != Rol.ADMIN) throw new org.springframework.security.access.AccessDeniedException("Se requiere un administrador");
        return usuario;
    }

    private Compra pendiente(Long id) {
        Compra compra = compras.findForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Pedido no encontrado"));
        if (compra.getEstado() != EstadoCompra.PENDIENTE) throw new BusinessException("El pedido ya no está pendiente");
        return compra;
    }

    private Producto bloquear(String sku) {
        return productos.findForUpdateBySku(sku).orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado: " + sku));
    }

    private static boolean dineroValido(BigDecimal valor) {
        return valor != null && valor.signum() > 0 && valor.stripTrailingZeros().scale() <= 2 && valor.compareTo(MAX) <= 0;
    }

    private record Linea(Producto producto, BigDecimal cantidad, BigDecimal costo) {
        BigDecimal subtotal() { return cantidad.multiply(costo).setScale(2, java.math.RoundingMode.UNNECESSARY); }
    }

    /** Revalida la necesidad vigente y los costos; guarda por proveedor, sin lotes ni movimientos. */
    @Transactional
    public List<CompraResponse> confirmar(PedidoCompraRequest request, String email) {
        Usuario usuario = admin(email);
        if (!dineroValido(request.presupuesto()) || request.items() == null || request.items().isEmpty() || request.items().size() > 500)
            throw new BusinessException("Indica un presupuesto válido y al menos un producto");
        var seleccion = new TreeMap<String, PedidoCompraRequest.Item>();
        for (var item : request.items()) {
            if (item == null || item.sku() == null || item.sku().isBlank() || item.cantidad() == null || item.cantidad() < 1
                    || item.cantidad() > 999999999 || !dineroValido(item.costoUnitario()))
                throw new BusinessException("Producto, cantidad o costo inválido");
            String sku = item.sku().trim();
            if (seleccion.putIfAbsent(sku, item) != null) throw new BusinessException("SKU repetido: " + sku);
        }
        var catalogo = new LinkedHashMap<String, Producto>();
        // El bloqueo evita que dos confirmaciones simultáneas creen pedidos para el mismo SKU.
        for (String sku : seleccion.keySet()) {
            Producto p = bloquear(sku);
            var item = seleccion.get(sku);
            if (!p.isActivo() || !p.getProveedor().isActivo()) throw new BusinessException("Producto o proveedor inactivo: " + sku);
            if (p.getPrecioCosto() == null || p.getPrecioCosto().compareTo(item.costoUnitario()) != 0
                    || !Objects.equals(p.getProveedor().getNombre(), item.proveedor()))
                throw new BusinessException("Cambió el costo o proveedor de " + sku + "; calcula otro plan");
            if (detalles.existsByProductoIdAndCompraEstado(p.getId(), EstadoCompra.PENDIENTE))
                throw new BusinessException("Ya existe un pedido pendiente para " + sku + "; recíbelo o cancélalo antes de volver a pedirlo");
            catalogo.put(sku, p);
        }
        var vigente = ml.optimizeReplenishment(request.presupuesto().doubleValue());
        Map<String, ReplenishmentOptimizationItemResponse> necesidades = vigente.items().stream()
            .collect(Collectors.toMap(ReplenishmentOptimizationItemResponse::productId, Function.identity()));
        Map<Long, List<Linea>> grupos = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO;
        for (var entry : seleccion.entrySet()) {
            String sku = entry.getKey();
            var item = entry.getValue();
            var necesidad = necesidades.get(sku);
            if (necesidad == null || item.cantidad() > necesidad.recommendedReplenishment())
                throw new BusinessException("Cambió la necesidad de " + sku + "; calcula otro plan");
            Producto p = catalogo.get(sku);
            var linea = new Linea(p, BigDecimal.valueOf(item.cantidad()), p.getPrecioCosto());
            total = total.add(linea.subtotal());
            grupos.computeIfAbsent(p.getProveedor().getId(), k -> new ArrayList<>()).add(linea);
        }
        if (total.compareTo(request.presupuesto()) > 0) throw new BusinessException("La propuesta supera el presupuesto");
        List<CompraResponse> resultado = new ArrayList<>();
        for (var grupo : grupos.values()) {
            BigDecimal subtotal = grupo.stream().map(Linea::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
            Compra compra = new Compra(grupo.getFirst().producto().getProveedor(), LocalDateTime.now(LIMA), EstadoCompra.PENDIENTE, subtotal);
            compra.confirmarPor(usuario);
            compra = compras.save(compra);
            List<DetalleCompra> filas = new ArrayList<>();
            for (Linea linea : grupo) filas.add(detalles.save(new DetalleCompra(compra, linea.producto(), null,
                linea.cantidad(), linea.costo(), linea.subtotal())));
            resultado.add(CompraResponse.of(compra, filas));
        }
        return resultado;
    }

    /** Recibe un pedido completo, incluso si una línea llega en varios lotes. */
    @Transactional
    public CompraResponse recibir(Long id, RecepcionPedidoRequest request, String email) {
        Usuario usuario = admin(email);
        Compra compra = pendiente(id);
        List<DetalleCompra> originales = detalles.findByCompraId(id);
        if (originales.isEmpty() || originales.stream().anyMatch(d -> d.getLote() != null))
            throw new BusinessException("El pedido no tiene detalles pendientes válidos");
        if (request.lotes() == null || request.lotes().isEmpty() || request.lotes().size() > 1000)
            throw new BusinessException("Indica los lotes recibidos");
        Map<Long, DetalleCompra> porProducto = originales.stream().collect(Collectors.toMap(d -> d.getProducto().getId(), Function.identity()));
        Map<Long, Long> sumas = new HashMap<>();
        Set<String> codigos = new HashSet<>();
        for (var entrada : request.lotes()) {
            if (entrada == null || !porProducto.containsKey(entrada.productoId()) || entrada.cantidad() == null
                    || entrada.cantidad() <= 0 || entrada.cantidad() > 999999999 || entrada.codigoLote() == null
                    || entrada.codigoLote().isBlank() || entrada.codigoLote().trim().length() > 100 || entrada.vencimiento() == null)
                throw new BusinessException("Lote inválido o producto ajeno al pedido");
            if (!codigos.add(entrada.productoId() + ":" + entrada.codigoLote().trim())) throw new BusinessException("No repitas un código de lote");
            sumas.merge(entrada.productoId(), entrada.cantidad().longValue(), Long::sum);
        }
        for (var detalle : originales) {
            if (detalle.getCantidad().compareTo(BigDecimal.valueOf(sumas.getOrDefault(detalle.getProducto().getId(), 0L))) != 0)
                throw new BusinessException("La cantidad recibida debe coincidir con el pedido: " + detalle.getProducto().getSku());
        }
        // Bloqueos en el mismo orden que al confirmar.
        Map<Long, Producto> bloqueados = new HashMap<>();
        for (var detalle : originales.stream().sorted(Comparator.comparing(d -> d.getProducto().getSku())).toList()) {
            Producto p = bloquear(detalle.getProducto().getSku());
            if (!p.isActivo()) throw new BusinessException("Producto inactivo: " + p.getSku());
            bloqueados.put(p.getId(), p);
        }
        LocalDate hoy = LocalDate.now(LIMA);
        LocalDateTime ahora = LocalDateTime.now(LIMA);
        // Validar todas las fechas y compatibilidades antes de modificar existencias.
        for (var entrada : request.lotes()) {
            Producto p = bloqueados.get(entrada.productoId());
            var dato = entrada.vencimiento();
            dato.validar(p);
            if (dato.precision() == PrecisionVencimiento.EXACTA && dato.fecha().isBefore(hoy))
                throw new BusinessException("No se puede recibir una compra con fecha vencida: " + p.getSku());
            lotes.findByProductoIdAndCodigoLote(p.getId(), entrada.codigoLote().trim()).ifPresent(l -> l.comprobarCompatibilidad(dato));
        }
        Set<Long> primeraLinea = new HashSet<>();
        List<DetalleCompra> recibidos = new ArrayList<>();
        for (var entrada : request.lotes()) {
            Producto p = bloqueados.get(entrada.productoId());
            var original = porProducto.get(p.getId());
            BigDecimal cantidad = BigDecimal.valueOf(entrada.cantidad());
            String codigo = entrada.codigoLote().trim();
            LoteProducto lote = lotes.findByProductoIdAndCodigoLote(p.getId(), codigo).orElse(null);
            if (lote == null) {
                lote = new LoteProducto(p, codigo, BigDecimal.ZERO, hoy, null);
                lote.regularizar(entrada.vencimiento());
            }
            if (lote.getCantidadDisponible().add(cantidad).compareTo(new BigDecimal("999999999.999")) > 0)
                throw new BusinessException("El lote supera la cantidad máxima permitida");
            lote.incrementarStock(cantidad);
            lote = lotes.save(lote);
            DetalleCompra fila;
            if (primeraLinea.add(p.getId())) {
                original.recibirEnLote(lote, cantidad);
                fila = original;
            } else {
                fila = new DetalleCompra(compra, p, lote, cantidad, original.getCostoUnitario(),
                    original.getCostoUnitario().multiply(cantidad).setScale(2, java.math.RoundingMode.UNNECESSARY));
            }
            recibidos.add(detalles.save(fila));
            movimientos.save(new MovimientoInventario(p, lote, TipoMovimientoInventario.ENTRADA, cantidad,
                ahora, "Recepción de pedido #" + id, usuario, compra, null));
        }
        compra.marcarRecibida(ahora);
        return CompraResponse.of(compra, recibidos);
    }

    @Transactional
    public CompraResponse cancelar(Long id, String email) {
        admin(email);
        Compra compra = pendiente(id);
        compra.setEstado(EstadoCompra.CANCELADA);
        return CompraResponse.of(compra, detalles.findByCompraId(id));
    }
}
