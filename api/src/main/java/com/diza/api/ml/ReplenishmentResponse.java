package com.diza.api.ml;

public record ReplenishmentResponse(
    String productId,
    String productName,
    String category,
    double stockActual,
    double stockMinimoSeguridad,
    double predictedDemand7Days,
    double recommendedReplenishment,
    String alertStatus
) {
}
