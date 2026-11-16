package com.diza.api.ml;

import java.time.OffsetDateTime;
import java.util.Map;

public record TrainingResponse(
    String id,
    String status,
    String modelName,
    OffsetDateTime trainedAt,
    MetricsResponse metrics,
    int productsCount,
    int observationsCount,
    int validationRowsRejected,
    Map<String, Object> hillClimbing,
    Map<String, Object> classification
) {
}
