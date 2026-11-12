package com.diza.api.purchase;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DetalleCompraRepository extends JpaRepository<DetalleCompra, Long> {

    List<DetalleCompra> findByCompraId(Long compraId);

    List<DetalleCompra> findByCompraIdIn(List<Long> compraIds);
}
