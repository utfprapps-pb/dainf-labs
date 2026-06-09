package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.enums.LoanStatus;
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
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LoanServiceTest {

    @Mock LoanRepository repository;
    @Mock InventoryService inventoryService;
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
    void save_newLoan_callsUpdateTransactionWithZeroOldQty() {
        Item item = item(1L);
        BigDecimal qty = new BigDecimal("4");
        Loan entity = loan(null, item, qty);

        when(repository.save(any())).thenReturn(entity);

        loanService.save(entity);

        verify(inventoryService).updateTransaction(item, BigDecimal.ZERO, InventoryTransactionType.LOAN, qty);
    }

    @Test
    void save_updateLoan_callsUpdateTransactionWithOldQty() {
        Item item = item(1L);
        BigDecimal oldQty = new BigDecimal("4");
        BigDecimal newQty = new BigDecimal("9");
        Loan existing = loan(1L, item, oldQty);
        existing.setBorrower(user);
        existing.setStatus(LoanStatus.COMPLETED);
        Loan entity = loan(1L, item, newQty);
        entity.setBorrower(user);
        entity.setStatus(LoanStatus.ONGOING);

        when(userService.getCurrentUser()).thenReturn(user);
        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenReturn(entity);
        when(repository.sumReturnableQuantity(1L)).thenReturn(BigDecimal.ZERO);

        loanService.save(entity);

        verify(inventoryService).updateTransaction(item, oldQty, InventoryTransactionType.LOAN, newQty);
    }

    @Test
    void save_updateLoan_itemNotInExisting_callsUpdateTransactionWithZeroOldQty() {
        Item newItem = item(2L);
        BigDecimal qty = new BigDecimal("6");
        Loan existing = loan(1L, item(1L), new BigDecimal("4"));
        existing.setBorrower(user);
        existing.setStatus(LoanStatus.COMPLETED);
        Loan entity = loan(1L, newItem, qty);
        entity.setBorrower(user);
        entity.setStatus(LoanStatus.ONGOING);

        when(userService.getCurrentUser()).thenReturn(user);
        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenReturn(entity);
        when(repository.sumReturnableQuantity(1L)).thenReturn(BigDecimal.ZERO);

        loanService.save(entity);

        verify(inventoryService).updateTransaction(newItem, BigDecimal.ZERO, InventoryTransactionType.LOAN, qty);
    }

    @Test
    void save_noItems_noInventoryInteraction() {
        Loan entity = new Loan();
        entity.setLoanDate(Instant.now());
        entity.setStatus(LoanStatus.ONGOING);
        entity.setItems(List.of());

        when(repository.save(any())).thenReturn(entity);

        loanService.save(entity);

        verifyNoInteractions(inventoryService);
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
