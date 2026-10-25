package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.GroupDTO;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GroupControllerTest extends CrudControllerTest<GroupDTO> {

    @Override
    protected String getURL() {
        return "/groups";
    }

    @Override
    protected GroupDTO createValidObject() {
        return GroupDTO.builder()
                .name("Grupo " + System.nanoTime())
                .description("Grupo de teste")
                .active(true)
                .build();
    }

    @Override
    protected GroupDTO createInvalidObject() {
        return GroupDTO.builder().name(" ").build();
    }

    @Override
    protected void onBeforeUpdate(GroupDTO dto) {
        dto.setDescription("Descrição alterada");
    }

    @Test
    void laboratoryTechnicianCanCreateGroup() throws Exception {
        mockMvc.perform(post("/groups")
                        .with(user("technician").roles("LAB_TECHNICIAN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(asJson(createValidObject())))
                .andExpect(status().isCreated());
    }

    @Test
    void ordinaryUserCannotManageGroups() throws Exception {
        mockMvc.perform(post("/groups")
                        .with(user("student").roles("STUDENT"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(asJson(createValidObject())))
                .andExpect(status().isForbidden());
    }
}
