package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.ItemDTO;
import br.edu.utfpr.dainf.dto.ReservationDTO;
import br.edu.utfpr.dainf.dto.ReservationItemDTO;
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
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

    @Test
    void createWithNullReservationDate_returns400() throws Exception {
        ReservationDTO dto = ReservationDTO.builder()
                .withdrawalDate(Instant.now())
                .items(List.of())
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullWithdrawalDate_returns400() throws Exception {
        ReservationDTO dto = ReservationDTO.builder()
                .reservationDate(Instant.now())
                .items(List.of())
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullItems_returns400() throws Exception {
        ReservationDTO dto = ReservationDTO.builder()
                .reservationDate(Instant.now())
                .withdrawalDate(Instant.now())
                .items(null)
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithItemHavingNullQuantity_returns400() throws Exception {
        ReservationItemDTO invalidItem = ReservationItemDTO.builder()
                .item(ItemDTO.builder().id(1L).build())
                .quantity(null)
                .build();
        ReservationDTO dto = ReservationDTO.builder()
                .reservationDate(Instant.now())
                .withdrawalDate(Instant.now())
                .items(List.of(invalidItem))
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithItemHavingNullItem_returns400() throws Exception {
        ReservationItemDTO invalidItem = ReservationItemDTO.builder()
                .item(null)
                .quantity(BigDecimal.ONE)
                .build();
        ReservationDTO dto = ReservationDTO.builder()
                .reservationDate(Instant.now())
                .withdrawalDate(Instant.now())
                .items(List.of(invalidItem))
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithWithdrawalDateBeforeReservationDate_returns400() throws Exception {
        ReservationDTO dto = ReservationDTO.builder()
                .reservationDate(Instant.now())
                .withdrawalDate(Instant.now().minus(1, ChronoUnit.DAYS))
                .items(List.of())
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }
}
