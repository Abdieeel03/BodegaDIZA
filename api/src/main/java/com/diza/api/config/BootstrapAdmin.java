package com.diza.api.config;

import com.diza.api.user.Rol;
import com.diza.api.user.Usuario;
import com.diza.api.user.UsuarioRepository;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.util.StringUtils;

@Configuration
public class BootstrapAdmin {

    @Bean
    ApplicationRunner createDevelopmentAdmin(
        AppProperties appProperties,
        UsuarioRepository usuarioRepository,
        PasswordEncoder passwordEncoder
    ) {
        return arguments -> {
            AppProperties.BootstrapAdmin admin = appProperties.bootstrapAdmin();
            if (!StringUtils.hasText(admin.email()) && !StringUtils.hasText(admin.password())) {
                return;
            }
            if (!StringUtils.hasText(admin.email()) || !StringUtils.hasText(admin.password())) {
                throw new IllegalStateException("ADMIN_EMAIL y ADMIN_PASSWORD deben configurarse juntos");
            }

            usuarioRepository.findByEmail(admin.email()).orElseGet(() -> usuarioRepository.save(
                new Usuario(admin.nombre(), admin.email(), passwordEncoder.encode(admin.password()), Rol.ADMIN)
            ));
        };
    }
}
