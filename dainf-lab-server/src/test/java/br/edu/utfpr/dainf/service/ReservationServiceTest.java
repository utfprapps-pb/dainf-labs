package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.Reservation;
import br.edu.utfpr.dainf.model.ReservationItem;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReservationServiceTest {

    @Mock ReservationRepository repository;
    @Mock UserService userService;
    @Mock ItemService itemService;
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

    @Test
    void save_restrictedItemForOrdinaryUser_throwsWarnException() {
        Reservation reservation = validReservation();
        Item requestedItem = new Item();
        requestedItem.setId(1L);
        reservation.setItems(new ArrayList<>(List.of(reservationItem(requestedItem))));
        Item persistedItem = new Item();
        persistedItem.setId(1L);
        persistedItem.setRestricted(true);
        when(userService.hasPrivilegedAcess()).thenReturn(false);
        when(itemService.findById(1L)).thenReturn(Optional.of(persistedItem));
        doThrow(new WarnException("Item não encontrado"))
                .when(itemService).validateVisible(List.of(persistedItem));

        assertThrows(WarnException.class, () -> reservationService.save(reservation));

        verify(repository, never()).save(any());
    }

    @Test
    void save_restrictedItemForStaff_isAccepted() {
        Reservation reservation = validReservation();
        Item restrictedItem = new Item();
        restrictedItem.setId(1L);
        restrictedItem.setRestricted(true);
        reservation.setItems(new ArrayList<>(List.of(reservationItem(restrictedItem))));
        when(userService.hasPrivilegedAcess()).thenReturn(true);
        when(repository.save(reservation)).thenReturn(reservation);

        assertDoesNotThrow(() -> reservationService.save(reservation));

        verify(itemService, never()).validateVisible(any());
        verify(repository).save(reservation);
    }

    private Reservation validReservation() {
        Reservation reservation = new Reservation();
        reservation.setReservationDate(Instant.now());
        reservation.setWithdrawalDate(Instant.now().plus(1, ChronoUnit.DAYS));
        return reservation;
    }

    private ReservationItem reservationItem(Item item) {
        ReservationItem reservationItem = new ReservationItem();
        reservationItem.setItem(item);
        return reservationItem;
    }
}
