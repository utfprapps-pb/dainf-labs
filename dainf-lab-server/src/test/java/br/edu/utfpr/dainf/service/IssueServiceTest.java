package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.model.Issue;
import br.edu.utfpr.dainf.model.IssueItem;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.IssueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IssueServiceTest {

    @Mock IssueRepository repository;
    @Mock InventoryDiffService inventoryDiffService;
    @Mock UserService userService;
    @InjectMocks IssueService issueService;

    @BeforeEach
    void injectRepository() {
        ReflectionTestUtils.setField(issueService, "repository", repository);
    }

    @Test
    void save_newIssue_callsApplyDiffWithNullEntityId() {
        Item item = item(1L);
        BigDecimal qty = new BigDecimal("3");
        Issue entity = issue(null, item, qty);

        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        issueService.save(entity);

        verify(inventoryDiffService).applyDiff(isNull(), any(), any(), eq(InventoryTransactionType.ISSUE));
    }

    @Test
    void save_updateIssue_callsApplyDiffWithEntityId() {
        Item item = item(1L);
        Issue existing = issue(1L, item, new BigDecimal("3"));
        Issue entity = issue(1L, item, new BigDecimal("7"));

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenReturn(entity);

        issueService.save(entity);

        verify(inventoryDiffService).applyDiff(eq(1L), any(), any(), eq(InventoryTransactionType.ISSUE));
    }

    @Test
    void save_updateIssue_itemNotInExisting_callsApplyDiffWithEntityId() {
        Item newItem = item(2L);
        Issue existing = issue(1L, item(1L), new BigDecimal("3"));
        Issue entity = issue(1L, newItem, new BigDecimal("5"));

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenReturn(entity);

        issueService.save(entity);

        verify(inventoryDiffService).applyDiff(eq(1L), any(), any(), eq(InventoryTransactionType.ISSUE));
    }

    @Test
    void save_handleTransactionFalse_skipsInventory() {
        Item item = item(1L);
        Issue entity = issue(null, item, new BigDecimal("3"));

        when(repository.save(any())).thenReturn(entity);

        issueService.save(entity, false);

        verifyNoInteractions(inventoryDiffService);
    }

    @Test
    void save_noItems_applyDiffCalledWithEmptyNewList() {
        Issue entity = new Issue();
        entity.setDate(Instant.now());
        entity.setItems(List.of());

        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        issueService.save(entity);

        verify(inventoryDiffService).applyDiff(any(), any(), eq(List.of()), eq(InventoryTransactionType.ISSUE));
    }

    // --- helpers ---

    private Item item(Long id) {
        Item item = new Item();
        item.setId(id);
        return item;
    }

    private IssueItem issueItem(Item item, BigDecimal qty) {
        IssueItem i = new IssueItem();
        i.setItem(item);
        i.setQuantity(qty);
        return i;
    }

    private Issue issue(Long id, Item item, BigDecimal qty) {
        Issue issue = new Issue();
        issue.setId(id);
        issue.setDate(Instant.now());
        issue.setItems(List.of(issueItem(item, qty)));
        return issue;
    }
}
