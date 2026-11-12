package com.diza.api.product;

import com.diza.api.common.ApiResponse;
import com.diza.api.common.EstadoRequest;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
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
@RequestMapping("/productos")
public class ProductoController {

    private final ProductoService productoService;

    public ProductoController(ProductoService productoService) {
        this.productoService = productoService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProductoResponse>>> listar(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) Long categoriaId,
        @RequestParam(required = false) Boolean soloActivos
    ) {
        return ResponseEntity.ok(ApiResponse.success(productoService.listar(search, categoriaId, soloActivos)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductoResponse>> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(productoService.obtenerPorId(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ProductoResponse>> crear(
        @Valid @RequestBody ProductoRequest request,
        Authentication authentication
    ) {
        ProductoResponse response = productoService.crear(request, authentication.getName());
        return ResponseEntity.created(URI.create("/productos/" + response.id()))
            .body(ApiResponse.success(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProductoResponse>> actualizar(
        @PathVariable Long id,
        @Valid @RequestBody ProductoRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(productoService.actualizar(id, request)));
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<ApiResponse<ProductoResponse>> cambiarEstado(
        @PathVariable Long id,
        @RequestBody EstadoRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(productoService.cambiarEstado(id, request.activo())));
    }
}
