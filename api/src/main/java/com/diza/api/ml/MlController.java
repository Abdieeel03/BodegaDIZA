package com.diza.api.ml;

import com.diza.api.common.ApiResponse;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/ml")
public class MlController {

    private final MlServiceClient mlServiceClient;
    private final MlReplenishmentService mlReplenishmentService;

    public MlController(MlServiceClient mlServiceClient, MlReplenishmentService mlReplenishmentService) {
        this.mlServiceClient = mlServiceClient;
        this.mlReplenishmentService = mlReplenishmentService;
    }

    @PostMapping(value = "/trainings", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<TrainingResponse>> train(
        @RequestPart("salesFile") MultipartFile salesFile,
        @RequestPart("productsFile") MultipartFile productsFile
    ) {
        return ResponseEntity.ok(ApiResponse.success(mlServiceClient.train(salesFile, productsFile)));
    }

    @GetMapping("/trainings/{trainingId}")
    public ResponseEntity<ApiResponse<TrainingResponse>> getTraining(@PathVariable String trainingId) {
        return ResponseEntity.ok(ApiResponse.success(mlServiceClient.getTraining(trainingId)));
    }

    @GetMapping("/predictions/latest")
    public ResponseEntity<ApiResponse<List<PredictionResponse>>> getLatestPredictions() {
        return ResponseEntity.ok(ApiResponse.success(mlServiceClient.getLatestPredictions()));
    }

    @GetMapping("/replenishments/latest")
    public ResponseEntity<ApiResponse<List<ReplenishmentResponse>>> getLatestReplenishments() {
        return ResponseEntity.ok(ApiResponse.success(mlReplenishmentService.latest()));
    }
}
