package com.diza.api.inventory;

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
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(
    name = "lotes_producto",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_lote_producto_codigo",
        columnNames = {"producto_id", "codigo_lote"}
    ),
    indexes = {
        @Index(name = "idx_lote_producto", columnList = "producto_id"),
        @Index(name = "idx_lote_vencimiento", columnList = "fecha_vencimiento")
    }
)
public class LoteProducto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotNull
    @ManyToOne(optional = false)
    @JoinColumn(name = "producto_id", nullable = false)
    private Producto producto;

    @NotBlank
    @Column(name = "codigo_lote", nullable = false, length = 100)
    private String codigoLote;

    @NotNull
    @DecimalMin("0.000")
    @Column(name = "cantidad_disponible", nullable = false, precision = 12, scale = 3)
    private BigDecimal cantidadDisponible;

    @NotNull
    @Column(name = "fecha_ingreso", nullable = false)
    private LocalDate fechaIngreso;

    @NotNull
    @Column(name = "fecha_vencimiento", nullable = false)
    private LocalDate fechaVencimiento;

    protected LoteProducto() {
    }

    public LoteProducto(
        Producto producto,
        String codigoLote,
        BigDecimal cantidadDisponible,
        LocalDate fechaIngreso,
        LocalDate fechaVencimiento
    ) {
        this.producto = producto;
        this.codigoLote = codigoLote;
        this.cantidadDisponible = cantidadDisponible;
        this.fechaIngreso = fechaIngreso;
        this.fechaVencimiento = fechaVencimiento;
    }

    public Long getId() {
        return id;
    }

    public BigDecimal getCantidadDisponible() {
        return cantidadDisponible;
    }
}
