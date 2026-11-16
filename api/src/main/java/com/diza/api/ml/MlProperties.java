package com.diza.api.ml;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ml")
public record MlProperties(String serviceBaseUrl) {
}
