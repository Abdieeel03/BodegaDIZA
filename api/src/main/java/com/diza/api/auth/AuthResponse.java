package com.diza.api.auth;

public record AuthResponse(String token, UserResponse user) {
}
