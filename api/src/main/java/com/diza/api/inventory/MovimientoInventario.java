package com.diza.api.inventory;

import com.diza.api.product.Producto;
import com.diza.api.purchase.Compra;
import com.diza.api.sale.Venta;
import com.diza.api.user.Usuario;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "movimientos_inventario",
    indexes = {
        @Index(name = "idx_movimiento_producto_fecha", columnList = "producto_id,fecha"),
        @Index(name = "idx_movimiento_lote", columnList = "lote_id"),
        @Index(name = "idx_movimiento_compra", columnList = "compra_id"),
        @Index(name = "idx_movimiento_venta", columnList = "venta_id")
    }
)
public class MovimientoInventario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(optional = false)
    @JoinColumn(name = "producto_id", nullable = false)
    private Producto producto;

    @ManyToOne
    @JoinColumn(name = "lote_id")
    private LoteProducto lote;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TipoMovimientoInventario tipo;

    @NotNull
    @DecimalMin("0.001")
    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal cantidad;

    @NotNull
    @Column(nullable = false)
    private LocalDateTime fecha;

    @Column(length = 500)
    private String motivo;

    @NotNull
    @ManyToOne(optional = false)
    @JoinColumn(name = "usuario_id", nullable = false)
    private Usuario usuario;

    @ManyToOne
    @JoinColumn(name = "compra_id")
    private Compra compra;

    @ManyToOne
    @JoinColumn(name = "venta_id")
    private Venta venta;

    protected MovimientoInventario() {
    }

    public MovimientoInventario(
        Producto producto,
        LoteProducto lote,
        TipoMovimientoInventario tipo,
        BigDecimal cantidad,
        LocalDateTime fecha,
        String motivo,
        Usuario usuario,
        Compra compra,
        Venta venta
    ) {
        this.producto = producto;
        this.lote = lote;
        this.tipo = tipo;
        this.cantidad = cantidad;
        this.fecha = fecha;
        this.motivo = motivo;
        this.usuario = usuario;
        this.compra = compra;
        this.venta = venta;
    }

    public Long getId() {
        return id;
    }

    public Producto getProducto() {
        return producto;
    }

    public LoteProducto getLote() {
        return lote;
    }

    public TipoMovimientoInventario getTipo() {
        return tipo;
    }

    public BigDecimal getCantidad() {
        return cantidad;
    }

    public LocalDateTime getFecha() {
        return fecha;
    }

    public String getMotivo() {
        return motivo;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public Compra getCompra() {
        return compra;
    }

    public Venta getVenta() {
        return venta;
    }
}
