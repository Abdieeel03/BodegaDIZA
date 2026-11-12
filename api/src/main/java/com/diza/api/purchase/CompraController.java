package com.diza.api.purchase;

import com.diza.api.common.ApiResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/compras")
public class CompraController {

    private final CompraService compraService;

    public CompraController(CompraService compraService) {
        this.compraService = compraService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CompraResponse>> registrar(
        @Valid @RequestBody CompraRequest request,
        Authentication authentication
    ) {
        CompraResponse response = compraService.registrarCompra(request, authentication.getName());
        return ResponseEntity.created(URI.create("/compras/" + response.id()))
            .body(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<CompraResponse>>> listar(
        @RequestParam(required = false) Long proveedorId
    ) {
        return ResponseEntity.ok(ApiResponse.success(compraService.listarCompras(proveedorId)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CompraResponse>> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(compraService.obtenerPorId(id)));
    }
}
