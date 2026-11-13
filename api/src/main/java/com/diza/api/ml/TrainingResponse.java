package com.diza.api.ml;

import java.time.OffsetDateTime;

public record TrainingResponse(
    String id,
    String status,
    String modelName,
    OffsetDateTime trainedAt,
    MetricsResponse metrics,
    int productsCount,
    int observationsCount,
    int validationRowsRejected
) {
}
