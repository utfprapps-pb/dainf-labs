package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Reservation;
import br.edu.utfpr.dainf.repository.ReservationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReservationServiceTest {

    @Mock ReservationRepository repository;
    @Mock UserService userService;
    @InjectMocks ReservationService reservationService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(reservationService, "repository", repository);
    }

    @Test
    void save_withdrawalDateBeforeReservationDate_throwsWarnException() {
        Reservation entity = new Reservation();
        entity.setReservationDate(Instant.now());
        entity.setWithdrawalDate(Instant.now().minus(1, ChronoUnit.DAYS));

        assertThrows(WarnException.class, () -> reservationService.save(entity));

        verify(repository, never()).save(any());
    }

    @Test
    void save_withdrawalDateEqualsReservationDate_doesNotThrow() {
        Instant now = Instant.now();
        Reservation entity = new Reservation();
        entity.setReservationDate(now);
        entity.setWithdrawalDate(now);

        when(repository.save(any())).thenReturn(entity);

        assertDoesNotThrow(() -> reservationService.save(entity));
    }

    @Test
    void save_withdrawalDateAfterReservationDate_doesNotThrow() {
        Instant now = Instant.now();
        Reservation entity = new Reservation();
        entity.setReservationDate(now);
        entity.setWithdrawalDate(now.plus(3, ChronoUnit.DAYS));

        when(repository.save(any())).thenReturn(entity);

        assertDoesNotThrow(() -> reservationService.save(entity));
    }
}
