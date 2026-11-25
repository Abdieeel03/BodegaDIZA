package com.diza.api.inventory;

import com.diza.api.product.Producto;
import com.diza.api.user.Usuario;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Auditoría inmutable: no representa entradas/salidas ni reescribe el Kardex histórico. */
@Entity
@Table(name = "regularizaciones_lote")
public class RegularizacionLote {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(optional = false) @JoinColumn(name = "producto_id", nullable = false) private Producto producto;
    @ManyToOne @JoinColumn(name = "lote_origen_id") private LoteProducto origen;
    @ManyToOne @JoinColumn(name = "lote_destino_id") private LoteProducto destino;
    @ManyToOne(optional = false) @JoinColumn(name = "usuario_id", nullable = false) private Usuario usuario;
    @Column(nullable = false) private LocalDateTime fecha;
    @Column(nullable = false, length = 20) private String accion;
    @Column(nullable = false, precision = 12, scale = 3) private BigDecimal cantidad;
    @Column(nullable = false, length = 1000) private String antes;
    @Column(nullable = false, length = 1000) private String despues;
    @Column(nullable = false, length = 500) private String motivo;

    protected RegularizacionLote() {}
    public RegularizacionLote(Producto producto, LoteProducto origen, LoteProducto destino, Usuario usuario,
        String accion, BigDecimal cantidad, String antes, String despues, String motivo) {
        this.producto = producto; this.origen = origen; this.destino = destino; this.usuario = usuario;
        this.fecha = LocalDateTime.now(); this.accion = accion; this.cantidad = cantidad;
        this.antes = antes; this.despues = despues; this.motivo = motivo;
    }

    public record Response(Long id, Long productoId, Long loteOrigenId, Long loteDestinoId,
        String usuario, LocalDateTime fecha, String accion, BigDecimal cantidad, String antes, String despues, String motivo) {}
    public Response response() {
        return new Response(id, producto.getId(), origen == null ? null : origen.getId(),
            destino == null ? null : destino.getId(), usuario.getNombre(), fecha, accion, cantidad, antes, despues, motivo);
    }
}
