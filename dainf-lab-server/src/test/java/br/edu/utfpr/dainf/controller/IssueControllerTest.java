package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.IssueDTO;
import br.edu.utfpr.dainf.dto.IssueItemDTO;
import br.edu.utfpr.dainf.dto.ItemDTO;
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

class IssueControllerTest extends CrudControllerTest<IssueDTO> {

    @Inject
    UserRepository userRepository;

    private User adminUser;

    @BeforeEach
    protected void setUp() {
        adminUser = userRepository.findByEmail("admin@issue-test.com").orElseGet(() -> {
            User user = User.builder()
                    .email("admin@issue-test.com")
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
        return "/issues";
    }

    @Override
    protected IssueDTO createValidObject() {
        return IssueDTO.builder()
                .date(Instant.now())
                .observation("Teste")
                .items(List.of())
                .build();
    }

    @Override
    protected IssueDTO createInvalidObject() {
        return new IssueDTO();
    }

    @Override
    protected void onBeforeUpdate(IssueDTO dto) {
        dto.setObservation("Teste update");
    }

    @Test
    void createWithNullDate_returns400() throws Exception {
        IssueDTO dto = IssueDTO.builder()
                .items(List.of())
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullItems_returns400() throws Exception {
        IssueDTO dto = IssueDTO.builder()
                .date(Instant.now())
                .items(null)
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithItemHavingNullQuantity_returns400() throws Exception {
        IssueItemDTO invalidItem = IssueItemDTO.builder()
                .item(ItemDTO.builder().id(1L).build())
                .quantity(null)
                .build();
        IssueDTO dto = IssueDTO.builder()
                .date(Instant.now())
                .items(List.of(invalidItem))
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithItemHavingZeroQuantity_returns400() throws Exception {
        IssueItemDTO invalidItem = IssueItemDTO.builder()
                .item(ItemDTO.builder().id(1L).build())
                .quantity(BigDecimal.ZERO)
                .build();
        IssueDTO dto = IssueDTO.builder()
                .date(Instant.now())
                .items(List.of(invalidItem))
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithItemHavingNullItem_returns400() throws Exception {
        IssueItemDTO invalidItem = IssueItemDTO.builder()
                .item(null)
                .quantity(BigDecimal.ONE)
                .build();
        IssueDTO dto = IssueDTO.builder()
                .date(Instant.now())
                .items(List.of(invalidItem))
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }
}
