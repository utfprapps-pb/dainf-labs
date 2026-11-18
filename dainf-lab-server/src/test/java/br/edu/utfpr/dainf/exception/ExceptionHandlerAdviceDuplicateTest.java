package br.edu.utfpr.dainf.exception;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.mock.web.MockHttpServletRequest;

import java.sql.SQLException;

import static org.assertj.core.api.Assertions.assertThat;

class ExceptionHandlerAdviceDuplicateTest {

    private final ExceptionHandlerAdvice advice = new ExceptionHandlerAdvice();

    private static MockHttpServletRequest request() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setServletPath("/auth/sign-up");
        return request;
    }

    /** Simula a cadeia real: DataIntegrityViolationException -> ... -> PSQLException com o nome do índice. */
    private static DataIntegrityViolationException violation(String sqlMessage) {
        SQLException root = new SQLException(sqlMessage, "23505");
        return new DataIntegrityViolationException("could not execute statement",
                new RuntimeException("ConstraintViolationException", root));
    }

    @Test
    @DisplayName("Violação do índice de e-mail retorna mensagem amigável no campo 'email'")
    void emailIndex() {
        WarnMessage msg = advice.handlerSQLException(violation(
                "ERROR: duplicate key value violates unique constraint \"ux_app_user_email_lower\""), request());

        assertThat(msg.getStatus()).isEqualTo(400);
        assertThat(msg.getErrors()).containsEntry("email", "O e-mail informado já está em uso");
        assertThat(msg.getUrl()).isEqualTo("/auth/sign-up");
    }

    @Test
    @DisplayName("Violação do índice de documento retorna mensagem amigável no campo 'documento'")
    void documentoIndex() {
        WarnMessage msg = advice.handlerSQLException(violation(
                "ERROR: duplicate key value violates unique constraint \"ux_app_user_documento\""), request());

        assertThat(msg.getErrors()).containsEntry("documento", "O RA/SIAPE informado já está cadastrado");
    }

    @Test
    @DisplayName("Outras violações mantêm a mensagem genérica")
    void otherViolation() {
        WarnMessage msg = advice.handlerSQLException(violation(
                "ERROR: insert or update on table \"loan\" violates foreign key constraint \"fk_x\""), request());

        assertThat(msg.getMessage()).isEqualTo("Erro na integridade dos dados");
        assertThat(msg.getErrors()).isNull();
    }

    @Test
    @DisplayName("Exceção sem causa/mensagem não quebra o handler")
    void nullMessage() {
        WarnMessage msg = advice.handlerSQLException(new DataIntegrityViolationException(null), request());

        assertThat(msg.getMessage()).isEqualTo("Erro na integridade dos dados");
    }
}
