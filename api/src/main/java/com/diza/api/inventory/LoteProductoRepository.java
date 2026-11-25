package com.diza.api.inventory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LoteProductoRepository extends JpaRepository<LoteProducto, Long> {

    Optional<LoteProducto> findByProductoIdAndCodigoLote(Long productoId, String codigoLote);

    List<LoteProducto> findByProductoIdOrderByFechaVencimientoAsc(Long productoId);

    List<LoteProducto> findAllByOrderByFechaVencimientoAsc();

    @Query("""
        SELECT l FROM LoteProducto l
        WHERE l.producto.id = :productoId
          AND l.cantidadDisponible > 0
          AND (((l.precisionVencimiento IS NULL OR l.precisionVencimiento = com.diza.api.inventory.PrecisionVencimiento.EXACTA)
                AND l.fechaVencimiento >= :fechaActual)
            OR (l.precisionVencimiento = com.diza.api.inventory.PrecisionVencimiento.NO_APLICA
                AND l.producto.permiteSinVencimiento = true))
        ORDER BY CASE WHEN l.fechaVencimiento IS NULL THEN 1 ELSE 0 END, l.fechaVencimiento ASC, l.fechaIngreso ASC, l.id ASC
    """)
    List<LoteProducto> findLotesDisponiblesParaVenta(
        @Param("productoId") Long productoId,
        @Param("fechaActual") LocalDate fechaActual
    );

    @Query("""
        SELECT COALESCE(SUM(l.cantidadDisponible), 0)
        FROM LoteProducto l
        WHERE l.producto.id = :productoId
          AND (((l.precisionVencimiento IS NULL OR l.precisionVencimiento = com.diza.api.inventory.PrecisionVencimiento.EXACTA)
                AND l.fechaVencimiento >= :fechaActual)
            OR (l.precisionVencimiento = com.diza.api.inventory.PrecisionVencimiento.NO_APLICA
                AND l.producto.permiteSinVencimiento = true))
    """)
    BigDecimal sumStockDisponibleByProductoId(
        @Param("productoId") Long productoId,
        @Param("fechaActual") LocalDate fechaActual
    );

    @Query("""
        SELECT l FROM LoteProducto l
        WHERE l.cantidadDisponible > 0
          AND l.fechaVencimiento <= :fechaLimite
        ORDER BY l.fechaVencimiento ASC
    """)
    List<LoteProducto> findLotesPorVencer(@Param("fechaLimite") LocalDate fechaLimite);

    @Query("SELECT COALESCE(SUM(l.cantidadDisponible), 0) FROM LoteProducto l WHERE l.producto.id = :productoId")
    BigDecimal sumStockFisicoByProductoId(@Param("productoId") Long productoId);

    List<LoteProducto> findByCantidadDisponibleGreaterThanOrderByFechaVencimientoAsc(BigDecimal cantidad);
}
