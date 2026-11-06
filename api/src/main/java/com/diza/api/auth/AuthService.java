package com.diza.api.auth;

import com.diza.api.security.JwtService;
import com.diza.api.user.Usuario;
import com.diza.api.user.UsuarioRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final UsuarioRepository usuarioRepository;
    private final JwtService jwtService;

    public AuthService(
        AuthenticationManager authenticationManager,
        UsuarioRepository usuarioRepository,
        JwtService jwtService
    ) {
        this.authenticationManager = authenticationManager;
        this.usuarioRepository = usuarioRepository;
        this.jwtService = jwtService;
    }

    public AuthResponse login(LoginRequest request) {
        var authentication = authenticationManager.authenticate(
            UsernamePasswordAuthenticationToken.unauthenticated(request.email(), request.password())
        );
        Usuario usuario = findByEmail(authentication.getName());
        String token = jwtService.generateToken((UserDetails) authentication.getPrincipal(), usuario.getRol().name());
        return new AuthResponse(token, UserResponse.from(usuario));
    }

    public UserResponse profile(String email) {
        return UserResponse.from(findByEmail(email));
    }

    private Usuario findByEmail(String email) {
        return usuarioRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalStateException("El usuario autenticado ya no existe"));
    }
}
