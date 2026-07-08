package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.enums.LoanStatus;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.Loan;
import br.edu.utfpr.dainf.model.LoanItem;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.LoanRepository;
import br.edu.utfpr.dainf.repository.ReturnRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoanServiceTest {

    @Mock LoanRepository repository;
    @Mock InventoryDiffService inventoryDiffService;
    @Mock UserService userService;
    @Mock ReturnRepository returnRepository;
    @Mock LoanMailService loanMailService;
    @InjectMocks LoanService loanService;

    private User user;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(loanService, "repository", repository);
        user = new User();
        user.setId(1L);
    }

    @Test
    void save_newLoan_callsApplyDiffWithNullEntityId() {
        Item item = item(1L);
        BigDecimal qty = new BigDecimal("4");
        Loan entity = loan(null, item, qty);

        when(repository.save(any())).thenReturn(entity);

        loanService.save(entity);

        verify(inventoryDiffService).applyDiff(isNull(), any(), any(), eq(InventoryTransactionType.LOAN));
    }

    @Test
    void save_updateLoan_callsApplyDiffWithEntityId() {
        Item item = item(1L);
        Loan existing = loan(1L, item, new BigDecimal("4"));
        existing.setBorrower(user);
        existing.setStatus(LoanStatus.COMPLETED);
        Loan entity = loan(1L, item, new BigDecimal("9"));
        entity.setBorrower(user);
        entity.setStatus(LoanStatus.ONGOING);

        when(userService.getCurrentUser()).thenReturn(user);
        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenReturn(entity);
        when(repository.sumReturnableQuantity(1L)).thenReturn(BigDecimal.ZERO);

        loanService.save(entity);

        verify(inventoryDiffService).applyDiff(eq(1L), any(), any(), eq(InventoryTransactionType.LOAN));
    }

    @Test
    void save_updateLoan_itemNotInExisting_callsApplyDiffWithEntityId() {
        Item newItem = item(2L);
        Loan existing = loan(1L, item(1L), new BigDecimal("4"));
        existing.setBorrower(user);
        existing.setStatus(LoanStatus.COMPLETED);
        Loan entity = loan(1L, newItem, new BigDecimal("6"));
        entity.setBorrower(user);
        entity.setStatus(LoanStatus.ONGOING);

        when(userService.getCurrentUser()).thenReturn(user);
        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenReturn(entity);
        when(repository.sumReturnableQuantity(1L)).thenReturn(BigDecimal.ZERO);

        loanService.save(entity);

        verify(inventoryDiffService).applyDiff(eq(1L), any(), any(), eq(InventoryTransactionType.LOAN));
    }

    @Test
    void save_noItems_applyDiffCalledWithEmptyNewList() {
        Loan entity = new Loan();
        entity.setLoanDate(Instant.now());
        entity.setStatus(LoanStatus.ONGOING);
        entity.setItems(List.of());

        when(repository.save(any())).thenReturn(entity);

        loanService.save(entity);

        verify(inventoryDiffService).applyDiff(any(), any(), eq(List.of()), eq(InventoryTransactionType.LOAN));
    }

    // --- deadline vs loanDate ordering ---

    @Test
    void save_deadlineBeforeLoanDate_throwsWarnException() {
        Loan entity = new Loan();
        entity.setLoanDate(Instant.now());
        entity.setDeadline(Instant.now().minus(1, ChronoUnit.DAYS));
        entity.setItems(List.of());

        assertThrows(WarnException.class, () -> loanService.save(entity));

        verify(repository, never()).save(any());
    }

    @Test
    void save_deadlineEqualsLoanDate_doesNotThrow() {
        Instant now = Instant.now();
        Loan entity = new Loan();
        entity.setLoanDate(now);
        entity.setDeadline(now);
        entity.setItems(List.of());

        when(repository.save(any())).thenReturn(entity);

        assertDoesNotThrow(() -> loanService.save(entity));
    }

    @Test
    void save_deadlineAfterLoanDate_doesNotThrow() {
        Instant now = Instant.now();
        Loan entity = new Loan();
        entity.setLoanDate(now);
        entity.setDeadline(now.plus(7, ChronoUnit.DAYS));
        entity.setItems(List.of());

        when(repository.save(any())).thenReturn(entity);

        assertDoesNotThrow(() -> loanService.save(entity));
    }

    // --- refreshStatus / deadline status resolution ---

    private static final ZoneId LOAN_ZONE = ZoneId.of("America/Sao_Paulo");

    @Test
    void refreshStatus_deadlineToday_keepsLoanOngoing() {
        Instant deadlineToday = LocalDate.now(LOAN_ZONE).atStartOfDay(LOAN_ZONE).toInstant();
        Loan persisted = loanWithDeadline(1L, deadlineToday, LoanStatus.ONGOING);
        stubPendingReturn(persisted);

        Loan result = loanService.refreshStatus(persisted);

        assertEquals(LoanStatus.ONGOING, result.getStatus());
        verify(repository, never()).save(any());
    }

    @Test
    void refreshStatus_deadlineTomorrow_keepsLoanOngoing() {
        Instant deadlineTomorrow = LocalDate.now(LOAN_ZONE).plusDays(1).atStartOfDay(LOAN_ZONE).toInstant();
        Loan persisted = loanWithDeadline(1L, deadlineTomorrow, LoanStatus.ONGOING);
        stubPendingReturn(persisted);

        Loan result = loanService.refreshStatus(persisted);

        assertEquals(LoanStatus.ONGOING, result.getStatus());
        verify(repository, never()).save(any());
    }

    @Test
    void refreshStatus_deadlineYesterday_marksLoanOverdue() {
        Instant deadlineYesterday = LocalDate.now(LOAN_ZONE).minusDays(1).atStartOfDay(LOAN_ZONE).toInstant();
        Loan persisted = loanWithDeadline(1L, deadlineYesterday, LoanStatus.ONGOING);
        stubPendingReturn(persisted);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Loan result = loanService.refreshStatus(persisted);

        assertEquals(LoanStatus.OVERDUE, result.getStatus());
        verify(loanMailService).sendLoanOverdue(1L);
    }

    @Test
    void refreshStatus_noItemsToReturn_marksLoanCompleted() {
        Loan persisted = loanWithDeadline(1L, null, LoanStatus.ONGOING);
        when(repository.findById(1L)).thenReturn(Optional.of(persisted));
        when(repository.sumReturnableQuantity(1L)).thenReturn(BigDecimal.ZERO);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Loan result = loanService.refreshStatus(persisted);

        assertEquals(LoanStatus.COMPLETED, result.getStatus());
        verify(loanMailService).sendLoanCompleted(1L);
    }

    @Test
    void refreshStatus_returnedAndIssuedBelowExpected_keepsLoanOngoing() {
        Loan persisted = loanWithDeadline(1L, null, LoanStatus.ONGOING);
        when(repository.findById(1L)).thenReturn(Optional.of(persisted));
        when(repository.sumReturnableQuantity(1L)).thenReturn(new BigDecimal("10"));
        when(returnRepository.sumQuantityReturnedByLoan(1L)).thenReturn(new BigDecimal("4"));
        when(returnRepository.sumQuantityIssuedByLoan(1L)).thenReturn(new BigDecimal("3"));

        Loan result = loanService.refreshStatus(persisted);

        assertEquals(LoanStatus.ONGOING, result.getStatus());
        verify(repository, never()).save(any());
        verify(loanMailService, never()).sendLoanCompleted(any());
    }

    @Test
    void refreshStatus_returnedAndIssuedMatchExpected_marksLoanCompleted() {
        Loan persisted = loanWithDeadline(1L, null, LoanStatus.ONGOING);
        when(repository.findById(1L)).thenReturn(Optional.of(persisted));
        when(repository.sumReturnableQuantity(1L)).thenReturn(new BigDecimal("10"));
        when(returnRepository.sumQuantityReturnedByLoan(1L)).thenReturn(new BigDecimal("6"));
        when(returnRepository.sumQuantityIssuedByLoan(1L)).thenReturn(new BigDecimal("4"));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Loan result = loanService.refreshStatus(persisted);

        assertEquals(LoanStatus.COMPLETED, result.getStatus());
        verify(loanMailService).sendLoanCompleted(1L);
    }

    @Test
    void refreshStatus_fullyReturnedWithNoneIssued_marksLoanCompleted() {
        Loan persisted = loanWithDeadline(1L, null, LoanStatus.ONGOING);
        when(repository.findById(1L)).thenReturn(Optional.of(persisted));
        when(repository.sumReturnableQuantity(1L)).thenReturn(new BigDecimal("10"));
        when(returnRepository.sumQuantityReturnedByLoan(1L)).thenReturn(new BigDecimal("10"));
        when(returnRepository.sumQuantityIssuedByLoan(1L)).thenReturn(BigDecimal.ZERO);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Loan result = loanService.refreshStatus(persisted);

        assertEquals(LoanStatus.COMPLETED, result.getStatus());
    }

    @Test
    void refreshStatus_fullyIssuedWithNoneReturned_marksLoanCompleted() {
        Loan persisted = loanWithDeadline(1L, null, LoanStatus.ONGOING);
        when(repository.findById(1L)).thenReturn(Optional.of(persisted));
        when(repository.sumReturnableQuantity(1L)).thenReturn(new BigDecimal("10"));
        when(returnRepository.sumQuantityReturnedByLoan(1L)).thenReturn(BigDecimal.ZERO);
        when(returnRepository.sumQuantityIssuedByLoan(1L)).thenReturn(new BigDecimal("10"));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Loan result = loanService.refreshStatus(persisted);

        assertEquals(LoanStatus.COMPLETED, result.getStatus());
    }

    private Loan loanWithDeadline(Long id, Instant deadline, LoanStatus status) {
        Loan loan = new Loan();
        loan.setId(id);
        loan.setLoanDate(Instant.now());
        loan.setDeadline(deadline);
        loan.setStatus(status);
        loan.setBorrower(user);
        return loan;
    }

    private void stubPendingReturn(Loan persisted) {
        when(repository.findById(persisted.getId())).thenReturn(Optional.of(persisted));
        when(repository.sumReturnableQuantity(persisted.getId())).thenReturn(new BigDecimal("1"));
        when(returnRepository.sumQuantityReturnedByLoan(persisted.getId())).thenReturn(BigDecimal.ZERO);
        when(returnRepository.sumQuantityIssuedByLoan(persisted.getId())).thenReturn(BigDecimal.ZERO);
    }

    // --- helpers ---

    private Item item(Long id) {
        Item item = new Item();
        item.setId(id);
        return item;
    }

    private LoanItem loanItem(Item item, BigDecimal qty) {
        LoanItem i = new LoanItem();
        i.setItem(item);
        i.setQuantity(qty);
        i.setShouldReturn(false);
        return i;
    }

    private Loan loan(Long id, Item item, BigDecimal qty) {
        Loan loan = new Loan();
        loan.setId(id);
        loan.setLoanDate(Instant.now());
        loan.setItems(List.of(loanItem(item, qty)));
        return loan;
    }
}
