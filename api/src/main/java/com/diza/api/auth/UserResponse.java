package com.diza.api.auth;

import com.diza.api.user.Usuario;

public record UserResponse(Long id, String nombre, String email, String rol) {

    public static UserResponse from(Usuario usuario) {
        return new UserResponse(
            usuario.getId(),
            usuario.getNombre(),
            usuario.getEmail(),
            usuario.getRol().name()
        );
    }
}
