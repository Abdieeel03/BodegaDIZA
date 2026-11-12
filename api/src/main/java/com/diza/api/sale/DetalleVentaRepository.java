package com.diza.api.sale;

import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DetalleVentaRepository extends JpaRepository<DetalleVenta, Long> {

    List<DetalleVenta> findByVentaId(Long ventaId);

    List<DetalleVenta> findByVentaIdIn(List<Long> ventaIds);

    @Query("""
        SELECT d.producto.id, d.producto.nombre, d.producto.sku, SUM(d.cantidad), SUM(d.subtotal)
        FROM DetalleVenta d
        WHERE d.venta.fecha BETWEEN :desde AND :hasta
        GROUP BY d.producto.id, d.producto.nombre, d.producto.sku
        ORDER BY SUM(d.cantidad) DESC
    """)
    List<Object[]> findTopProductosVendidos(
        @Param("desde") LocalDateTime desde,
        @Param("hasta") LocalDateTime hasta
    );
}
