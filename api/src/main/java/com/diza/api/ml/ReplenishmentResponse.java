package com.diza.api.ml;

public record ReplenishmentResponse(
    String productId,
    String productName,
    String category,
    double stockActual,
    double stockMinimoSeguridad,
    double predictedDemand7Days,
    double recommendedReplenishment,
    String alertStatus,
    Double stockoutProbability,
    String stockoutRiskLevel,
    Double daysOfStockRemaining
) {
    public ReplenishmentResponse(
        String productId,
        String productName,
        String category,
        double stockActual,
        double stockMinimoSeguridad,
        double predictedDemand7Days,
        double recommendedReplenishment,
        String alertStatus
    ) {
        this(
            productId,
            productName,
            category,
            stockActual,
            stockMinimoSeguridad,
            predictedDemand7Days,
            recommendedReplenishment,
            alertStatus,
            null,
            null,
            null
        );
    }
}
