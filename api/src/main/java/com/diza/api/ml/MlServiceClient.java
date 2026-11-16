package com.diza.api.ml;

import java.util.List;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

@Component
public class MlServiceClient {

    private final WebClient webClient;

    public MlServiceClient(MlProperties properties) {
        this.webClient = WebClient.builder().baseUrl(properties.serviceBaseUrl()).build();
    }

    public TrainingResponse train(MultipartFile salesFile, MultipartFile productsFile) {
        MultipartBodyBuilder body = new MultipartBodyBuilder();
        body.part("sales_file", asResource(salesFile)).filename(salesFile.getOriginalFilename());
        body.part("products_file", asResource(productsFile)).filename(productsFile.getOriginalFilename());
        return request(() -> webClient.post()
            .uri("/trainings")
            .contentType(MediaType.MULTIPART_FORM_DATA)
            .body(BodyInserters.fromMultipartData(body.build()))
            .retrieve()
            .bodyToMono(TrainingResponse.class)
            .block());
    }

    public TrainingResponse getTraining(String trainingId) {
        return request(() -> webClient.get()
            .uri("/trainings/{trainingId}", trainingId)
            .retrieve()
            .bodyToMono(TrainingResponse.class)
            .block());
    }

    public List<PredictionResponse> getLatestPredictions() {
        return request(() -> webClient.get()
            .uri("/trainings/latest/predictions")
            .retrieve()
            .bodyToFlux(PredictionResponse.class)
            .collectList()
            .block());
    }

    public List<ReplenishmentResponse> getLatestReplenishments() {
        return request(() -> webClient.get()
            .uri("/trainings/latest/replenishments")
            .retrieve()
            .bodyToFlux(ReplenishmentResponse.class)
            .collectList()
            .block());
    }

    private ByteArrayResource asResource(MultipartFile file) {
        try {
            return new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            };
        } catch (Exception exception) {
            throw new MlServiceException("No fue posible leer el archivo CSV", exception);
        }
    }

    private <T> T request(Request<T> request) {
        try {
            T response = request.execute();
            if (response == null) {
                throw new MlServiceException("El servicio de predicción no devolvió una respuesta", null);
            }
            return response;
        } catch (MlServiceException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new MlServiceException("No fue posible conectar con el servicio de predicción", exception);
        }
    }

    @FunctionalInterface
    private interface Request<T> {
        T execute();
    }
}
