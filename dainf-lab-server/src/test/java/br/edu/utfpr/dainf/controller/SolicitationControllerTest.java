package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.ItemDTO;
import br.edu.utfpr.dainf.dto.SolicitationDTO;
import br.edu.utfpr.dainf.dto.SolicitationItemDTO;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.UserRepository;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SolicitationControllerTest extends CrudControllerTest<SolicitationDTO> {

    @Inject
    UserRepository userRepository;

    private User adminUser;

    @BeforeEach
    protected void setUp() {
        adminUser = userRepository.findByEmail("admin@solicitation-test.com").orElseGet(() -> {
            User user = User.builder()
                    .email("admin@solicitation-test.com")
                    .password("Admin1")
                    .nome("Admin Test")
                    .telefone("46999999999")
                    .role(UserRole.valueOf(UserRole.ADMIN))
                    .enabled(true)
                    .build();
            return userRepository.save(user);
        });
    }

    @Override
    protected RequestPostProcessor auth() {
        return SecurityMockMvcRequestPostProcessors.user(adminUser);
    }

    @Override
    protected String getURL() {
        return "/solicitations";
    }

    @Override
    protected SolicitationDTO createValidObject() {
        return SolicitationDTO.builder()
                .observation("Test Justification")
                .date(Instant.now())
                .items(List.of())
                .build();
    }

    @Override
    protected SolicitationDTO createInvalidObject() {
        return new SolicitationDTO();
    }

    @Override
    protected void onBeforeUpdate(SolicitationDTO dto) {
        dto.setObservation("Updated Test Justification");
    }

    @Test
    void createWithNullDate_returns400() throws Exception {
        SolicitationDTO dto = SolicitationDTO.builder()
                .observation("Test")
                .items(List.of())
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullItems_returns400() throws Exception {
        SolicitationDTO dto = SolicitationDTO.builder()
                .date(Instant.now())
                .items(null)
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithItemHavingNullQuantity_returns400() throws Exception {
        SolicitationItemDTO invalidItem = SolicitationItemDTO.builder()
                .item(ItemDTO.builder().id(1L).build())
                .quantity(null)
                .build();
        SolicitationDTO dto = SolicitationDTO.builder()
                .date(Instant.now())
                .items(List.of(invalidItem))
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithItemHavingNullItem_returns400() throws Exception {
        SolicitationItemDTO invalidItem = SolicitationItemDTO.builder()
                .item(null)
                .quantity(BigDecimal.ONE)
                .build();
        SolicitationDTO dto = SolicitationDTO.builder()
                .date(Instant.now())
                .items(List.of(invalidItem))
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }
}
