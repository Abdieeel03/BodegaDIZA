package com.diza.api.ml;

import java.util.List;

public record PredictionResponse(
    String productId,
    String productName,
    String category,
    double predictedDemand7Days,
    List<Double> dailyPredictions
) {
}
