package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.*;
import br.edu.utfpr.dainf.repository.IssueRepository;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReturnServiceTest {

    @Mock ReturnRepository repository;
    @Mock InventoryDiffService inventoryDiffService;
    @Mock IssueRepository issueRepository;
    @Mock IssueService issueService;
    @Mock UserService userService;
    @Mock LoanService loanService;
    @InjectMocks ReturnService returnService;

    @BeforeEach
    void injectRepository() {
        ReflectionTestUtils.setField(returnService, "repository", repository);
    }

    // --- RETURN quantity (tracked via InventoryDiffService) ---

    @Test
    void save_newReturn_callsApplyDiffWithReturnType() {
        Item item = item(1L);
        Return entity = aReturn(null, item, new BigDecimal("3"), BigDecimal.ZERO);

        when(loanService.findById(any())).thenReturn(Optional.of(entity.getLoan()));
        when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());
        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        returnService.save(entity);

        verify(inventoryDiffService).applyDiff(any(), any(), any(), eq(InventoryTransactionType.RETURN));
    }

    @Test
    void save_updateReturn_callsApplyDiffWithReturnType() {
        Item item = item(1L);
        Return existing = aReturn(1L, item, new BigDecimal("2"), BigDecimal.ZERO);
        Return entity = aReturn(1L, item, new BigDecimal("5"), BigDecimal.ZERO);

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(loanService.findById(any())).thenReturn(Optional.of(entity.getLoan()));
        when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());
        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        returnService.save(entity);

        verify(inventoryDiffService).applyDiff(any(), any(), any(), eq(InventoryTransactionType.RETURN));
    }

    // --- Switching from returned to issued ---

    @Test
    void save_updateReturn_switchReturnedToIssued_applyDiffWithReturnNotIssue() {
        Item item = item(1L);
        Return existing = aReturn(1L, item, new BigDecimal("1"), BigDecimal.ZERO);
        Return entity = aReturn(1L, item, BigDecimal.ZERO, new BigDecimal("1"));

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(loanService.findById(any())).thenReturn(Optional.of(entity.getLoan()));
        when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());
        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        returnService.save(entity);

        // Only RETURN type goes through inventory diff — ISSUE is handled via Issue entity (no inventory)
        verify(inventoryDiffService).applyDiff(any(), any(), any(), eq(InventoryTransactionType.RETURN));
        verify(inventoryDiffService, never()).applyDiff(any(), any(), any(), eq(InventoryTransactionType.ISSUE));
    }

    @Test
    void save_updateReturn_switchIssuedToReturned_applyDiffWithReturnNotIssue() {
        Item item = item(1L);
        Return existing = aReturn(1L, item, BigDecimal.ZERO, new BigDecimal("1"));
        Return entity = aReturn(1L, item, new BigDecimal("1"), BigDecimal.ZERO);

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(loanService.findById(any())).thenReturn(Optional.of(entity.getLoan()));
        when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());
        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        returnService.save(entity);

        verify(inventoryDiffService).applyDiff(any(), any(), any(), eq(InventoryTransactionType.RETURN));
        verify(inventoryDiffService, never()).applyDiff(any(), any(), any(), eq(InventoryTransactionType.ISSUE));
    }

    // --- returned/issued quantity cannot exceed what was loaned ---

    @Test
    void save_returnedPlusIssuedExceedsLoanedQuantity_throwsWarnException() {
        Item item = item(1L);
        Loan loan = loanWithItem(10L, item, new BigDecimal("5"));
        Return entity = new Return();
        entity.setReturnDate(Instant.now());
        entity.setLoan(loan);
        entity.setItems(new ArrayList<>(List.of(returnItem(item, new BigDecimal("3"), new BigDecimal("3")))));

        when(loanService.findById(10L)).thenReturn(Optional.of(loan));

        assertThrows(WarnException.class, () -> returnService.save(entity));

        verify(repository, never()).save(any());
    }

    @Test
    void save_returnedPlusIssuedEqualsLoanedQuantity_doesNotThrow() {
        Item item = item(1L);
        Loan loan = loanWithItem(11L, item, new BigDecimal("5"));
        Return entity = new Return();
        entity.setReturnDate(Instant.now());
        entity.setLoan(loan);
        entity.setItems(new ArrayList<>(List.of(returnItem(item, new BigDecimal("2"), new BigDecimal("3")))));

        when(loanService.findById(11L)).thenReturn(Optional.of(loan));
        when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());
        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        assertDoesNotThrow(() -> returnService.save(entity));

        verify(repository).save(any());
    }

    // --- helpers ---

    private Item item(Long id) {
        Item item = new Item();
        item.setId(id);
        return item;
    }

    private Loan loan(Long id) {
        Loan loan = new Loan();
        loan.setId(id);
        return loan;
    }

    private Loan loanWithItem(Long id, Item item, BigDecimal quantity) {
        Loan loan = new Loan();
        loan.setId(id);
        LoanItem loanItem = new LoanItem();
        loanItem.setItem(item);
        loanItem.setQuantity(quantity);
        loan.setItems(new ArrayList<>(List.of(loanItem)));
        return loan;
    }

    private ReturnItem returnItem(Item item, BigDecimal quantityReturned, BigDecimal quantityIssued) {
        ReturnItem ri = new ReturnItem();
        ri.setItem(item);
        ri.setQuantityReturned(quantityReturned);
        ri.setQuantityIssued(quantityIssued);
        return ri;
    }

    private Return aReturn(Long id, Item item, BigDecimal quantityReturned, BigDecimal quantityIssued) {
        Return r = new Return();
        r.setId(id);
        r.setReturnDate(Instant.now());
        r.setLoan(loan(id != null ? id : 99L));
        r.setItems(new ArrayList<>(List.of(returnItem(item, quantityReturned, quantityIssued))));
        return r;
    }
}
