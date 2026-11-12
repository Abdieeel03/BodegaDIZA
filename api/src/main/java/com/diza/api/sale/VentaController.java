package com.diza.api.sale;

import com.diza.api.common.ApiResponse;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
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
@RequestMapping("/ventas")
public class VentaController {

    private final VentaService ventaService;

    public VentaController(VentaService ventaService) {
        this.ventaService = ventaService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<VentaResponse>> registrar(
        @Valid @RequestBody VentaRequest request,
        Authentication authentication
    ) {
        VentaResponse response = ventaService.registrarVenta(request, authentication.getName());
        return ResponseEntity.created(URI.create("/ventas/" + response.id()))
            .body(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<VentaResponse>>> listar(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta
    ) {
        return ResponseEntity.ok(ApiResponse.success(ventaService.listarVentas(desde, hasta)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<VentaResponse>> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(ventaService.obtenerPorId(id)));
    }

    @GetMapping("/resumen")
    public ResponseEntity<ApiResponse<ResumenVentasResponse>> obtenerResumen(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta
    ) {
        return ResponseEntity.ok(ApiResponse.success(ventaService.obtenerResumen(desde, hasta)));
    }
}
