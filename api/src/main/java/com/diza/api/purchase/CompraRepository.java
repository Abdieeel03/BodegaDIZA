package com.diza.api.purchase;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompraRepository extends JpaRepository<Compra, Long> {

    List<Compra> findAllByOrderByFechaDesc();

    List<Compra> findByProveedorIdOrderByFechaDesc(Long proveedorId);
}
