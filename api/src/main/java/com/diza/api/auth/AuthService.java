package com.diza.api.auth;

import com.diza.api.common.BusinessException;
import com.diza.api.common.ResourceNotFoundException;
import com.diza.api.mail.EmailService;
import com.diza.api.security.JwtService;
import com.diza.api.user.Usuario;
import com.diza.api.user.UsuarioRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UsuarioRepository usuarioRepository;
    private final JwtService jwtService;
    private final CodigoRecuperacionRepository codigoRecuperacionRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
        AuthenticationManager authenticationManager,
        UsuarioRepository usuarioRepository,
        JwtService jwtService,
        CodigoRecuperacionRepository codigoRecuperacionRepository,
        EmailService emailService,
        PasswordEncoder passwordEncoder
    ) {
        this.authenticationManager = authenticationManager;
        this.usuarioRepository = usuarioRepository;
        this.jwtService = jwtService;
        this.codigoRecuperacionRepository = codigoRecuperacionRepository;
        this.emailService = emailService;
        this.passwordEncoder = passwordEncoder;
    }

    public AuthResponse login(LoginRequest request) {
        var authentication = authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(request.email(), request.password())
        );
        Usuario usuario = findByEmail(authentication.getName());
        String token = jwtService.generateToken((UserDetails) authentication.getPrincipal(), usuario.getRol().name());
        return new AuthResponse(token, UserResponse.from(usuario));
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (usuarioRepository.existsByEmail(email)) {
            throw new BusinessException("Ya existe un usuario registrado con el email: " + email);
        }

        com.diza.api.user.Rol rol = request.rol() != null ? request.rol() : com.diza.api.user.Rol.ADMIN;
        Usuario usuario = new Usuario(
            request.nombre().trim(),
            email,
            passwordEncoder.encode(request.password()),
            rol
        );
        usuario = usuarioRepository.save(usuario);

        UserDetails userDetails = User.withUsername(usuario.getEmail())
            .password(usuario.getPassword())
            .authorities("ROLE_" + usuario.getRol().name())
            .build();
        String token = jwtService.generateToken(userDetails, usuario.getRol().name());

        return new AuthResponse(token, UserResponse.from(usuario));
    }

    public UserResponse profile(String email) {
        return UserResponse.from(findByEmail(email));
    }

    @Transactional
    public String solicitarRecuperacion(SolicitudRecuperacionRequest request) {
        String email = request.email().trim().toLowerCase();
        Usuario usuario = usuarioRepository.findByEmail(email)
            .orElseThrow(() -> new ResourceNotFoundException("No existe ninguna cuenta registrada con el correo: " + email));

        // Invalidar códigos anteriores no usados
        List<CodigoRecuperacion> anteriores = codigoRecuperacionRepository.findByEmailAndUsadoFalse(email);
        for (CodigoRecuperacion prev : anteriores) {
            prev.marcarComoUsado();
        }
        codigoRecuperacionRepository.saveAll(anteriores);

        // Generar nuevo código de 6 dígitos
        String codigo = String.valueOf(ThreadLocalRandom.current().nextInt(100_000, 1_000_000));
        LocalDateTime expiracion = LocalDateTime.now().plusMinutes(15);

        CodigoRecuperacion nuevoCodigo = new CodigoRecuperacion(email, codigo, expiracion);
        codigoRecuperacionRepository.save(nuevoCodigo);

        // Enviar por correo electrónico
        emailService.enviarCodigoRecuperacion(usuario.getEmail(), codigo);

        return "Se ha enviado un código de verificación de 6 dígitos a su correo electrónico";
    }

    @Transactional(readOnly = true)
    public boolean verificarCodigo(VerificarCodigoRequest request) {
        String email = request.email().trim().toLowerCase();
        String codigo = request.codigo().trim();

        CodigoRecuperacion codigoRecup = codigoRecuperacionRepository
            .findTopByEmailAndCodigoAndUsadoFalseOrderByFechaCreacionDesc(email, codigo)
            .orElseThrow(() -> new BusinessException("El código de verificación es inválido o ha sido utilizado"));

        if (!codigoRecup.isValido(LocalDateTime.now())) {
            throw new BusinessException("El código de verificación ha expirado. Por favor solicite uno nuevo.");
        }

        return true;
    }

    @Transactional
    public String restablecerPassword(RestablecerPasswordRequest request) {
        String email = request.email().trim().toLowerCase();
        String codigo = request.codigo().trim();

        Usuario usuario = usuarioRepository.findByEmail(email)
            .orElseThrow(() -> new ResourceNotFoundException("No existe ninguna cuenta registrada con el correo: " + email));

        CodigoRecuperacion codigoRecup = codigoRecuperacionRepository
            .findTopByEmailAndCodigoAndUsadoFalseOrderByFechaCreacionDesc(email, codigo)
            .orElseThrow(() -> new BusinessException("El código de verificación es inválido o ha sido utilizado"));

        if (!codigoRecup.isValido(LocalDateTime.now())) {
            throw new BusinessException("El código de verificación ha expirado. Por favor solicite uno nuevo.");
        }

        // Actualizar contraseña del usuario
        usuario.setPassword(passwordEncoder.encode(request.nuevaPassword()));
        usuarioRepository.save(usuario);

        // Marcar código como usado
        codigoRecup.marcarComoUsado();
        codigoRecuperacionRepository.save(codigoRecup);

        return "La contraseña ha sido restablecida exitosamente. Ahora puede iniciar sesión con su nueva contraseña.";
    }

    private Usuario findByEmail(String email) {
        return usuarioRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalStateException("El usuario autenticado ya no existe"));
    }
}
