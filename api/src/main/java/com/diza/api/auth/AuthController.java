package com.diza.api.auth;

import com.diza.api.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.success(authService.login(request)));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserResponse>> profile(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.success(authService.profile(authentication.getName())));
    }

    @PostMapping("/recuperar-password")
    public ResponseEntity<ApiResponse<String>> solicitarRecuperacion(
        @Valid @RequestBody SolicitudRecuperacionRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(authService.solicitarRecuperacion(request)));
    }

    @PostMapping("/verificar-codigo")
    public ResponseEntity<ApiResponse<String>> verificarCodigo(
        @Valid @RequestBody VerificarCodigoRequest request
    ) {
        authService.verificarCodigo(request);
        return ResponseEntity.ok(ApiResponse.success("Código de verificación válido"));
    }

    @PostMapping("/restablecer-password")
    public ResponseEntity<ApiResponse<String>> restablecerPassword(
        @Valid @RequestBody RestablecerPasswordRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(authService.restablecerPassword(request)));
    }

    @PatchMapping("/cambiar-password")
    public ResponseEntity<ApiResponse<String>> cambiarPassword(
        @Valid @RequestBody CambiarPasswordRequest request,
        Authentication authentication
    ) {
        return ResponseEntity.ok(ApiResponse.success(authService.cambiarPassword(authentication.getName(), request)));
    }
}
