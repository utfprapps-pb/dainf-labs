package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.ReservationDTO;
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

class ReservationControllerTest extends CrudControllerTest<ReservationDTO> {

    @Inject
    UserRepository userRepository;

    private User adminUser;

    @BeforeEach
    protected void setUp() {
        adminUser = userRepository.findByEmail("admin@reservation-test.com").orElseGet(() -> {
            User user = User.builder()
                    .email("admin@reservation-test.com")
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
        return "/reservations";
    }

    @Override
    protected ReservationDTO createValidObject() {
        return ReservationDTO.builder()
                .reservationDate(Instant.now())
                .withdrawalDate(Instant.now())
                .description("Teste")
                .observation("Teste")
                .items(List.of())
                .build();
    }

    @Override
    protected ReservationDTO createInvalidObject() {
        return new ReservationDTO();
    }

    @Override
    protected void onBeforeUpdate(ReservationDTO dto) {
        dto.setDescription("Teste update");
    }
}
