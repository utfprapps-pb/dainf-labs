package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.dto.UserSignupDTO;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private AuthenticationManager authManager;
    @Mock private JwtService jwtService;
    @Mock private UserService userService;

    @InjectMocks private AuthService authService;

    @Test
    @DisplayName("login normaliza o e-mail (trim + minúsculas) antes de autenticar e gerar o token")
    void loginNormalizesEmail() {
        when(jwtService.generateToken("fulano@utfpr.edu.br")).thenReturn("tok");
        when(jwtService.getJwtExpirationMs()).thenReturn(60_000L);

        var response = authService.login("  Fulano@UTFPR.edu.br ", "Senha123");

        ArgumentCaptor<UsernamePasswordAuthenticationToken> auth =
                ArgumentCaptor.forClass(UsernamePasswordAuthenticationToken.class);
        verify(authManager).authenticate(auth.capture());
        assertThat(auth.getValue().getPrincipal()).isEqualTo("fulano@utfpr.edu.br");
        assertThat(auth.getValue().getCredentials()).isEqualTo("Senha123");
        assertThat(response.token()).isEqualTo("tok");
    }

    @Test
    @DisplayName("signUp cria sempre um ROLE_STUDENT desabilitado via register (ignora qualquer elevação)")
    void signUpRegistersStudent() {
        UserSignupDTO dto = new UserSignupDTO("Fulano de Tal", "fulano@alunos.utfpr.edu.br", "1234567", "46999999999", "Senha123");

        authService.signUp(dto);

        ArgumentCaptor<User> user = ArgumentCaptor.forClass(User.class);
        verify(userService).register(user.capture());
        assertThat(user.getValue().getId()).isNull();
        assertThat(user.getValue().getRole()).isEqualTo(UserRole.ROLE_STUDENT);
        assertThat(user.getValue().isEnabled()).isFalse();
        verify(userService, never()).save(any());
    }
}
