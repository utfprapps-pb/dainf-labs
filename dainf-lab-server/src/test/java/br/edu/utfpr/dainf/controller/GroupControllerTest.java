package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.GroupDTO;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Você não tem permissão para realizar essa ação."));
    }

    @Test
    void laboratoryTechnicianCanLinkUsersToGroup() throws Exception {
        String location = mockMvc.perform(post("/groups")
                        .with(user("technician").roles("LAB_TECHNICIAN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(asJson(createValidObject())))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long groupId = Long.parseLong(location.trim());

        mockMvc.perform(put("/groups/" + groupId + "/users")
                        .with(user("technician").roles("LAB_TECHNICIAN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[]"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/groups/" + groupId + "/users")
                        .with(user("technician").roles("LAB_TECHNICIAN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void ordinaryUserCannotLinkUsersToGroup() throws Exception {
        mockMvc.perform(put("/groups/1/users")
                        .with(user("student").roles("STUDENT"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[]"))
                .andExpect(status().isForbidden());
    }
}
