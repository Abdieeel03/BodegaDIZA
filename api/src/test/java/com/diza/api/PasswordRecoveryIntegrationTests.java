package com.diza.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.diza.api.auth.AuthResponse;
import com.diza.api.auth.AuthService;
import com.diza.api.auth.CambiarPasswordRequest;
import com.diza.api.auth.CodigoRecuperacion;
import com.diza.api.auth.CodigoRecuperacionRepository;
import com.diza.api.auth.LoginRequest;
import com.diza.api.auth.RestablecerPasswordRequest;
import com.diza.api.auth.SolicitudRecuperacionRequest;
import com.diza.api.auth.VerificarCodigoRequest;
import com.diza.api.common.BusinessException;
import com.diza.api.common.ResourceNotFoundException;
import com.diza.api.user.Rol;
import com.diza.api.user.Usuario;
import com.diza.api.user.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PasswordRecoveryIntegrationTests {

    @Autowired
    private AuthService authService;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private CodigoRecuperacionRepository codigoRecuperacionRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private Usuario usuario;

    @BeforeEach
    void setUp() {
        usuario = usuarioRepository.save(new Usuario(
            "Juan Perez",
            "juan.perez@diza.pe",
            passwordEncoder.encode("oldPassword123"),
            Rol.ADMIN
        ));
    }

    @Test
    void completePasswordRecoveryFlow() {
        // 1. Solicitar recuperación
        String mensajeSolicitud = authService.solicitarRecuperacion(new SolicitudRecuperacionRequest(usuario.getEmail()));
        assertThat(mensajeSolicitud).contains("código de verificación");

        // Verificar que el código se guardó en la base de datos
        CodigoRecuperacion codigoGuardado = codigoRecuperacionRepository
            .findTopByEmailAndUsadoFalseOrderByFechaCreacionDesc(usuario.getEmail())
            .orElseThrow();
        assertThat(codigoGuardado.getCodigo()).hasSize(6);
        assertThat(codigoGuardado.isUsado()).isFalse();

        // 2. Verificar código con código incorrecto debe fallar
        assertThatThrownBy(() -> authService.verificarCodigo(new VerificarCodigoRequest(usuario.getEmail(), "000000")))
            .isInstanceOf(BusinessException.class);

        // 3. Verificar código con código correcto debe tener éxito
        boolean codigoValido = authService.verificarCodigo(new VerificarCodigoRequest(usuario.getEmail(), codigoGuardado.getCodigo()));
        assertThat(codigoValido).isTrue();

        // 4. Restablecer la contraseña
        String nuevaPassword = "newPassword456";
        String mensajeRestablecer = authService.restablecerPassword(new RestablecerPasswordRequest(
            usuario.getEmail(),
            codigoGuardado.getCodigo(),
            nuevaPassword
        ));
        assertThat(mensajeRestablecer).contains("exitosa");

        // 5. El código debe quedar marcado como usado
        CodigoRecuperacion codigoActualizado = codigoRecuperacionRepository.findById(codigoGuardado.getId()).orElseThrow();
        assertThat(codigoActualizado.isUsado()).isTrue();

        // Intentar reutilizar el código debe fallar
        assertThatThrownBy(() -> authService.restablecerPassword(new RestablecerPasswordRequest(
            usuario.getEmail(),
            codigoGuardado.getCodigo(),
            "anotherPassword789"
        ))).isInstanceOf(BusinessException.class);

        // 6. El usuario ahora puede iniciar sesión con la nueva contraseña
        AuthResponse loginResponse = authService.login(new LoginRequest(usuario.getEmail(), nuevaPassword));
        assertThat(loginResponse.token()).isNotBlank();
        assertThat(loginResponse.user().email()).isEqualTo(usuario.getEmail());
    }

    @Test
    void failsWhenEmailDoesNotExist() {
        assertThatThrownBy(() -> authService.solicitarRecuperacion(new SolicitudRecuperacionRequest("noexiste@diza.pe")))
            .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void changePasswordForAuthenticatedUser() {
        // 1. Falla si la contraseña actual no coincide
        assertThatThrownBy(() -> authService.cambiarPassword(
            usuario.getEmail(),
            new CambiarPasswordRequest("incorrecta", "newValidPassword123")
        )).isInstanceOf(BusinessException.class)
          .hasMessageContaining("actual es incorrecta");

        // 2. Éxito si la contraseña actual es correcta
        String res = authService.cambiarPassword(
            usuario.getEmail(),
            new CambiarPasswordRequest("oldPassword123", "newValidPassword123")
        );
        assertThat(res).contains("exitosamente");

        // 3. Puede iniciar sesión con la nueva contraseña
        AuthResponse loginResponse = authService.login(new LoginRequest(usuario.getEmail(), "newValidPassword123"));
        assertThat(loginResponse.token()).isNotBlank();
    }
}
