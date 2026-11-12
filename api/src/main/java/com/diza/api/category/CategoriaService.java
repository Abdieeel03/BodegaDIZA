package com.diza.api.category;

import com.diza.api.common.BusinessException;
import com.diza.api.common.ResourceNotFoundException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoriaService {

    private final CategoriaRepository categoriaRepository;

    public CategoriaService(CategoriaRepository categoriaRepository) {
        this.categoriaRepository = categoriaRepository;
    }

    @Transactional(readOnly = true)
    public List<CategoriaResponse> listar(Boolean soloActivas) {
        List<Categoria> categorias = Boolean.TRUE.equals(soloActivas)
            ? categoriaRepository.findByActivaTrueOrderByNombreAsc()
            : categoriaRepository.findAllByOrderByNombreAsc();
        return categorias.stream().map(CategoriaResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public CategoriaResponse obtenerPorId(Long id) {
        return CategoriaResponse.from(buscarEntidadPorId(id));
    }

    @Transactional
    public CategoriaResponse crear(CategoriaRequest request) {
        if (categoriaRepository.existsByNombreIgnoreCase(request.nombre().trim())) {
            throw new BusinessException("Ya existe una categoría con el nombre: " + request.nombre());
        }
        Categoria categoria = new Categoria(request.nombre().trim(), request.descripcion());
        return CategoriaResponse.from(categoriaRepository.save(categoria));
    }

    @Transactional
    public CategoriaResponse actualizar(Long id, CategoriaRequest request) {
        Categoria categoria = buscarEntidadPorId(id);
        if (categoriaRepository.existsByNombreIgnoreCaseAndIdNot(request.nombre().trim(), id)) {
            throw new BusinessException("Ya existe otra categoría con el nombre: " + request.nombre());
        }
        categoria.actualizar(request.nombre().trim(), request.descripcion());
        return CategoriaResponse.from(categoria);
    }

    @Transactional
    public CategoriaResponse cambiarEstado(Long id, boolean activa) {
        Categoria categoria = buscarEntidadPorId(id);
        categoria.setActiva(activa);
        return CategoriaResponse.from(categoria);
    }

    public Categoria buscarEntidadPorId(Long id) {
        return categoriaRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada con ID: " + id));
    }
}
