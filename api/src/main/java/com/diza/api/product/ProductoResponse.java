package com.diza.api.product;

import com.diza.api.category.CategoriaResponse;
import com.diza.api.supplier.ProveedorResponse;
import java.math.BigDecimal;

public record ProductoResponse(
    Long id,
    String sku,
    String nombre,
    String descripcion,
    CategoriaResponse categoria,
    ProveedorResponse proveedor,
    BigDecimal precioVenta,
    BigDecimal stockMinimo,
    UnidadMedida unidadMedida,
    boolean activo,
    BigDecimal stockTotal,
    boolean bajoStock,
    BigDecimal stockFisico,
    BigDecimal stockVendible,
    boolean permiteSinVencimiento,
    String justificacionSinVencimiento,
    BigDecimal precioCosto
) {
    public ProductoResponse(Long id, String sku, String nombre, String descripcion,
        CategoriaResponse categoria, ProveedorResponse proveedor, BigDecimal precioVenta,
        BigDecimal stockMinimo, UnidadMedida unidadMedida, boolean activo, BigDecimal stockTotal,
        boolean bajoStock, BigDecimal stockFisico, BigDecimal stockVendible,
        boolean permiteSinVencimiento, String justificacionSinVencimiento) {
        this(id, sku, nombre, descripcion, categoria, proveedor, precioVenta, stockMinimo, unidadMedida,
            activo, stockTotal, bajoStock, stockFisico, stockVendible, permiteSinVencimiento,
            justificacionSinVencimiento, null);
    }

    public static ProductoResponse of(Producto producto, BigDecimal stockTotal, BigDecimal stockFisico) {
        BigDecimal stock = stockTotal != null ? stockTotal : BigDecimal.ZERO;
        boolean bajo = stock.compareTo(producto.getStockMinimo()) <= 0;
        return new ProductoResponse(
            producto.getId(),
            producto.getSku(),
            producto.getNombre(),
            producto.getDescripcion(),
            CategoriaResponse.from(producto.getCategoria()),
            ProveedorResponse.from(producto.getProveedor()),
            producto.getPrecioVenta(),
            producto.getStockMinimo(),
            producto.getUnidadMedida(),
            producto.isActivo(),
            stock,
            bajo,
            stockFisico,
            stock,
            producto.isPermiteSinVencimiento(),
            producto.getJustificacionSinVencimiento(),
            producto.getPrecioCosto()
        );
    }
}
