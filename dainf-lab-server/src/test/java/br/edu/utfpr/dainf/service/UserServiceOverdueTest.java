package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.LoanStatus;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.mail.MailService;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.LoanRepository;
import br.edu.utfpr.dainf.repository.UserRecoveryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceOverdueTest {

    @Mock private PasswordEncoder passwordEncoder;
    @Mock private UserRecoveryRepository userRecoveryRepository;
    @Mock private MailService mailService;
    @Mock private ConfigurationService configurationService;
    @Mock private LoanRepository loanRepository;

    private UserService service;

    @BeforeEach
    void setUp() {
        service = new UserService(passwordEncoder, userRecoveryRepository, mailService, configurationService, loanRepository);
    }

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    @Test
    void validateNoOverdueLoans_userWithOverdueLoan_throwsWarnException() {
        when(loanRepository.existsByBorrowerIdAndStatus(1L, LoanStatus.OVERDUE)).thenReturn(true);

        assertThatThrownBy(() -> service.validateNoOverdueLoans(user(1L)))
                .isInstanceOf(WarnException.class)
                .hasMessageContaining("em atraso");
    }

    @Test
    void validateNoOverdueLoans_userWithoutOverdueLoan_doesNotThrow() {
        when(loanRepository.existsByBorrowerIdAndStatus(1L, LoanStatus.OVERDUE)).thenReturn(false);

        assertThatCode(() -> service.validateNoOverdueLoans(user(1L))).doesNotThrowAnyException();
    }

    @Test
    void validateNoOverdueLoans_nullOrUnsavedUser_isIgnored() {
        assertThatCode(() -> service.validateNoOverdueLoans(null)).doesNotThrowAnyException();
        assertThatCode(() -> service.validateNoOverdueLoans(user(null))).doesNotThrowAnyException();

        verifyNoInteractions(loanRepository);
    }
}
