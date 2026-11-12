package com.diza.api.supplier;

import com.diza.api.common.ApiResponse;
import com.diza.api.common.EstadoRequest;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/proveedores")
public class ProveedorController {

    private final ProveedorService proveedorService;

    public ProveedorController(ProveedorService proveedorService) {
        this.proveedorService = proveedorService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProveedorResponse>>> listar(
        @RequestParam(required = false) Boolean soloActivos
    ) {
        return ResponseEntity.ok(ApiResponse.success(proveedorService.listar(soloActivos)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProveedorResponse>> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(proveedorService.obtenerPorId(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ProveedorResponse>> crear(@Valid @RequestBody ProveedorRequest request) {
        ProveedorResponse response = proveedorService.crear(request);
        return ResponseEntity.created(URI.create("/proveedores/" + response.id()))
            .body(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProveedorResponse>> actualizar(
        @PathVariable Long id,
        @Valid @RequestBody ProveedorRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(proveedorService.actualizar(id, request)));
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<ApiResponse<ProveedorResponse>> cambiarEstado(
        @PathVariable Long id,
        @RequestBody EstadoRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(proveedorService.cambiarEstado(id, request.activo())));
    }
}
