package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.dto.UserProfileDTO;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.mail.MailService;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.LoanRepository;
import br.edu.utfpr.dainf.repository.UserRecoveryRepository;
import br.edu.utfpr.dainf.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceProfileTest {

    @Mock private PasswordEncoder passwordEncoder;
    @Mock private UserRecoveryRepository userRecoveryRepository;
    @Mock private MailService mailService;
    @Mock private ConfigurationService configurationService;
    @Mock private LoanRepository loanRepository;
    @Mock private UserRepository repository;

    private UserService service;
    private User stored;

    @BeforeEach
    void setUp() {
        service = new UserService(passwordEncoder, userRecoveryRepository, mailService, configurationService, loanRepository);
        ReflectionTestUtils.setField(service, "repository", repository);

        stored = User.builder()
                .id(5L)
                .email("aluno@alunos.utfpr.edu.br")
                .password("enc:Antiga1")
                .nome("Nome Antigo")
                .documento("111")
                .telefone("46900000000")
                .role(UserRole.ROLE_STUDENT)
                .enabled(true)
                .build();

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(stored, null, List.of()));
        lenient().when(repository.findById(5L)).thenReturn(Optional.of(stored));
        lenient().when(repository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private static UserProfileDTO profile(String nome, String documento, String telefone) {
        UserProfileDTO dto = new UserProfileDTO();
        dto.setNome(nome);
        dto.setDocumento(documento);
        dto.setTelefone(telefone);
        return dto;
    }

    @Test
    void updateProfile_changesOnlyNameDocumentAndPhone() {
        User saved = service.updateProfile(profile("Nome Novo", "222", "46911111111"));

        assertThat(saved.getNome()).isEqualTo("Nome Novo");
        assertThat(saved.getDocumento()).isEqualTo("222");
        assertThat(saved.getTelefone()).isEqualTo("46911111111");
        assertThat(saved.getEmail()).isEqualTo("aluno@alunos.utfpr.edu.br");
        assertThat(saved.getRole()).isEqualTo(UserRole.ROLE_STUDENT);
        assertThat(saved.isEnabled()).isTrue();
        assertThat(saved.getPassword()).isEqualTo("enc:Antiga1");
    }

    @Test
    void updateProfile_documentUsedByAnotherUser_throwsWarnException() {
        when(repository.existsByDocumentoNormalizedAndIdNot("222", 5L)).thenReturn(true);

        assertThatThrownBy(() -> service.updateProfile(profile("Nome Novo", "222", "46911111111")))
                .isInstanceOf(WarnException.class)
                .hasMessageContaining("RA/SIAPE");
        verify(repository, never()).save(any());
    }

    @Test
    void updateProfile_changesPasswordWhenCurrentPasswordMatches() {
        UserProfileDTO dto = profile("Nome Antigo", "111", "46900000000");
        dto.setCurrentPassword("Antiga1");
        dto.setNewPassword("Nova1234");
        when(passwordEncoder.matches("Antiga1", "enc:Antiga1")).thenReturn(true);
        when(passwordEncoder.encode("Nova1234")).thenReturn("enc:Nova1234");

        User saved = service.updateProfile(dto);

        assertThat(saved.getPassword()).isEqualTo("enc:Nova1234");
    }

    @Test
    void updateProfile_wrongCurrentPassword_throwsAndKeepsPassword() {
        UserProfileDTO dto = profile("Nome Antigo", "111", "46900000000");
        dto.setCurrentPassword("errada");
        dto.setNewPassword("Nova1234");
        when(passwordEncoder.matches("errada", "enc:Antiga1")).thenReturn(false);

        assertThatThrownBy(() -> service.updateProfile(dto))
                .isInstanceOf(WarnException.class)
                .hasMessageContaining("senha atual");
        verify(repository, never()).save(any());
    }

    @Test
    void updateProfile_newPasswordWithoutCurrentPassword_throws() {
        UserProfileDTO dto = profile("Nome Antigo", "111", "46900000000");
        dto.setNewPassword("Nova1234");

        assertThatThrownBy(() -> service.updateProfile(dto)).isInstanceOf(WarnException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void updateProfile_withoutAuthenticatedUser_throws() {
        SecurityContextHolder.clearContext();

        assertThatThrownBy(() -> service.updateProfile(profile("A", null, "1")))
                .isInstanceOf(WarnException.class);
    }
}
