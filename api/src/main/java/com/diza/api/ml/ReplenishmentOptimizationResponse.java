package com.diza.api.ml;

import java.util.List;

public record ReplenishmentOptimizationResponse(
    String algorithm,
    double budget,
    double budgetUsed,
    double budgetRemaining,
    int iterations,
    double coverageScore,
    List<ReplenishmentOptimizationItemResponse> items
) {
}
