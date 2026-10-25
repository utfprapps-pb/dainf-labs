package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.GroupDTO;
import br.edu.utfpr.dainf.dto.UserDTO;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.Group;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.GroupRepository;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Set;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserControllerTest extends CrudControllerTest<UserDTO> {

    @Inject
    GroupRepository groupRepository;

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

    @Test
    void ordinaryUserCannotUpdateOwnGroups() throws Exception {
        Long userId = createResource();
        UserDTO dto = createValidObject();
        dto.setId(userId);
        dto.setGroups(Set.of());
        User student = new User();
        student.setId(userId);
        student.setEmail(dto.getEmail());
        student.setRole(UserRole.ROLE_STUDENT);
        student.setEnabled(true);

        mockMvc.perform(put("/users/" + userId)
                        .with(user(student))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(asJson(dto)))
                .andExpect(status().isForbidden());
    }

    @Test
    void staffCanAssignGroupsAndReadTheirIdAndName() throws Exception {
        Group group = new Group();
        group.setName("Grupo " + System.nanoTime());
        group.setActive(true);
        group = groupRepository.save(group);
        Long userId = createResource();
        UserDTO dto = createValidObject();
        dto.setId(userId);
        dto.setGroups(Set.of(GroupDTO.builder()
                .id(group.getId())
                .name(group.getName())
                .active(true)
                .build()));

        mockMvc.perform(put("/users/" + userId)
                        .with(user("technician").roles("LAB_TECHNICIAN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(asJson(dto)))
                .andExpect(status().isOk());

        performFindOne(userId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.groups[0].id").value(group.getId()))
                .andExpect(jsonPath("$.groups[0].name").value(group.getName()));
    }
}
