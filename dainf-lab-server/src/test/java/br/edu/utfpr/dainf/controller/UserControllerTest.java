package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.UserDTO;
import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import org.junit.jupiter.api.Test;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
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
                .email(random + "teste@mail.com")
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
    void labTechnicianCanSearchUsers() throws Exception {
        RequestPostProcessor labTechAuth = SecurityMockMvcRequestPostProcessors.user("lab").roles("LAB_TECHNICIAN");
        performSearch(createSearchRequest(), labTechAuth).andExpect(status().isOk());
    }

    private org.springframework.test.web.servlet.ResultActions performSearch(SearchRequest request, RequestPostProcessor auth) throws Exception {
        return mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(getURL() + "/search")
                .with(auth)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content(asJson(request)));
    }
}
