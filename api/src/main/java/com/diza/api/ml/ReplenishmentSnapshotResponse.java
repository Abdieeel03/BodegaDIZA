package com.diza.api.ml;

import java.time.OffsetDateTime;
import java.util.List;

/** Stock and replenishment are calculated from the live inventory at inventoryAsOf. */
public record ReplenishmentSnapshotResponse(
    List<ReplenishmentResponse> items,
    OffsetDateTime inventoryAsOf
) {
}
