package com.diza.api.supplier;

import com.diza.api.common.BusinessException;
import com.diza.api.common.ResourceNotFoundException;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProveedorService {

    private final ProveedorRepository proveedorRepository;

    public ProveedorService(ProveedorRepository proveedorRepository) {
        this.proveedorRepository = proveedorRepository;
    }

    @Transactional(readOnly = true)
    public List<ProveedorResponse> listar(Boolean soloActivos) {
        List<Proveedor> proveedores = Boolean.TRUE.equals(soloActivos)
            ? proveedorRepository.findByActivoTrueOrderByNombreAsc()
            : proveedorRepository.findAllByOrderByNombreAsc();
        return proveedores.stream().map(ProveedorResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ProveedorResponse obtenerPorId(Long id) {
        return ProveedorResponse.from(buscarEntidadPorId(id));
    }

    @Transactional
    public ProveedorResponse crear(ProveedorRequest request) {
        if (proveedorRepository.existsByRuc(request.ruc())) {
            throw new BusinessException("Ya existe un proveedor registrado con el RUC: " + request.ruc());
        }
        Proveedor proveedor = new Proveedor(
            request.nombre().trim(),
            request.ruc().trim(),
            request.telefono() != null ? request.telefono().trim() : null,
            request.email() != null ? request.email().trim().toLowerCase() : null
        );
        return ProveedorResponse.from(proveedorRepository.save(proveedor));
    }

    @Transactional
    public ProveedorResponse actualizar(Long id, ProveedorRequest request) {
        Proveedor proveedor = buscarEntidadPorId(id);
        if (proveedorRepository.existsByRucAndIdNot(request.ruc(), id)) {
            throw new BusinessException("Ya existe otro proveedor registrado con el RUC: " + request.ruc());
        }
        proveedor.actualizar(
            request.nombre().trim(),
            request.ruc().trim(),
            request.telefono() != null ? request.telefono().trim() : null,
            request.email() != null ? request.email().trim().toLowerCase() : null
        );
        return ProveedorResponse.from(proveedor);
    }

    @Transactional
    public ProveedorResponse cambiarEstado(Long id, boolean activo) {
        Proveedor proveedor = buscarEntidadPorId(id);
        proveedor.setActivo(activo);
        return ProveedorResponse.from(proveedor);
    }

    public Proveedor buscarEntidadPorId(Long id) {
        return proveedorRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado con ID: " + id));
    }
}
