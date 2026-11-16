package com.diza.api.testdata;

import com.diza.api.common.ApiResponse;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/** Endpoints de investigación, HABILITADOS SOLO en la API de pruebas. Requieren JWT. */
@RestController
@RequestMapping("/test-data")
@ConditionalOnProperty(name = "diza.demo.enabled", havingValue = "true")
public class TestDataController {
    private final TestDataService service;

    public TestDataController(TestDataService service) {
        this.service = service;
    }

    @PostMapping(path = "/importar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<Map<String, Object>> importar(
        @RequestParam String tipo,
        @RequestPart("archivo") MultipartFile archivo
    ) {
        return ApiResponse.success(service.importar(tipo, archivo));
    }

    @GetMapping("/resumen")
    public ApiResponse<Map<String, Object>> resumen() {
        return ApiResponse.success(service.resumen());
    }

    @GetMapping("/productos")
    public ApiResponse<List<Map<String, Object>>> productos() {
        return ApiResponse.success(service.productos());
    }

    @GetMapping("/top")
    public ApiResponse<List<Map<String, Object>>> top() {
        return ApiResponse.success(service.top());
    }

    @GetMapping("/ventas-diarias")
    public ApiResponse<List<Map<String, Object>>> ventasDiarias(
        @RequestParam(required = false) String productoId
    ) {
        return ApiResponse.success(service.ventasDiarias(productoId));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Void>> manejoErrores(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode())
            .body(ApiResponse.error(ex.getReason() == null ? "Error en importación TEST" : ex.getReason()));
    }

    @GetMapping("/prediccion")
    public ApiResponse<Map<String, Object>> prediccion(@RequestParam String productoId) {
        return ApiResponse.success(service.prediccion(productoId));
    }
}
