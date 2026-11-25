package com.diza.api.purchase;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompraRepository extends JpaRepository<Compra, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT c FROM Compra c WHERE c.id = :id")
    java.util.Optional<Compra> findForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

    List<Compra> findAllByOrderByFechaDesc();

    List<Compra> findByProveedorIdOrderByFechaDesc(Long proveedorId);
}
