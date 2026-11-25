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

    @PostMapping("/recepciones")
    public ResponseEntity<ApiResponse<List<LoteResponse>>> recibirLotes(
        @Valid @RequestBody RecepcionLotesRequest request, Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.success(inventarioService.recibirLotes(request, authentication.getName())));
    }

    @PostMapping("/regularizaciones")
    public ResponseEntity<ApiResponse<List<LoteResponse>>> regularizar(
        @Valid @RequestBody RegularizacionLoteRequest request, Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.success(inventarioService.regularizar(request, authentication.getName())));
    }

    @PostMapping("/politica-vencimiento")
    public ResponseEntity<ApiResponse<String>> politica(
        @Valid @RequestBody PoliticaVencimientoRequest request, Authentication authentication) {
        inventarioService.definirPolitica(request, authentication.getName());
        return ResponseEntity.ok(ApiResponse.success("Política registrada"));
    }

    @GetMapping("/regularizaciones")
    public ResponseEntity<ApiResponse<List<RegularizacionLote.Response>>> historial(@RequestParam Long loteId) {
        return ResponseEntity.ok(ApiResponse.success(inventarioService.historial(loteId)));
    }
}
