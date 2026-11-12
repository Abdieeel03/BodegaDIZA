package com.diza.api.inventory;

import com.diza.api.common.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/inventario")
public class InventarioController {

    private final InventarioService inventarioService;

    public InventarioController(InventarioService inventarioService) {
        this.inventarioService = inventarioService;
    }

    @PostMapping("/entradas")
    public ResponseEntity<ApiResponse<LoteResponse>> registrarEntrada(
        @Valid @RequestBody EntradaInventarioRequest request,
        Authentication authentication
    ) {
        return ResponseEntity.ok(ApiResponse.success(inventarioService.registrarEntrada(request, authentication.getName())));
    }

    @PostMapping("/ajustes")
    public ResponseEntity<ApiResponse<LoteResponse>> ajustarInventario(
        @Valid @RequestBody AjusteInventarioRequest request,
        Authentication authentication
    ) {
        return ResponseEntity.ok(ApiResponse.success(inventarioService.ajustarInventario(request, authentication.getName())));
    }

    @GetMapping("/lotes")
    public ResponseEntity<ApiResponse<List<LoteResponse>>> listarLotes(
        @RequestParam(required = false) Long productoId,
        @RequestParam(required = false) Boolean soloDisponibles
    ) {
        return ResponseEntity.ok(ApiResponse.success(inventarioService.listarLotes(productoId, soloDisponibles)));
    }

    @GetMapping("/movimientos")
    public ResponseEntity<ApiResponse<List<MovimientoResponse>>> listarMovimientos(
        @RequestParam(required = false) Long productoId,
        @RequestParam(required = false) TipoMovimientoInventario tipo
    ) {
        return ResponseEntity.ok(ApiResponse.success(inventarioService.listarMovimientos(productoId, tipo)));
    }

    @GetMapping("/alertas/bajo-stock")
    public ResponseEntity<ApiResponse<List<AlertaBajoStockResponse>>> obtenerAlertasBajoStock() {
        return ResponseEntity.ok(ApiResponse.success(inventarioService.obtenerAlertasBajoStock()));
    }

    @GetMapping("/alertas/vencimiento")
    public ResponseEntity<ApiResponse<List<LoteResponse>>> obtenerAlertasVencimiento(
        @RequestParam(required = false) Integer dias
    ) {
        return ResponseEntity.ok(ApiResponse.success(inventarioService.obtenerAlertasVencimiento(dias)));
    }
}
