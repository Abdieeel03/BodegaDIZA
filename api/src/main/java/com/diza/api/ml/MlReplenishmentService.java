package com.diza.api.ml;

import com.diza.api.product.ProductoResponse;
import com.diza.api.product.ProductoService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * Fusiona el pronóstico del modelo con el inventario operativo actualizado.
 * Las predicciones vienen de FastAPI; las existencias y mínimos, de PostgreSQL.
 * No reentrena el modelo ni modifica datos.
 */
@Service
public class MlReplenishmentService {

    private final MlServiceClient mlServiceClient;
    private final ProductoService productoService;

    public MlReplenishmentService(MlServiceClient mlServiceClient, ProductoService productoService) {
        this.mlServiceClient = mlServiceClient;
        this.productoService = productoService;
    }

    public List<ReplenishmentResponse> latest() {
        List<ReplenishmentResponse> forecast = mlServiceClient.getLatestReplenishments();
        Map<String, ProductoResponse> bySku = productoService.listar(null, null, true)
            .stream()
            .collect(Collectors.toMap(p -> normalizedSku(p.sku()), Function.identity()));

        // Nunca presentar existencias obsoletas de un CSV como si fueran stock en vivo.
        // Se excluyen SKU no existentes/inactivos hasta sincronizar el catálogo.
        return forecast.stream()
            .filter(item -> bySku.containsKey(normalizedSku(item.productId())))
            .map(item -> {
                ProductoResponse current = bySku.get(normalizedSku(item.productId()));
                return recalculate(item, current.nombre(), current.stockTotal(), current.stockMinimo());
            })
            .sorted(Comparator.comparingDouble(ReplenishmentResponse::recommendedReplenishment)
                .reversed().thenComparing(ReplenishmentResponse::productId))
            .toList();
    }

    static ReplenishmentResponse recalculate(
        ReplenishmentResponse prediction,
        String currentProductName,
        BigDecimal currentStock,
        BigDecimal currentMinimum
    ) {
        Objects.requireNonNull(prediction, "prediction");
        Objects.requireNonNull(currentStock, "currentStock");
        Objects.requireNonNull(currentMinimum, "currentMinimum");
        double demand = prediction.predictedDemand7Days();
        if (!Double.isFinite(demand) || demand < 0
            || currentStock.signum() < 0 || currentMinimum.signum() < 0) {
            throw new IllegalArgumentException("Pronóstico o stock inválido para " + prediction.productId());
        }

        BigDecimal target = currentMinimum.add(BigDecimal.valueOf(demand))
            .subtract(currentStock).max(BigDecimal.ZERO);
        double quantity = target.setScale(0, RoundingMode.CEILING).doubleValue();
        String status = currentStock.compareTo(currentMinimum) <= 0 ? "ROJO"
            : quantity > 0 ? "AMARILLO" : "VERDE";

        return new ReplenishmentResponse(
            prediction.productId(),
            currentProductName,
            prediction.category(),
            currentStock.doubleValue(),
            currentMinimum.doubleValue(),
            demand,
            quantity,
            status
        );
    }

    private static String normalizedSku(String value) {
        return Objects.requireNonNull(value, "SKU").trim().toUpperCase(Locale.ROOT);
    }
}
