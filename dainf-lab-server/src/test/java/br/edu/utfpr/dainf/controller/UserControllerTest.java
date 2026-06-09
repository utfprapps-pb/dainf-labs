package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.UserDTO;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import org.junit.jupiter.api.Test;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserControllerTest extends CrudControllerTest<UserDTO> {

    @Override
    protected String getURL() {
        return "/users";
    }

    @Override
    protected UserDTO createValidObject() {
        Integer random = (int) (Math.random() * 10000);
        return UserDTO.builder()
                .email(random + "@utfpr.edu.br")
                .password("Teste123456!")
                .nome("teste")
                .documento("odfdso")
                .telefone("teste")
                .fotoUrl("teste")
                .emailVerificado(false)
                .build();
    }

    @Override
    protected UserDTO createInvalidObject() {
        return UserDTO.builder()
                .email("testecom")
                .password("teste")
                .nome("teste")
                .documento("teste")
                .telefone("teste")
                .fotoUrl("teste")
                .emailVerificado(false)
                .build();
    }

    @Override
    protected void onBeforeUpdate(UserDTO dto) {
        dto.setPassword("Teste123456!@");
    }

    @Test
    void updateWithoutChangingPassword() throws Exception {
        Long createdId = createResource();
        UserDTO dto = createValidObject();
        dto.setId(createdId);
        dto.setPassword(null);

        performUpdate(createdId, dto).andExpect(status().isOk());
    }

    @Test
    void createWithNonUtfprEmail_returns400() throws Exception {
        UserDTO dto = UserDTO.builder()
                .email("usuario@gmail.com")
                .password("Teste123456!")
                .nome("Teste")
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithWeakPassword_returns400() throws Exception {
        UserDTO dto = UserDTO.builder()
                .email("usuario@utfpr.edu.br")
                .password("semMaiuscula1")
                .nome("Teste")
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithInvalidEmailFormat_returns400() throws Exception {
        UserDTO dto = UserDTO.builder()
                .email("emailsemarroba")
                .password("Teste123!")
                .nome("Teste")
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }
}
