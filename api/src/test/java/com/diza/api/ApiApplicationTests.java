package com.diza.api;

import com.diza.api.security.JwtService;
import com.diza.api.user.Rol;
import com.diza.api.user.Usuario;
import com.diza.api.user.UsuarioRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiApplicationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    @Test
    void rejectsProtectedRouteWithoutToken() throws Exception {
        mockMvc.perform(get("/auth/profile"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatesValidCredentialsAndReturnsJwt() throws Exception {
        createAdmin();

        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"admin@bodegadiza.com\",\"password\":\"secure-password\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.token").isNotEmpty())
            .andExpect(jsonPath("$.data.user.email").value("admin@bodegadiza.com"))
            .andExpect(jsonPath("$.data.user.rol").value("ADMIN"));
    }

    @Test
    void rejectsInvalidCredentials() throws Exception {
        createAdmin();

        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"admin@bodegadiza.com\",\"password\":\"incorrect-password\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void returnsProfileForValidJwt() throws Exception {
        createAdmin();
        String token = jwtService.generateToken(
            User.withUsername("admin@bodegadiza.com")
                .password("unused")
                .authorities("ROLE_ADMIN")
                .build(),
            "ADMIN"
        );

        mockMvc.perform(get("/auth/profile").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.email").value("admin@bodegadiza.com"));
    }

    private void createAdmin() {
        usuarioRepository.findByEmail("admin@bodegadiza.com").orElseGet(() -> usuarioRepository.save(
            new Usuario(
                "Administrador Diza",
                "admin@bodegadiza.com",
                passwordEncoder.encode("secure-password"),
                Rol.ADMIN
            )
        ));
    }
}
