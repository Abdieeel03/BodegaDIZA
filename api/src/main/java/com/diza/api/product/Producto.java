package com.diza.api.product;

import com.diza.api.category.Categoria;
import com.diza.api.supplier.Proveedor;
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
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

@Entity
@Table(
    name = "productos",
    indexes = {
        @Index(name = "idx_producto_categoria", columnList = "categoria_id"),
        @Index(name = "idx_producto_proveedor", columnList = "proveedor_id")
    }
)
public class Producto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, unique = true, length = 50)
    private String sku;

    @NotBlank
    @Column(nullable = false, length = 150)
    private String nombre;

    @Column(length = 500)
    private String descripcion;

    @NotNull
    @ManyToOne(optional = false)
    @JoinColumn(name = "categoria_id", nullable = false)
    private Categoria categoria;

    @NotNull
    @ManyToOne(optional = false)
    @JoinColumn(name = "proveedor_id", nullable = false)
    private Proveedor proveedor;

    @NotNull
    @DecimalMin("0.00")
    @Column(name = "precio_venta", nullable = false, precision = 12, scale = 2)
    private BigDecimal precioVenta;

    @NotNull
    @DecimalMin("0.00")
    @Column(name = "stock_minimo", nullable = false, precision = 12, scale = 3)
    private BigDecimal stockMinimo;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "unidad_medida", nullable = false, length = 20)
    private UnidadMedida unidadMedida;

    @Column(nullable = false)
    private boolean activo = true;

    protected Producto() {
    }

    public Producto(
        String sku,
        String nombre,
        String descripcion,
        Categoria categoria,
        Proveedor proveedor,
        BigDecimal precioVenta,
        BigDecimal stockMinimo,
        UnidadMedida unidadMedida
    ) {
        this(sku, nombre, descripcion, categoria, proveedor, precioVenta, stockMinimo, unidadMedida, true);
    }

    public Producto(
        String sku,
        String nombre,
        String descripcion,
        Categoria categoria,
        Proveedor proveedor,
        BigDecimal precioVenta,
        BigDecimal stockMinimo,
        UnidadMedida unidadMedida,
        boolean activo
    ) {
        this.sku = sku;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.categoria = categoria;
        this.proveedor = proveedor;
        this.precioVenta = precioVenta;
        this.stockMinimo = stockMinimo;
        this.unidadMedida = unidadMedida;
        this.activo = activo;
    }

    public Long getId() {
        return id;
    }

    public String getSku() {
        return sku;
    }

    public String getNombre() {
        return nombre;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public Categoria getCategoria() {
        return categoria;
    }

    public Proveedor getProveedor() {
        return proveedor;
    }

    public BigDecimal getPrecioVenta() {
        return precioVenta;
    }

    public BigDecimal getStockMinimo() {
        return stockMinimo;
    }

    public UnidadMedida getUnidadMedida() {
        return unidadMedida;
    }

    public boolean isActivo() {
        return activo;
    }

    public void setActivo(boolean activo) {
        this.activo = activo;
    }

    public void actualizar(
        String sku,
        String nombre,
        String descripcion,
        Categoria categoria,
        Proveedor proveedor,
        BigDecimal precioVenta,
        BigDecimal stockMinimo,
        UnidadMedida unidadMedida
    ) {
        this.sku = sku;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.categoria = categoria;
        this.proveedor = proveedor;
        this.precioVenta = precioVenta;
        this.stockMinimo = stockMinimo;
        this.unidadMedida = unidadMedida;
    }
}
