package com.diza.api.category;

public record CategoriaResponse(
    Long id,
    String nombre,
    String descripcion,
    boolean activa
) {
    public static CategoriaResponse from(Categoria categoria) {
        return new CategoriaResponse(
            categoria.getId(),
            categoria.getNombre(),
            categoria.getDescripcion(),
            categoria.isActiva()
        );
    }
}
