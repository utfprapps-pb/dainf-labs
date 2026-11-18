package br.edu.utfpr.dainf.security;

import br.edu.utfpr.dainf.config.UserUniqueIndexInitializer;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.exception.MailException;
import br.edu.utfpr.dainf.mail.Mail;
import br.edu.utfpr.dainf.mail.MailService;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.UserRepository;
import br.edu.utfpr.dainf.service.UserService;
import br.edu.utfpr.dainf.shared.ApplicationTest;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Garante, contra um PostgreSQL real, que não é possível criar cadastros duplicados
 * (mesmo e-mail com caixa diferente, mesmo RA/SIAPE, ou requisições simultâneas).
 */
@ApplicationTest
@AutoConfigureMockMvc
class UserDuplicationIntegrationTest {

    private static final String PASSWORD = "Senha123";

    @Autowired private TestRestTemplate rest;
    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private UserRepository userRepository;
    @Autowired private UserService userService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ObjectMapper objectMapper;

    // ---------------------------------------------------------------- helpers

    private static String unique() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private static String uniqueDocumento() {
        return String.valueOf(ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L));
    }

    private ResponseEntity<String> signUp(String email, String documento) {
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("nome", "Fulano de Tal");
        body.put("email", email);
        body.put("documento", documento);
        body.put("telefone", "46999999999");
        body.put("password", PASSWORD);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return rest.postForEntity("/auth/sign-up", new HttpEntity<>(body, headers), String.class);
    }

    private ResponseEntity<String> login(String email) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> body = Map.of("email", email, "password", PASSWORD, "rememberMe", false);
        return rest.postForEntity("/auth/login", new HttpEntity<>(body, headers), String.class);
    }

    private JsonNode json(ResponseEntity<String> response) throws Exception {
        return objectMapper.readTree(response.getBody());
    }

    private int countByEmail(String email) {
        Integer n = jdbc.queryForObject(
                "select count(*) from app_user where lower(trim(email)) = lower(trim(?))", Integer.class, email);
        return n == null ? 0 : n;
    }

    private int countByDocumento(String documento) {
        Integer n = jdbc.queryForObject(
                "select count(*) from app_user where trim(documento) = trim(?)", Integer.class, documento);
        return n == null ? 0 : n;
    }

    /** Insere direto via SQL, ignorando validação e normalização da aplicação (simula dados legados). */
    private void insertRaw(String email, String documento, boolean enabled) {
        jdbc.update("""
                insert into app_user (email, password, nome, documento, telefone, email_verificado, enabled, role)
                values (?, ?, 'Legado', ?, '46999999999', ?, ?, 'ROLE_STUDENT')
                """, email, passwordEncoder.encode(PASSWORD), documento, enabled, enabled);
    }

    private void enable(String email) {
        User u = userRepository.findByEmail(email).orElseThrow();
        u.setEnabled(true);
        u.setEmailVerificado(true);
        userRepository.save(u);
    }

    // ---------------------------------------------------------------- índices

    @Nested
    @DisplayName("Índices únicos no banco")
    class Indexes {

        @Test
        @DisplayName("Os dois índices únicos existem após o start da aplicação")
        void indexesExist() {
            List<String> defs = jdbc.queryForList(
                    "select indexdef from pg_indexes where tablename = 'app_user' and indexname in (?, ?)",
                    String.class, UserUniqueIndexInitializer.EMAIL_INDEX, UserUniqueIndexInitializer.DOCUMENTO_INDEX);

            assertThat(defs).hasSize(2);
            assertThat(defs).anySatisfy(d -> assertThat(d).contains("UNIQUE").contains("lower(TRIM(BOTH FROM email))"));
            assertThat(defs).anySatisfy(d -> assertThat(d).contains("UNIQUE").contains("WHERE"));
        }

        @Test
        @DisplayName("O banco rejeita e-mails que diferem só por caixa/espaços, mesmo sem passar pela aplicação")
        void dbRejectsCaseVariantEmails() {
            String local = "raw" + unique();
            insertRaw(local + "@utfpr.edu.br", null, true);

            assertThatThrownBy(() -> insertRaw("  " + local.toUpperCase() + "@UTFPR.edu.br ", null, true))
                    .isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining(UserUniqueIndexInitializer.EMAIL_INDEX);
        }

        @Test
        @DisplayName("O banco rejeita documento repetido, mesmo sem passar pela aplicação")
        void dbRejectsDuplicateDocumento() {
            String doc = uniqueDocumento();
            insertRaw("a" + unique() + "@utfpr.edu.br", doc, true);

            assertThatThrownBy(() -> insertRaw("b" + unique() + "@utfpr.edu.br", " " + doc + " ", true))
                    .isInstanceOf(DataIntegrityViolationException.class)
                    .hasMessageContaining(UserUniqueIndexInitializer.DOCUMENTO_INDEX);
        }

        @Test
        @DisplayName("Vários usuários sem documento (null ou vazio) continuam permitidos")
        void nullAndBlankDocumentoAllowed() {
            insertRaw("n1" + unique() + "@utfpr.edu.br", null, true);
            insertRaw("n2" + unique() + "@utfpr.edu.br", null, true);
            insertRaw("e1" + unique() + "@utfpr.edu.br", "", true);
            insertRaw("e2" + unique() + "@utfpr.edu.br", "  ", true);
        }

        @Test
        @DisplayName("Initializer é idempotente (pode rodar a cada start)")
        void initializerIsIdempotent() throws Exception {
            new UserUniqueIndexInitializer(jdbc).run(null);
            new UserUniqueIndexInitializer(jdbc).run(null);
            Integer n = jdbc.queryForObject(
                    "select count(*) from pg_indexes where tablename = 'app_user' and indexname like 'ux_app_user_%'",
                    Integer.class);
            assertThat(n).isEqualTo(2);
        }
    }

    // ---------------------------------------------------------------- autocadastro

    @Nested
    @DisplayName("Autocadastro (/auth/sign-up)")
    class SignUp {

        @Test
        @DisplayName("Cadastro válido grava o e-mail normalizado e o usuário desabilitado com token")
        void validSignUpStoresNormalizedUser() {
            String local = "Novo" + unique();
            ResponseEntity<String> response = signUp(local + "@ALUNOS.utfpr.edu.br", uniqueDocumento());

            assertThat(response.getStatusCode().value()).isEqualTo(201);
            User saved = userRepository.findByEmail(local.toLowerCase() + "@alunos.utfpr.edu.br").orElseThrow();
            assertThat(saved.getEmail()).isEqualTo(local.toLowerCase() + "@alunos.utfpr.edu.br");
            assertThat(saved.isEnabled()).isFalse();
            assertThat(saved.isEmailVerificado()).isFalse();
            assertThat(saved.getEmailVerificationToken()).isNotBlank();
            assertThat(saved.getRole()).isEqualTo(UserRole.ROLE_STUDENT);
        }

        @Test
        @DisplayName("Reenviar o mesmo cadastro (ex.: segundo clique) é rejeitado e não duplica")
        void resubmitSameData() throws Exception {
            String email = "dup" + unique() + "@alunos.utfpr.edu.br";
            String doc = uniqueDocumento();

            assertThat(signUp(email, doc).getStatusCode().value()).isEqualTo(201);
            ResponseEntity<String> second = signUp(email, doc);

            assertThat(second.getStatusCode().value()).isEqualTo(400);
            assertThat(json(second).at("/errors/email").asText()).isEqualTo("O e-mail informado já está em uso");
            assertThat(countByEmail(email)).isEqualTo(1);
        }

        @Test
        @DisplayName("Mesmo e-mail com caixa diferente é rejeitado")
        void sameEmailDifferentCase() throws Exception {
            String local = "caixa" + unique();
            assertThat(signUp(local + "@alunos.utfpr.edu.br", uniqueDocumento()).getStatusCode().value()).isEqualTo(201);

            ResponseEntity<String> second = signUp(local.toUpperCase() + "@Alunos.UTFPR.edu.br", uniqueDocumento());

            assertThat(second.getStatusCode().value()).isEqualTo(400);
            assertThat(json(second).at("/errors/email").asText()).isEqualTo("O e-mail informado já está em uso");
            assertThat(countByEmail(local + "@alunos.utfpr.edu.br")).isEqualTo(1);
        }

        @Test
        @DisplayName("Mesmo RA/SIAPE com outro e-mail (ex.: outro domínio UTFPR) é rejeitado")
        void sameDocumentoOtherEmail() throws Exception {
            String local = "ra" + unique();
            String doc = uniqueDocumento();
            assertThat(signUp(local + "@alunos.utfpr.edu.br", doc).getStatusCode().value()).isEqualTo(201);

            ResponseEntity<String> second = signUp(local + "@utfpr.edu.br", doc);

            assertThat(second.getStatusCode().value()).isEqualTo(400);
            assertThat(json(second).at("/errors/documento").asText()).isEqualTo("O RA/SIAPE informado já está cadastrado");
            assertThat(countByDocumento(doc)).isEqualTo(1);
        }

        @Test
        @DisplayName("E-mail já existente em dados legados (com maiúsculas) bloqueia novo cadastro")
        void legacyMixedCaseEmailBlocksSignUp() throws Exception {
            String local = "Legado" + unique();
            insertRaw(local + "@Alunos.UTFPR.edu.br", null, false);

            ResponseEntity<String> response = signUp(local.toLowerCase() + "@alunos.utfpr.edu.br", uniqueDocumento());

            assertThat(response.getStatusCode().value()).isEqualTo(400);
            assertThat(json(response).at("/errors/email").asText()).isEqualTo("O e-mail informado já está em uso");
        }

        @Test
        @DisplayName("Requisições SIMULTÂNEAS com o mesmo e-mail geram exatamente 1 cadastro")
        void concurrentSignUpsSameEmail() throws Exception {
            String email = "race" + unique() + "@alunos.utfpr.edu.br";
            List<Integer> statuses = runConcurrently(10, i -> signUp(email, uniqueDocumento()));

            assertThat(statuses).filteredOn(s -> s == 201).hasSize(1);
            assertThat(statuses).filteredOn(s -> s == 400).hasSize(9);
            assertThat(countByEmail(email)).isEqualTo(1);
        }

        @Test
        @DisplayName("Requisições SIMULTÂNEAS com o mesmo RA/SIAPE geram exatamente 1 cadastro")
        void concurrentSignUpsSameDocumento() throws Exception {
            String doc = uniqueDocumento();
            List<Integer> statuses = runConcurrently(10,
                    i -> signUp("racedoc" + i + unique() + "@alunos.utfpr.edu.br", doc));

            assertThat(statuses).filteredOn(s -> s == 201).hasSize(1);
            assertThat(statuses).filteredOn(s -> s == 400).hasSize(9);
            assertThat(countByDocumento(doc)).isEqualTo(1);
        }

        @Test
        @DisplayName("Se o envio do e-mail falhar, o cadastro é desfeito e a pessoa pode tentar de novo")
        void mailFailureRollsBack() {
            String email = "mailfail" + unique() + "@alunos.utfpr.edu.br";
            String doc = uniqueDocumento();

            UserService target = AopTestUtils.getUltimateTargetObject(userService);
            MailService original = (MailService) ReflectionTestUtils.getField(target, "mailService");
            ReflectionTestUtils.setField(target, "mailService", new MailService() {
                @Override public void send(Mail mail) { throw new MailException("SMTP indisponível"); }
                @Override public String buildTemplate(String t, Map<String, Object> v) { return ""; }
            });
            try {
                ResponseEntity<String> failed = signUp(email, doc);
                assertThat(failed.getStatusCode().is2xxSuccessful()).isFalse();
                assertThat(countByEmail(email)).as("cadastro deve ter sido desfeito").isZero();
            } finally {
                ReflectionTestUtils.setField(target, "mailService", original);
            }

            assertThat(signUp(email, doc).getStatusCode().value()).isEqualTo(201);
            assertThat(countByEmail(email)).isEqualTo(1);
        }
    }

    // ---------------------------------------------------------------- login

    @Nested
    @DisplayName("Login após normalização")
    class Login {

        @Test
        @DisplayName("Login funciona com o e-mail digitado em outra caixa/com espaços")
        void loginCaseInsensitive() {
            String local = "login" + unique();
            assertThat(signUp(local + "@alunos.utfpr.edu.br", uniqueDocumento()).getStatusCode().value()).isEqualTo(201);
            enable(local + "@alunos.utfpr.edu.br");

            assertThat(login("  " + local.toUpperCase() + "@ALUNOS.UTFPR.EDU.BR ").getStatusCode().value()).isEqualTo(200);
        }

        @Test
        @DisplayName("Usuário legado gravado com maiúsculas continua conseguindo logar")
        void legacyMixedCaseUserCanLogin() {
            String local = "Antigo" + unique();
            insertRaw(local + "@UTFPR.edu.br", null, true);

            assertThat(login(local.toLowerCase() + "@utfpr.edu.br").getStatusCode().value()).isEqualTo(200);
        }
    }

    // ---------------------------------------------------------------- admin

    @Nested
    @DisplayName("Cadastro/edição pelo admin (/users)")
    class Admin {

        private String userJson(Long id, String email, String documento) throws Exception {
            Map<String, Object> body = new java.util.HashMap<>();
            if (id != null) body.put("id", id);
            body.put("email", email);
            body.put("password", "Teste123456!");
            body.put("nome", "Pelo Admin");
            body.put("documento", documento);
            body.put("telefone", "46999999999");
            return objectMapper.writeValueAsString(body);
        }

        private Long create(String email, String documento) throws Exception {
            String id = mockMvc.perform(post("/users").with(user("admin").roles("ADMIN"))
                            .contentType(MediaType.APPLICATION_JSON).content(userJson(null, email, documento)))
                    .andExpect(status().isCreated())
                    .andReturn().getResponse().getContentAsString();
            return Long.valueOf(id);
        }

        @Test
        @DisplayName("Admin não consegue criar usuário com e-mail existente em outra caixa")
        void adminCreateDuplicateEmail() throws Exception {
            String local = "adm" + unique();
            create(local + "@utfpr.edu.br", uniqueDocumento());

            mockMvc.perform(post("/users").with(user("admin").roles("ADMIN"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(userJson(null, local.toUpperCase() + "@UTFPR.edu.br", uniqueDocumento())))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.email").value("O e-mail informado já está em uso"));
            assertThat(countByEmail(local + "@utfpr.edu.br")).isEqualTo(1);
        }

        @Test
        @DisplayName("Admin não consegue criar usuário com documento já cadastrado")
        void adminCreateDuplicateDocumento() throws Exception {
            String doc = uniqueDocumento();
            create("d1" + unique() + "@utfpr.edu.br", doc);

            mockMvc.perform(post("/users").with(user("admin").roles("ADMIN"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(userJson(null, "d2" + unique() + "@utfpr.edu.br", doc)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.documento").value("O RA/SIAPE informado já está cadastrado"));
        }

        @Test
        @DisplayName("Editar um usuário mantendo o próprio e-mail/documento é permitido")
        void updateKeepingOwnData() throws Exception {
            String email = "self" + unique() + "@utfpr.edu.br";
            String doc = uniqueDocumento();
            Long id = create(email, doc);

            mockMvc.perform(put("/users/" + id).with(user("admin").roles("ADMIN"))
                            .contentType(MediaType.APPLICATION_JSON).content(userJson(id, email.toUpperCase(), doc)))
                    .andExpect(status().isOk());
            assertThat(userRepository.findById(id).orElseThrow().getEmail()).isEqualTo(email);
        }

        @Test
        @DisplayName("Editar um usuário para o e-mail de outro é rejeitado")
        void updateToAnotherUsersEmail() throws Exception {
            String emailA = "ua" + unique() + "@utfpr.edu.br";
            create(emailA, uniqueDocumento());
            Long idB = create("ub" + unique() + "@utfpr.edu.br", uniqueDocumento());

            mockMvc.perform(put("/users/" + idB).with(user("admin").roles("ADMIN"))
                            .contentType(MediaType.APPLICATION_JSON).content(userJson(idB, emailA, uniqueDocumento())))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.email").value("O e-mail informado já está em uso"));
            assertThat(countByEmail(emailA)).isEqualTo(1);
        }

        @Test
        @DisplayName("Editar um usuário para o documento de outro é rejeitado")
        void updateToAnotherUsersDocumento() throws Exception {
            String docA = uniqueDocumento();
            create("va" + unique() + "@utfpr.edu.br", docA);
            String emailB = "vb" + unique() + "@utfpr.edu.br";
            Long idB = create(emailB, uniqueDocumento());

            mockMvc.perform(put("/users/" + idB).with(user("admin").roles("ADMIN"))
                            .contentType(MediaType.APPLICATION_JSON).content(userJson(idB, emailB, docA)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors.documento").value("O RA/SIAPE informado já está cadastrado"));
        }
    }

    // ---------------------------------------------------------------- concorrência

    private interface Call {
        ResponseEntity<String> run(int i) throws Exception;
    }

    /** Dispara N chamadas ao mesmo tempo (barreira de largada) e devolve os status HTTP. */
    private static List<Integer> runConcurrently(int n, Call call) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(n);
        CountDownLatch ready = new CountDownLatch(n);
        CountDownLatch go = new CountDownLatch(1);
        try {
            List<Future<Integer>> futures = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                final int idx = i;
                futures.add(pool.submit(() -> {
                    ready.countDown();
                    go.await();
                    return call.run(idx).getStatusCode().value();
                }));
            }
            ready.await(10, TimeUnit.SECONDS);
            go.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> f : futures) statuses.add(f.get(60, TimeUnit.SECONDS));
            return statuses;
        } finally {
            pool.shutdownNow();
        }
    }
}
