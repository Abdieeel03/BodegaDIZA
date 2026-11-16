package com.diza.api.ml;

public record ReplenishmentOptimizationItemResponse(
    String productId,
    String productName,
    String category,
    String alertStatus,
    int recommendedReplenishment,
    int allocatedUnits,
    int unmetUnits,
    double unitCost,
    double totalCost
) {
}
