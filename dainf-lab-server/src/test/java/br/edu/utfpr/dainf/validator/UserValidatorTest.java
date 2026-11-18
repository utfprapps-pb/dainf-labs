package br.edu.utfpr.dainf.validator;

import br.edu.utfpr.dainf.dto.UserDTO;
import br.edu.utfpr.dainf.dto.UserSignupDTO;
import br.edu.utfpr.dainf.repository.UserRepository;
import jakarta.validation.ConstraintValidatorContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserValidatorTest {

    @Mock
    private UserRepository repository;

    @Spy
    @InjectMocks
    private UserValidator userValidator;

    @Mock
    private ConstraintValidatorContext context;

    @BeforeEach
    void setUp() {
        lenient().doNothing().when(userValidator).handleMessage(any(), any(), any());
    }

    private static UserDTO dto(Long id, String email, String documento) {
        return UserDTO.builder().id(id).email(email).documento(documento).build();
    }

    private static UserSignupDTO signup(String email, String documento) {
        return new UserSignupDTO("Fulano de Tal", email, documento, "46999999999", "Senha123");
    }

    @Nested
    @DisplayName("Cadastro/edição pelo admin (UserDTO)")
    class UserDtoCases {

        @Test
        @DisplayName("Válido quando e-mail e documento não pertencem a outro usuário")
        void valid() {
            when(repository.existsByEmailNormalizedAndIdNot("admin@utfpr.edu.br", 1L)).thenReturn(false);
            when(repository.existsByDocumentoNormalizedAndIdNot("123", 1L)).thenReturn(false);

            assertTrue(userValidator.isValid(dto(1L, "admin@utfpr.edu.br", "123"), context));
            verify(userValidator, never()).handleMessage(any(), any(), any());
        }

        @Test
        @DisplayName("Inválido quando o e-mail pertence a outro usuário")
        void emailOfAnotherUser() {
            when(repository.existsByEmailNormalizedAndIdNot("admin@utfpr.edu.br", 1L)).thenReturn(true);

            assertFalse(userValidator.isValid(dto(1L, "admin@utfpr.edu.br", null), context));
            verify(userValidator).handleMessage(context, "O e-mail informado já está em uso", "email");
        }

        @Test
        @DisplayName("E-mail é normalizado (caixa/espaços) antes da consulta")
        void emailNormalized() {
            when(repository.existsByEmailNormalizedAndIdNot("admin@utfpr.edu.br", 1L)).thenReturn(true);

            assertFalse(userValidator.isValid(dto(1L, "  Admin@UTFPR.edu.br ", null), context));
        }

        @Test
        @DisplayName("Criação pelo admin (id nulo) usa a consulta sem exclusão de id")
        void createByAdminUsesExistsWithoutId() {
            when(repository.existsByEmailNormalized("novo@utfpr.edu.br")).thenReturn(true);

            assertFalse(userValidator.isValid(dto(null, "novo@utfpr.edu.br", null), context));
            verify(repository, never()).existsByEmailNormalizedAndIdNot(any(), any());
        }

        @Test
        @DisplayName("Inválido quando o documento pertence a outro usuário")
        void documentoOfAnotherUser() {
            when(repository.existsByEmailNormalizedAndIdNot(any(), eq(1L))).thenReturn(false);
            when(repository.existsByDocumentoNormalizedAndIdNot("2343185", 1L)).thenReturn(true);

            assertFalse(userValidator.isValid(dto(1L, "a@utfpr.edu.br", " 2343185 "), context));
            verify(userValidator).handleMessage(context, "O RA/SIAPE informado já está cadastrado", "documento");
        }

        @Test
        @DisplayName("Reporta e-mail e documento duplicados ao mesmo tempo")
        void reportsBothViolations() {
            when(repository.existsByEmailNormalizedAndIdNot(any(), eq(1L))).thenReturn(true);
            when(repository.existsByDocumentoNormalizedAndIdNot(any(), eq(1L))).thenReturn(true);

            assertFalse(userValidator.isValid(dto(1L, "a@utfpr.edu.br", "123"), context));
            verify(userValidator).handleMessage(context, "O e-mail informado já está em uso", "email");
            verify(userValidator).handleMessage(context, "O RA/SIAPE informado já está cadastrado", "documento");
        }

        @Test
        @DisplayName("E-mail e documento nulos/vazios não consultam o banco")
        void blankFieldsSkipQueries() {
            assertTrue(userValidator.isValid(dto(1L, null, "   "), context));
            assertTrue(userValidator.isValid(dto(1L, "  ", null), context));
            verifyNoInteractions(repository);
        }
    }

    @Nested
    @DisplayName("Autocadastro (UserSignupDTO)")
    class SignupCases {

        @Test
        @DisplayName("Válido quando e-mail e documento são novos")
        void valid() {
            when(repository.existsByEmailNormalized("fulano@alunos.utfpr.edu.br")).thenReturn(false);
            when(repository.existsByDocumentoNormalized("1234567")).thenReturn(false);

            assertTrue(userValidator.isValid(signup("fulano@alunos.utfpr.edu.br", "1234567"), context));
        }

        @Test
        @DisplayName("Inválido quando o e-mail já existe (com outra caixa)")
        void existingEmailDifferentCase() {
            when(repository.existsByEmailNormalized("fulano@alunos.utfpr.edu.br")).thenReturn(true);

            assertFalse(userValidator.isValid(signup("FULANO@alunos.UTFPR.edu.br", null), context));
            verify(repository, never()).existsByEmailNormalizedAndIdNot(any(), any());
        }

        @Test
        @DisplayName("Inválido quando o documento já existe (mesmo com espaços)")
        void existingDocumento() {
            when(repository.existsByEmailNormalized("fulano@alunos.utfpr.edu.br")).thenReturn(false);
            when(repository.existsByDocumentoNormalized("1234567")).thenReturn(true);

            assertFalse(userValidator.isValid(signup("fulano@alunos.utfpr.edu.br", " 1234567 "), context));
            verify(userValidator).handleMessage(context, "O RA/SIAPE informado já está cadastrado", "documento");
        }
    }

    @Test
    @DisplayName("Objetos nulos ou de outros tipos são considerados válidos")
    void nullOrOtherTypes() {
        assertTrue(userValidator.isValid(null, context));
        assertTrue(userValidator.isValid("qualquer coisa", context));
        verifyNoInteractions(repository);
    }
}
