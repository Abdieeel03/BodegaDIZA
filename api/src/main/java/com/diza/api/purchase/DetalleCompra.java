package com.diza.api.purchase;

import com.diza.api.inventory.LoteProducto;
import com.diza.api.product.Producto;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

@Entity
@Table(
    name = "detalles_compra",
    indexes = {
        @Index(name = "idx_detalle_compra_compra", columnList = "compra_id"),
        @Index(name = "idx_detalle_compra_producto", columnList = "producto_id")
    }
)
public class DetalleCompra {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(optional = false)
    @JoinColumn(name = "compra_id", nullable = false)
    private Compra compra;

    @NotNull
    @ManyToOne(optional = false)
    @JoinColumn(name = "producto_id", nullable = false)
    private Producto producto;

    // El pedido pendiente no conoce el lote hasta la recepción.
    @ManyToOne
    @JoinColumn(name = "lote_id")
    private LoteProducto lote;

    @NotNull
    @DecimalMin("0.001")
    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal cantidad;

    @NotNull
    @DecimalMin("0.00")
    @Column(name = "costo_unitario", nullable = false, precision = 12, scale = 2)
    private BigDecimal costoUnitario;

    @NotNull
    @DecimalMin("0.00")
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    protected DetalleCompra() {
    }

    public DetalleCompra(
        Compra compra,
        Producto producto,
        LoteProducto lote,
        BigDecimal cantidad,
        BigDecimal costoUnitario,
        BigDecimal subtotal
    ) {
        this.compra = compra;
        this.producto = producto;
        this.lote = lote;
        this.cantidad = cantidad;
        this.costoUnitario = costoUnitario;
        this.subtotal = subtotal;
    }

    public void recibirEnLote(LoteProducto lote, BigDecimal cantidad) {
        if (this.lote != null || lote == null || cantidad.signum() <= 0)
            throw new com.diza.api.common.BusinessException("Detalle de recepción inválido");
        this.lote = lote;
        this.cantidad = cantidad;
        this.subtotal = costoUnitario.multiply(cantidad).setScale(2, java.math.RoundingMode.UNNECESSARY);
    }

    public Long getId() {
        return id;
    }

    public Compra getCompra() {
        return compra;
    }

    public Producto getProducto() {
        return producto;
    }

    public LoteProducto getLote() {
        return lote;
    }

    public BigDecimal getCantidad() {
        return cantidad;
    }

    public BigDecimal getCostoUnitario() {
        return costoUnitario;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }
}
