package br.edu.utfpr.dainf.security;

import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.UserRepository;
import br.edu.utfpr.dainf.service.UserService;
import br.edu.utfpr.dainf.shared.ApplicationTest;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ApplicationTest
@AutoConfigureMockMvc
public class AuthTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.refresh.secret}")
    private String refreshSecret;

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private void createAdminUser() {
        if (userRepository.findByEmail("admin@utfpr.edu.br").isEmpty()) {
            userService.save(new User(
                    null, "admin@utfpr.edu.br", "Teste123456!", "Admin",
                    "2562529", "5546988358080", null,
                    true, null, null,
                    UserRole.ROLE_ADMIN, true, null, null
            ));
        }
    }

    private void createEnabledUser(String email) {
        userRepository.findByEmail(email).ifPresent(u -> {
            u.setEnabled(true);
            userRepository.save(u);
        });
        if (userRepository.findByEmail(email).isEmpty()) {
            userService.save(new User(
                    null, email, "Teste123456!", "Test User",
                    "9999999", "5546988000001", null,
                    true, null, null,
                    UserRole.ROLE_STUDENT, true, null, null
            ));
        }
    }

    /** Logs in and returns the raw refresh token value from the Set-Cookie header. */
    private String loginAndGetRefreshCookie(String email) throws Exception {
        String body = String.format(
                "{\"email\":\"%s\",\"password\":\"Teste123456!\",\"rememberMe\":true}", email);
        MvcResult result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        String setCookie = result.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).as("Set-Cookie header must be present after login").isNotNull();
        // "refresh_token=<value>; Path=..."
        return setCookie.split(";")[0].substring("refresh_token=".length());
    }

    private String loginAndGetAccessToken(String email) throws Exception {
        String body = String.format(
                "{\"email\":\"%s\",\"password\":\"Teste123456!\",\"rememberMe\":true}", email);
        MvcResult result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString())
                .get("token").asText();
    }

    private String buildExpiredAccessToken(String email) {
        return Jwts.builder()
                .setSubject(email)
                .setIssuedAt(new Date(System.currentTimeMillis() - 10_000))
                .setExpiration(new Date(System.currentTimeMillis() - 1_000))
                .signWith(SignatureAlgorithm.HS256, jwtSecret)
                .compact();
    }

    private String buildExpiredRefreshToken(String email) {
        return Jwts.builder()
                .setSubject(email)
                .setIssuedAt(new Date(System.currentTimeMillis() - 10_000))
                .setExpiration(new Date(System.currentTimeMillis() - 1_000))
                .signWith(SignatureAlgorithm.HS256, refreshSecret)
                .compact();
    }

    // -------------------------------------------------------------------------
    // Login
    // -------------------------------------------------------------------------

    @Test
    public void loginComCredenciaisCorretas() throws Exception {
        createAdminUser();
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@utfpr.edu.br\",\"password\":\"Teste123456!\"}"))
                .andExpect(status().isOk());
    }

    @Test
    public void loginRetornaTokenEExpiresIn() throws Exception {
        createAdminUser();
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@utfpr.edu.br\",\"password\":\"Teste123456!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.expiresIn").isNumber());
    }

    @Test
    public void loginComCredenciaisErradas() throws Exception {
        mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@utfpr.edu.br\",\"password\":\"senhaErrada\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void loginComRememberMeSetaCookiePersistente() throws Exception {
        createAdminUser();
        MvcResult result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@utfpr.edu.br\",\"password\":\"Teste123456!\",\"rememberMe\":true}"))
                .andExpect(status().isOk())
                .andReturn();

        String setCookie = result.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).contains("refresh_token=");
        assertThat(setCookie).contains("HttpOnly");
        // rememberMe=true → Max-Age must be present and positive
        assertThat(setCookie).containsPattern("Max-Age=[1-9][0-9]+");
    }

    @Test
    public void loginSemRememberMeSetaCookieDeSession() throws Exception {
        createAdminUser();
        MvcResult result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@utfpr.edu.br\",\"password\":\"Teste123456!\",\"rememberMe\":false}"))
                .andExpect(status().isOk())
                .andReturn();

        String setCookie = result.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).contains("refresh_token=");
        // rememberMe=false → session cookie, no Max-Age attribute
        assertThat(setCookie).doesNotContainPattern("Max-Age=[1-9]");
    }

    @Test
    public void cadastroDeveFalharComEmailForaDoDominioUtfpr() throws Exception {
        mockMvc.perform(post("/auth/sign-up")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"Externo\",\"email\":\"externo@gmail.com\"," +
                                "\"documento\":\"123456\",\"telefone\":\"46999999999\",\"password\":\"Senha123\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.email").value("O e-mail deve ser institucional da UTFPR."));
    }

    // -------------------------------------------------------------------------
    // Refresh
    // -------------------------------------------------------------------------

    @Test
    public void refreshComCookieValidoRetornaNovoToken() throws Exception {
        createAdminUser();
        String refreshToken = loginAndGetRefreshCookie("admin@utfpr.edu.br");

        mockMvc.perform(post("/auth/refresh")
                        .cookie(new Cookie("refresh_token", refreshToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.expiresIn").isNumber());
    }

    @Test
    public void refreshRenovaOCookieDeRefresh() throws Exception {
        createAdminUser();
        String oldToken = loginAndGetRefreshCookie("admin@utfpr.edu.br");

        MvcResult result = mockMvc.perform(post("/auth/refresh")
                        .cookie(new Cookie("refresh_token", oldToken)))
                .andExpect(status().isOk())
                .andReturn();

        String setCookie = result.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).as("Refresh must set a new cookie").isNotNull();
        assertThat(setCookie).contains("refresh_token=");
        assertThat(setCookie).contains("HttpOnly");
        String newToken = setCookie.split(";")[0].substring("refresh_token=".length());
        assertThat(newToken).isNotBlank();
    }

    @Test
    public void refreshSemCookieRetorna400() throws Exception {
        mockMvc.perform(post("/auth/refresh"))
                .andExpect(status().isBadRequest());
    }

    @Test
    public void refreshComTokenInvalidoRetorna401() throws Exception {
        mockMvc.perform(post("/auth/refresh")
                        .cookie(new Cookie("refresh_token", "token.invalido.aqui")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void refreshComTokenExpiradoRetorna401() throws Exception {
        createAdminUser();
        String expired = buildExpiredRefreshToken("admin@utfpr.edu.br");

        mockMvc.perform(post("/auth/refresh")
                        .cookie(new Cookie("refresh_token", expired)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void refreshParaUsuarioDesabilitadoRetorna401() throws Exception {
        String email = "disabled-refresh@utfpr.edu.br";
        createEnabledUser(email);
        String refreshToken = loginAndGetRefreshCookie(email);

        // Disable the user after obtaining the refresh cookie
        userRepository.findByEmail(email).ifPresent(u -> {
            u.setEnabled(false);
            userRepository.save(u);
        });

        mockMvc.perform(post("/auth/refresh")
                        .cookie(new Cookie("refresh_token", refreshToken)))
                .andExpect(status().isUnauthorized());
    }

    // -------------------------------------------------------------------------
    // Logout
    // -------------------------------------------------------------------------

    @Test
    public void logoutLimpaOCookieDeRefresh() throws Exception {
        MvcResult result = mockMvc.perform(post("/auth/logout"))
                .andExpect(status().isOk())
                .andReturn();

        String setCookie = result.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).isNotNull();
        assertThat(setCookie).contains("refresh_token=;");
        assertThat(setCookie).containsPattern("Max-Age=0");
    }

    // -------------------------------------------------------------------------
    // Protected endpoint — token validation
    // -------------------------------------------------------------------------

    @Test
    public void endpointProtegidoSemTokenRetorna401() throws Exception {
        mockMvc.perform(post("/categories/search")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void endpointProtegidoComTokenValidoPermiteAcesso() throws Exception {
        createAdminUser();
        String token = loginAndGetAccessToken("admin@utfpr.edu.br");

        mockMvc.perform(post("/categories/search")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    public void endpointProtegidoComTokenExpiradoRetorna401() throws Exception {
        createAdminUser();
        String expired = buildExpiredAccessToken("admin@utfpr.edu.br");

        mockMvc.perform(post("/categories/search")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .header("Authorization", "Bearer " + expired))
                .andExpect(status().isUnauthorized());
    }

    @Test
    public void endpointProtegidoParaUsuarioDesabilitadoRetorna401() throws Exception {
        String email = "disabled-endpoint@utfpr.edu.br";
        createEnabledUser(email);
        String token = loginAndGetAccessToken(email);

        userRepository.findByEmail(email).ifPresent(u -> {
            u.setEnabled(false);
            userRepository.save(u);
        });

        mockMvc.perform(post("/categories/search")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }
}
