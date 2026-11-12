package com.diza.api.auth;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CodigoRecuperacionRepository extends JpaRepository<CodigoRecuperacion, Long> {

    Optional<CodigoRecuperacion> findTopByEmailAndCodigoAndUsadoFalseOrderByFechaCreacionDesc(
        String email,
        String codigo
    );

    Optional<CodigoRecuperacion> findTopByEmailAndUsadoFalseOrderByFechaCreacionDesc(String email);

    List<CodigoRecuperacion> findByEmailAndUsadoFalse(String email);
}
