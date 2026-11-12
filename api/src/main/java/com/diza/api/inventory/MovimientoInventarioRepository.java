package com.diza.api.inventory;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MovimientoInventarioRepository extends JpaRepository<MovimientoInventario, Long> {

    List<MovimientoInventario> findAllByOrderByFechaDesc();

    List<MovimientoInventario> findByProductoIdOrderByFechaDesc(Long productoId);

    List<MovimientoInventario> findByTipoOrderByFechaDesc(TipoMovimientoInventario tipo);

    List<MovimientoInventario> findByProductoIdAndTipoOrderByFechaDesc(Long productoId, TipoMovimientoInventario tipo);
}
