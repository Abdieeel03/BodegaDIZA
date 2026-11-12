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
          AND l.fechaVencimiento >= :fechaActual
        ORDER BY l.fechaVencimiento ASC, l.id ASC
    """)
    List<LoteProducto> findLotesDisponiblesParaVenta(
        @Param("productoId") Long productoId,
        @Param("fechaActual") LocalDate fechaActual
    );

    @Query("""
        SELECT COALESCE(SUM(l.cantidadDisponible), 0)
        FROM LoteProducto l
        WHERE l.producto.id = :productoId
          AND l.fechaVencimiento >= :fechaActual
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

    List<LoteProducto> findByCantidadDisponibleGreaterThanOrderByFechaVencimientoAsc(BigDecimal cantidad);
}
