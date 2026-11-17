package com.diza.api.report;

import com.diza.api.common.ApiResponse;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/reportes")
public class SalesReportController {
    private final SalesReportService service;
    public SalesReportController(SalesReportService service) { this.service = service; }

    @GetMapping("/ventas")
    public ApiResponse<SalesReportResponse> sales(
        @RequestParam(required = false) LocalDate desde,
        @RequestParam(required = false) LocalDate hasta,
        @RequestParam(required = false) String sku,
        @RequestParam(defaultValue = "todos") String origen,
        @RequestParam(defaultValue = "dia") String agrupacion,
        @RequestParam(defaultValue = "0") int pagina,
        @RequestParam(defaultValue = "20") int tamanio
    ) {
        return ApiResponse.success(service.get(desde, hasta, sku, origen, agrupacion, pagina, tamanio));
    }
}
