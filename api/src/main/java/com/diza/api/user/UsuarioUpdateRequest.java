package com.diza.api.user;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UsuarioUpdateRequest(
    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 100, message = "El nombre no puede superar los 100 caracteres")
    String nombre,

    @NotBlank(message = "El email es obligatorio")
    @Email(message = "El formato de email no es válido")
    @Size(max = 150, message = "El email no puede superar los 150 caracteres")
    String email,

    @NotNull(message = "El rol es obligatorio")
    Rol rol,

    @Size(min = 6, message = "La contraseña debe tener al menos 6 caracteres")
    String password
) {}
