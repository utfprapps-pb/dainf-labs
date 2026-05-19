package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.IssueDTO;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.UserRepository;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.time.Instant;
import java.util.List;

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
}
