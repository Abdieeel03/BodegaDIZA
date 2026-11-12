package com.diza.api.category;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoriaRepository extends JpaRepository<Categoria, Long> {

    boolean existsByNombreIgnoreCase(String nombre);

    boolean existsByNombreIgnoreCaseAndIdNot(String nombre, Long id);

    List<Categoria> findByActivaTrueOrderByNombreAsc();

    List<Categoria> findAllByOrderByNombreAsc();
}
