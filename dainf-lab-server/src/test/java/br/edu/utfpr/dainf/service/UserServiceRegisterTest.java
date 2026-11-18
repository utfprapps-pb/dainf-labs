package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.exception.MailException;
import br.edu.utfpr.dainf.mail.Mail;
import br.edu.utfpr.dainf.mail.MailService;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.LoanRepository;
import br.edu.utfpr.dainf.repository.UserRecoveryRepository;
import br.edu.utfpr.dainf.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceRegisterTest {

    @Mock private PasswordEncoder passwordEncoder;
    @Mock private UserRecoveryRepository userRecoveryRepository;
    @Mock private MailService mailService;
    @Mock private ConfigurationService configurationService;
    @Mock private LoanRepository loanRepository;
    @Mock private UserRepository repository;

    private UserService service;

    @BeforeEach
    void setUp() {
        service = new UserService(passwordEncoder, userRecoveryRepository, mailService, configurationService, loanRepository);
        ReflectionTestUtils.setField(service, "repository", repository);
        ReflectionTestUtils.setField(service, "baseUrl", "http://app.test/");

        lenient().when(passwordEncoder.encode(anyString())).thenAnswer(inv -> "enc:" + inv.getArgument(0));
        lenient().when(repository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(42L);
            return u;
        });
        lenient().when(mailService.buildTemplate(anyString(), anyMap())).thenReturn("<html/>");
    }

    private static User newUser() {
        return User.builder()
                .email("fulano@alunos.utfpr.edu.br")
                .password("Senha123")
                .nome("Fulano")
                .documento("1234567")
                .telefone("46999999999")
                .role(UserRole.ROLE_STUDENT)
                .enabled(true)              // deve ser forçado para false
                .emailVerificado(true)      // deve ser forçado para false
                .build();
    }

    @Test
    @DisplayName("register força usuário desabilitado/não verificado, gera token de 24h e criptografa a senha")
    void registerSetsVerificationState() {
        Instant before = Instant.now();

        User saved = service.register(newUser());

        assertThat(saved.isEnabled()).isFalse();
        assertThat(saved.isEmailVerificado()).isFalse();
        assertThat(saved.getEmailVerificationToken()).isNotBlank();
        assertThat(saved.getEmailVerificationExpiresAt())
                .isBetween(before.plus(24, ChronoUnit.HOURS).minusSeconds(5), Instant.now().plus(24, ChronoUnit.HOURS));
        assertThat(saved.getPassword()).isEqualTo("enc:Senha123");
    }

    @Test
    @DisplayName("register faz flush ANTES de enviar o e-mail (violação de unicidade falha antes do envio)")
    void registerFlushesBeforeSendingMail() {
        service.register(newUser());

        InOrder inOrder = inOrder(repository, mailService);
        inOrder.verify(repository).save(any(User.class));
        inOrder.verify(repository).flush();
        inOrder.verify(mailService).send(any(Mail.class));
    }

    @Test
    @DisplayName("register envia e-mail de confirmação para o usuário com link contendo o token")
    @SuppressWarnings("unchecked")
    void registerSendsConfirmationMail() {
        User saved = service.register(newUser());

        ArgumentCaptor<java.util.Map<String, Object>> vars = ArgumentCaptor.forClass(java.util.Map.class);
        verify(mailService).buildTemplate(eq("email-verification"), vars.capture());
        assertThat(vars.getValue().get("linkConfirmacao"))
                .isEqualTo("http://app.test/confirm-mail?token=" + saved.getEmailVerificationToken());

        ArgumentCaptor<Mail> mail = ArgumentCaptor.forClass(Mail.class);
        verify(mailService).send(mail.capture());
        assertThat(mail.getValue().getTo()).isEqualTo(List.of("fulano@alunos.utfpr.edu.br"));
    }

    @Test
    @DisplayName("Se o flush viola o índice único, nenhum e-mail é enviado e a exceção propaga")
    void uniqueViolationOnFlushDoesNotSendMail() {
        doThrow(new DataIntegrityViolationException("ux_app_user_email_lower")).when(repository).flush();

        assertThatThrownBy(() -> service.register(newUser()))
                .isInstanceOf(DataIntegrityViolationException.class);
        verify(mailService, never()).send(any());
    }

    @Test
    @DisplayName("Falha no envio do e-mail propaga a exceção (provoca rollback da transação)")
    void mailFailurePropagates() {
        doThrow(new MailException("Falha ao enviar e-mail", new RuntimeException())).when(mailService).send(any());

        assertThatThrownBy(() -> service.register(newUser())).isInstanceOf(MailException.class);
    }

    @Test
    @DisplayName("register é @Transactional (necessário para o rollback quando o e-mail falha)")
    void registerIsTransactional() throws NoSuchMethodException {
        assertThat(UserService.class.getMethod("register", User.class).isAnnotationPresent(Transactional.class)).isTrue();
    }
}
