package com.diza.api.supplier;

public record ProveedorResponse(
    Long id,
    String nombre,
    String ruc,
    String telefono,
    String email,
    boolean activo
) {
    public static ProveedorResponse from(Proveedor proveedor) {
        return new ProveedorResponse(
            proveedor.getId(),
            proveedor.getNombre(),
            proveedor.getRuc(),
            proveedor.getTelefono(),
            proveedor.getEmail(),
            proveedor.isActivo()
        );
    }
}
