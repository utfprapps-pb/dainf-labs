package br.edu.utfpr.dainf.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class UserNormalizationTest {

    @ParameterizedTest(name = "\"{0}\" -> \"{1}\"")
    @CsvSource(delimiter = '|', value = {
            "fulano@alunos.utfpr.edu.br|fulano@alunos.utfpr.edu.br",
            "Fulano@Alunos.UTFPR.edu.br|fulano@alunos.utfpr.edu.br",
            "'  fulano@utfpr.edu.br  '|fulano@utfpr.edu.br",
            "'\tFULANO@UTFPR.EDU.BR\n'|fulano@utfpr.edu.br",
    })
    @DisplayName("normalizeEmail aplica trim e converte para minúsculas")
    void normalizeEmail(String input, String expected) {
        assertEquals(expected, User.normalizeEmail(input));
    }

    @Test
    @DisplayName("normalizeEmail usa Locale.ROOT (não quebra com 'I' em locale turco)")
    void normalizeEmail_localeIndependent() {
        java.util.Locale original = java.util.Locale.getDefault();
        try {
            java.util.Locale.setDefault(java.util.Locale.forLanguageTag("tr-TR"));
            assertEquals("ivan@utfpr.edu.br", User.normalizeEmail("IVAN@UTFPR.EDU.BR"));
        } finally {
            java.util.Locale.setDefault(original);
        }
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   ", "\t"})
    @DisplayName("normalizeEmail retorna null para vazio/nulo")
    void normalizeEmail_blank(String input) {
        assertNull(User.normalizeEmail(input));
    }

    @ParameterizedTest(name = "\"{0}\" -> \"{1}\"")
    @CsvSource(delimiter = '|', value = {
            "2343185|2343185",
            "' 2343185 '|2343185",
            "'abc123'|abc123",
    })
    @DisplayName("normalizeDocumento aplica trim e preserva o conteúdo")
    void normalizeDocumento(String input, String expected) {
        assertEquals(expected, User.normalizeDocumento(input));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   "})
    @DisplayName("normalizeDocumento converte vazio em null (não colide no índice parcial)")
    void normalizeDocumento_blank(String input) {
        assertNull(User.normalizeDocumento(input));
    }

    @Test
    @DisplayName("Callback @PrePersist/@PreUpdate normaliza e-mail e documento da entidade")
    void lifecycleCallbackNormalizesEntity() {
        User user = User.builder()
                .email("  Fulano@ALUNOS.utfpr.edu.br ")
                .documento("  2343185  ")
                .build();

        user.normalize();

        assertEquals("fulano@alunos.utfpr.edu.br", user.getEmail());
        assertEquals("2343185", user.getDocumento());
    }

    @Test
    @DisplayName("Callback converte documento em branco para null")
    void lifecycleCallbackBlankDocumento() {
        User user = User.builder().email("a@utfpr.edu.br").documento("   ").build();
        user.normalize();
        assertNull(user.getDocumento());
    }
}
