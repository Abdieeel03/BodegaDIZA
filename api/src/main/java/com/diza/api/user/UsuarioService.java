package com.diza.api.user;

import com.diza.api.common.BusinessException;
import com.diza.api.common.ResourceNotFoundException;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class UsuarioService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public UsuarioService(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<UsuarioResponse> listar() {
        return usuarioRepository.findAllByOrderByNombreAsc().stream()
            .map(UsuarioResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public UsuarioResponse obtenerPorId(Long id) {
        return UsuarioResponse.from(buscarPorId(id));
    }

    @Transactional
    public UsuarioResponse crear(UsuarioRequest request) {
        String email = request.email().trim().toLowerCase();
        if (usuarioRepository.existsByEmail(email)) {
            throw new BusinessException("Ya existe un usuario con el email: " + email);
        }

        Usuario usuario = new Usuario(
            request.nombre().trim(),
            email,
            passwordEncoder.encode(request.password()),
            request.rol()
        );
        return UsuarioResponse.from(usuarioRepository.save(usuario));
    }

    @Transactional
    public UsuarioResponse actualizar(Long id, UsuarioUpdateRequest request) {
        Usuario usuario = buscarPorId(id);
        String email = request.email().trim().toLowerCase();

        if (usuarioRepository.existsByEmailAndIdNot(email, id)) {
            throw new BusinessException("Ya existe otro usuario con el email: " + email);
        }

        usuario.actualizar(request.nombre().trim(), email, request.rol());
        if (StringUtils.hasText(request.password())) {
            usuario.setPassword(passwordEncoder.encode(request.password()));
        }

        return UsuarioResponse.from(usuario);
    }

    public Usuario buscarPorId(Long id) {
        return usuarioRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado con ID: " + id));
    }
}
