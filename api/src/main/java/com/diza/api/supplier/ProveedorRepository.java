package com.diza.api.supplier;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProveedorRepository extends JpaRepository<Proveedor, Long> {

    boolean existsByRuc(String ruc);

    boolean existsByRucAndIdNot(String ruc, Long id);

    Optional<Proveedor> findByRuc(String ruc);

    List<Proveedor> findByActivoTrueOrderByNombreAsc();

    List<Proveedor> findAllByOrderByNombreAsc();
}
