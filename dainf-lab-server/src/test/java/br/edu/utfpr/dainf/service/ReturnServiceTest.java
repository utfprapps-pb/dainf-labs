package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReturnServiceTest {

    @Mock ReturnRepository repository;
    @Mock InventoryService inventoryService;
    @Mock IssueRepository issueRepository;
    @Mock IssueService issueService;
    @Mock UserService userService;
    @Mock LoanService loanService;
    @InjectMocks ReturnService returnService;

    @BeforeEach
    void injectRepository() {
        ReflectionTestUtils.setField(returnService, "repository", repository);
    }

    // --- RETURN quantity ---

    @Test
    void save_newReturn_callsUpdateTransactionWithZeroOldQtyForReturned() {
        Item item = item(1L);
        BigDecimal qty = new BigDecimal("3");
        Return entity = aReturn(null, item, qty, BigDecimal.ZERO);

        when(loanService.findById(any())).thenReturn(Optional.of(entity.getLoan()));
        when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());
        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        returnService.save(entity);

        verify(inventoryService).updateTransaction(item, BigDecimal.ZERO, InventoryTransactionType.RETURN, qty);
    }

    @Test
    void save_updateReturn_callsUpdateTransactionWithOldQtyForReturned() {
        Item item = item(1L);
        BigDecimal oldQty = new BigDecimal("2");
        BigDecimal newQty = new BigDecimal("5");
        Return existing = aReturn(1L, item, oldQty, BigDecimal.ZERO);
        Return entity = aReturn(1L, item, newQty, BigDecimal.ZERO);

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(loanService.findById(any())).thenReturn(Optional.of(entity.getLoan()));
        when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());
        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        returnService.save(entity);

        verify(inventoryService).updateTransaction(item, oldQty, InventoryTransactionType.RETURN, newQty);
    }

    // --- ISSUE quantity ---

    @Test
    void save_newReturn_callsUpdateTransactionWithZeroOldQtyForIssued() {
        Item item = item(1L);
        BigDecimal qty = new BigDecimal("2");
        Return entity = aReturn(null, item, BigDecimal.ZERO, qty);

        when(loanService.findById(any())).thenReturn(Optional.of(entity.getLoan()));
        when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());
        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        returnService.save(entity);

        verify(inventoryService).updateTransaction(item, BigDecimal.ZERO, InventoryTransactionType.ISSUE, qty);
    }

    @Test
    void save_updateReturn_callsUpdateTransactionWithOldQtyForIssued() {
        Item item = item(1L);
        BigDecimal oldQty = new BigDecimal("1");
        BigDecimal newQty = new BigDecimal("4");
        Return existing = aReturn(1L, item, BigDecimal.ZERO, oldQty);
        Return entity = aReturn(1L, item, BigDecimal.ZERO, newQty);

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(loanService.findById(any())).thenReturn(Optional.of(entity.getLoan()));
        when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());
        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        returnService.save(entity);

        verify(inventoryService).updateTransaction(item, oldQty, InventoryTransactionType.ISSUE, newQty);
    }

    // --- Switching from returned to issued ---

    @Test
    void save_updateReturn_switchReturnedToIssued_recalculatesBothTransactions() {
        Item item = item(1L);
        // First save: returned=1, issued=0
        Return existing = aReturn(1L, item, new BigDecimal("1"), BigDecimal.ZERO);
        // Update: returned=0, issued=1
        Return entity = aReturn(1L, item, BigDecimal.ZERO, new BigDecimal("1"));

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(loanService.findById(any())).thenReturn(Optional.of(entity.getLoan()));
        when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());
        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        returnService.save(entity);

        // Old RETURN of 1 should be undone (new qty=0)
        verify(inventoryService).updateTransaction(item, new BigDecimal("1"), InventoryTransactionType.RETURN, BigDecimal.ZERO);
        // New ISSUE of 1 should be applied (old qty=0)
        verify(inventoryService).updateTransaction(item, BigDecimal.ZERO, InventoryTransactionType.ISSUE, new BigDecimal("1"));
    }

    @Test
    void save_updateReturn_switchIssuedToReturned_recalculatesBothTransactions() {
        Item item = item(1L);
        // First save: returned=0, issued=1
        Return existing = aReturn(1L, item, BigDecimal.ZERO, new BigDecimal("1"));
        // Update: returned=1, issued=0
        Return entity = aReturn(1L, item, new BigDecimal("1"), BigDecimal.ZERO);

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(loanService.findById(any())).thenReturn(Optional.of(entity.getLoan()));
        when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());
        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        returnService.save(entity);

        // New RETURN of 1 should be applied (old qty=0)
        verify(inventoryService).updateTransaction(item, BigDecimal.ZERO, InventoryTransactionType.RETURN, new BigDecimal("1"));
        // Old ISSUE of 1 should be undone (new qty=0)
        verify(inventoryService).updateTransaction(item, new BigDecimal("1"), InventoryTransactionType.ISSUE, BigDecimal.ZERO);
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
