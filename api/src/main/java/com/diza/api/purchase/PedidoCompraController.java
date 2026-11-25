package com.diza.api.purchase;

import com.diza.api.common.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/compras")
public class PedidoCompraController {
    private final PedidoCompraService service;
    public PedidoCompraController(PedidoCompraService service) { this.service = service; }

    @PostMapping("/pedidos")
    public ResponseEntity<ApiResponse<List<CompraResponse>>> confirmar(@Valid @RequestBody PedidoCompraRequest request, Authentication auth) {
        return ResponseEntity.status(201).body(ApiResponse.success(service.confirmar(request, auth.getName())));
    }

    @PostMapping("/{id}/recibir")
    public ApiResponse<CompraResponse> recibir(@PathVariable Long id, @Valid @RequestBody RecepcionPedidoRequest request, Authentication auth) {
        return ApiResponse.success(service.recibir(id, request, auth.getName()));
    }

    @PostMapping("/{id}/cancelar")
    public ApiResponse<CompraResponse> cancelar(@PathVariable Long id, Authentication auth) {
        return ApiResponse.success(service.cancelar(id, auth.getName()));
    }
}
