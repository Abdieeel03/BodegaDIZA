package com.diza.api.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "codigos_recuperacion",
    indexes = {
        @Index(name = "idx_cod_recup_email", columnList = "email"),
        @Index(name = "idx_cod_recup_email_cod", columnList = "email,codigo")
    }
)
public class CodigoRecuperacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String email;

    @Column(nullable = false, length = 6)
    private String codigo;

    @Column(name = "fecha_expiracion", nullable = false)
    private LocalDateTime fechaExpiracion;

    @Column(nullable = false)
    private boolean usado = false;

    @Column(name = "fecha_creacion", nullable = false)
    private LocalDateTime fechaCreacion;

    protected CodigoRecuperacion() {
    }

    public CodigoRecuperacion(String email, String codigo, LocalDateTime fechaExpiracion) {
        this.email = email;
        this.codigo = codigo;
        this.fechaExpiracion = fechaExpiracion;
        this.fechaCreacion = LocalDateTime.now();
        this.usado = false;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getCodigo() {
        return codigo;
    }

    public LocalDateTime getFechaExpiracion() {
        return fechaExpiracion;
    }

    public boolean isUsado() {
        return usado;
    }

    public LocalDateTime getFechaCreacion() {
        return fechaCreacion;
    }

    public boolean isExpirado(LocalDateTime ahora) {
        return ahora.isAfter(this.fechaExpiracion);
    }

    public boolean isValido(LocalDateTime ahora) {
        return !this.usado && !isExpirado(ahora);
    }

    public void marcarComoUsado() {
        this.usado = true;
    }
}
