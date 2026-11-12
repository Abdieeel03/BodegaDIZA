package com.diza.api.category;

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
@RequestMapping("/categorias")
public class CategoriaController {

    private final CategoriaService categoriaService;

    public CategoriaController(CategoriaService categoriaService) {
        this.categoriaService = categoriaService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<CategoriaResponse>>> listar(
        @RequestParam(required = false) Boolean soloActivas
    ) {
        return ResponseEntity.ok(ApiResponse.success(categoriaService.listar(soloActivas)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CategoriaResponse>> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(categoriaService.obtenerPorId(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CategoriaResponse>> crear(@Valid @RequestBody CategoriaRequest request) {
        CategoriaResponse response = categoriaService.crear(request);
        return ResponseEntity.created(URI.create("/categorias/" + response.id()))
            .body(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CategoriaResponse>> actualizar(
        @PathVariable Long id,
        @Valid @RequestBody CategoriaRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(categoriaService.actualizar(id, request)));
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<ApiResponse<CategoriaResponse>> cambiarEstado(
        @PathVariable Long id,
        @RequestBody EstadoRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(categoriaService.cambiarEstado(id, request.activo())));
    }
}
