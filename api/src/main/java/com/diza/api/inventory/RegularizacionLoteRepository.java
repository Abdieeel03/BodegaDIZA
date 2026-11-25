package com.diza.api.inventory;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RegularizacionLoteRepository extends JpaRepository<RegularizacionLote, Long> {
    @Query("SELECT r FROM RegularizacionLote r WHERE r.origen.id = :id OR r.destino.id = :id OR (r.origen IS NULL AND r.producto.id = (SELECT l.producto.id FROM LoteProducto l WHERE l.id = :id)) ORDER BY r.fecha DESC, r.id DESC")
    List<RegularizacionLote> historial(@Param("id") Long id);
}
