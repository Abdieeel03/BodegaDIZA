package com.diza.api.product;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductoRepository extends JpaRepository<Producto, Long> {

    boolean existsBySkuIgnoreCase(String sku);

    boolean existsBySkuIgnoreCaseAndIdNot(String sku, Long id);

    Optional<Producto> findBySkuIgnoreCase(String sku);

    List<Producto> findByActivoTrueOrderByNombreAsc();

    List<Producto> findAllByOrderByNombreAsc();

    @Query("""
        SELECT p FROM Producto p
        WHERE (:soloActivos IS NULL OR p.activo = :soloActivos)
          AND (:categoriaId IS NULL OR p.categoria.id = :categoriaId)
          AND (:search IS NULL OR LOWER(p.nombre) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(p.sku) LIKE LOWER(CONCAT('%', :search, '%')))
        ORDER BY p.nombre ASC
    """)
    List<Producto> buscarProductos(
        @Param("search") String search,
        @Param("categoriaId") Long categoriaId,
        @Param("soloActivos") Boolean soloActivos
    );
}
