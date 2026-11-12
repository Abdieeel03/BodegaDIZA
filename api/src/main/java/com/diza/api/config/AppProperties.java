package com.diza.api.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Cors cors, BootstrapAdmin bootstrapAdmin) {

    public record Cors(String allowedOrigin) {
    }

    public record BootstrapAdmin(String email, String password, String nombre) {
    }
}
