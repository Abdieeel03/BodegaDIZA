package com.diza.api.ml;

import com.diza.api.common.ApiResponse;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    @PostMapping("/trainings")
    public ResponseEntity<ApiResponse<TrainingResponse>> train(
        @RequestPart(value = "salesFile", required = false) MultipartFile salesFile,
        @RequestPart(value = "productsFile", required = false) MultipartFile productsFile
    ) {
        if (salesFile == null && productsFile == null) {
            return ResponseEntity.ok(ApiResponse.success(mlServiceClient.trainFromDb()));
        }
        if (salesFile == null || productsFile == null) {
            throw new MlServiceException("Debes enviar ambos archivos o ninguno para entrenar desde la base de datos", null);
        }
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

    @GetMapping("/replenishments/latest/snapshot")
    public ResponseEntity<ApiResponse<ReplenishmentSnapshotResponse>> getLatestReplenishmentSnapshot() {
        return ResponseEntity.ok(ApiResponse.success(mlReplenishmentService.latestSnapshot()));
    }

    @GetMapping("/replenishments/optimize")
    public ResponseEntity<ApiResponse<ReplenishmentOptimizationResponse>> optimizeReplenishments(
        @RequestParam("budget") double budget
    ) {
        return ResponseEntity.ok(ApiResponse.success(mlServiceClient.optimizeReplenishment(budget)));
    }
}
