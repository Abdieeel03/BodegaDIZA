package com.diza.api.supplier;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ProveedorRequest(
    @NotBlank(message = "El nombre del proveedor es obligatorio")
    @Size(max = 150, message = "El nombre no puede superar los 150 caracteres")
    String nombre,

    @NotBlank(message = "El RUC es obligatorio")
    @Pattern(regexp = "^\\d{11}$", message = "El RUC debe contener exactamente 11 dígitos numéricos")
    String ruc,

    @Size(max = 30, message = "El teléfono no puede superar los 30 caracteres")
    String telefono,

    @Email(message = "El formato de email no es válido")
    @Size(max = 150, message = "El email no puede superar los 150 caracteres")
    String email
) {}
