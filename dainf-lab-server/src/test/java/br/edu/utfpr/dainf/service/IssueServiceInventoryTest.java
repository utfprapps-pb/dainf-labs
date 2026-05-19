package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.exception.InvalidTransactionException;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.inventory.auditor.TransactionAuditor;
import br.edu.utfpr.dainf.model.*;
import br.edu.utfpr.dainf.repository.InventoryRepository;
import br.edu.utfpr.dainf.repository.IssueRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests for IssueService that verify actual inventory quantity changes.
 * Uses a real InventoryService with a stateful in-memory store.
 */
@ExtendWith(MockitoExtension.class)
class IssueServiceInventoryTest {

    @Mock IssueRepository issueRepository;
    @Mock InventoryRepository inventoryRepository;
    @Mock ConfigurationService configurationService;
    @Mock TransactionAuditor auditor;
    @Mock UserService userService;

    InventoryService inventoryService;
    IssueService issueService;

    final Map<Long, Inventory> store = new HashMap<>();
    long idSeq = 1;

    @BeforeEach
    void setUp() {
        store.clear();
        idSeq = 1;

        inventoryService = new InventoryService(auditor, configurationService);
        ReflectionTestUtils.setField(inventoryService, "repository", inventoryRepository);

        issueService = new IssueService(inventoryService, userService);
        ReflectionTestUtils.setField(issueService, "repository", issueRepository);

        lenient().when(inventoryRepository.findByItem(any())).thenAnswer(inv -> {
            Item it = inv.getArgument(0);
            return Optional.ofNullable(store.get(it.getId()));
        });
        lenient().when(inventoryRepository.save(any())).thenAnswer(inv -> {
            Inventory saved = inv.getArgument(0);
            store.put(saved.getItem().getId(), saved);
            return saved;
        });
        lenient().when(configurationService.get()).thenReturn(new Configuration());
        lenient().when(userService.getCurrentUser()).thenReturn(new User());
        lenient().when(issueRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    // --- helpers ---

    Item item() {
        Item i = new Item();
        i.setId(idSeq++);
        return i;
    }

    void givenStock(Item item, String qty) {
        store.put(item.getId(), new Inventory(item, new BigDecimal(qty)));
    }

    BigDecimal stockOf(Item item) {
        Inventory inv = store.get(item.getId());
        return inv != null ? inv.getQuantity() : BigDecimal.ZERO;
    }

    Issue newIssue(IssueItem... items) {
        Issue issue = new Issue();
        issue.setDate(Instant.now());
        issue.setItems(new ArrayList<>(List.of(items)));
        return issue;
    }

    Issue existingIssue(Long id, IssueItem... items) {
        Issue issue = newIssue(items);
        issue.setId(id);
        return issue;
    }

    IssueItem ii(Item item, String qty) {
        IssueItem ii = new IssueItem();
        ii.setItem(item);
        ii.setQuantity(new BigDecimal(qty));
        return ii;
    }

    static BigDecimal bd(String v) { return new BigDecimal(v); }

    // =========================================================================
    // New issue (id = null)
    // =========================================================================

    @Nested
    class NewIssue {

        @Test
        void singleItem_stockReduced() {
            Item item = item();
            givenStock(item, "50");
            issueService.save(newIssue(ii(item, "10")));
            assertEquals(bd("40"), stockOf(item));
        }

        @Test
        void multipleItems_eachStockReducedIndependently() {
            Item a = item(), b = item(), c = item();
            givenStock(a, "30");
            givenStock(b, "20");
            givenStock(c, "10");
            issueService.save(newIssue(ii(a, "5"), ii(b, "8"), ii(c, "3")));
            assertEquals(bd("25"), stockOf(a));
            assertEquals(bd("12"), stockOf(b));
            assertEquals(bd("7"),  stockOf(c));
        }

        @Test
        void exactlyExhaustsStock_stockReachesZero() {
            Item item = item();
            givenStock(item, "15");
            issueService.save(newIssue(ii(item, "15")));
            assertEquals(bd("0"), stockOf(item));
        }

        @Test
        void exceedsAvailableStock_throwsException_stockUnchanged() {
            Item item = item();
            givenStock(item, "5");
            assertThrows(InvalidTransactionException.class,
                    () -> issueService.save(newIssue(ii(item, "10"))));
            assertEquals(bd("5"), stockOf(item));
        }

        @Test
        void emptyItemsList_noInventoryInteraction() {
            Issue issue = new Issue();
            issue.setDate(Instant.now());
            issue.setItems(List.of());
            issueService.save(issue);
            verifyNoInteractions(inventoryRepository);
        }

        @Test
        void sequentialIssues_stockDrainsAccumulatively() {
            Item item = item();
            givenStock(item, "30");
            issueService.save(newIssue(ii(item, "10")));  // 20
            issueService.save(newIssue(ii(item, "8")));   // 12
            issueService.save(newIssue(ii(item, "5")));   // 7
            assertEquals(bd("7"), stockOf(item));
        }

        @Test
        void lastIssueDrainsRemainingStock() {
            Item item = item();
            givenStock(item, "30");
            issueService.save(newIssue(ii(item, "25")));  // 5 left
            issueService.save(newIssue(ii(item, "5")));   // 0 left
            assertEquals(bd("0"), stockOf(item));
        }

        @Test
        void issueAfterLastDrains_throwsException() {
            Item item = item();
            givenStock(item, "10");
            issueService.save(newIssue(ii(item, "10"))); // stock = 0
            assertThrows(InvalidTransactionException.class,
                    () -> issueService.save(newIssue(ii(item, "1"))));
            assertEquals(bd("0"), stockOf(item));
        }
    }

    // =========================================================================
    // Update issue (id != null)
    // =========================================================================

    @Nested
    class UpdateIssue {

        @Test
        void increaseQty_moreConsumed_stockGoesLower() {
            Item item = item();
            givenStock(item, "40"); // 50 in stock, 10 already issued
            Issue existing = existingIssue(1L, ii(item, "10"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(existingIssue(1L, ii(item, "15")));

            // undo ISSUE(10) → 50; apply ISSUE(15) → 35
            assertEquals(bd("35"), stockOf(item));
        }

        @Test
        void decreaseQty_lessConsumed_stockGoesHigher() {
            Item item = item();
            givenStock(item, "40"); // 50 in stock, 10 already issued
            Issue existing = existingIssue(1L, ii(item, "10"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(existingIssue(1L, ii(item, "5")));

            // undo ISSUE(10) → 50; apply ISSUE(5) → 45
            assertEquals(bd("45"), stockOf(item));
        }

        @Test
        void setQtyToZero_issueRemoved_stockFullyRestored() {
            Item item = item();
            givenStock(item, "40");
            Issue existing = existingIssue(1L, ii(item, "10"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(existingIssue(1L, ii(item, "0")));

            // undo ISSUE(10) → 50
            assertEquals(bd("50"), stockOf(item));
        }

        @Test
        void newItemAdded_newItemStockReduced_existingItemUnchanged() {
            Item a = item(), b = item();
            givenStock(a, "40");
            givenStock(b, "20");
            Issue existing = existingIssue(1L, ii(a, "10"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(existingIssue(1L, ii(a, "10"), ii(b, "8")));

            assertEquals(bd("40"), stockOf(a)); // unchanged (same qty)
            assertEquals(bd("12"), stockOf(b)); // newly issued
        }

        @Test
        void sameQty_noInventorySave() {
            Item item = item();
            givenStock(item, "40");
            Issue existing = existingIssue(1L, ii(item, "10"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(existingIssue(1L, ii(item, "10")));

            assertEquals(bd("40"), stockOf(item));
            verify(inventoryRepository, never()).save(any());
        }

        @Test
        void multipleItemsUpdated_eachStockAdjustedIndependently() {
            Item a = item(), b = item();
            givenStock(a, "20"); // 30 stock, 10 issued
            givenStock(b, "15"); // 20 stock, 5 issued
            Issue existing = existingIssue(1L, ii(a, "10"), ii(b, "5"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(existingIssue(1L, ii(a, "12"), ii(b, "3")));

            // a: undo 10 → 30; apply 12 → 18
            // b: undo 5 → 20; apply 3 → 17
            assertEquals(bd("18"), stockOf(a));
            assertEquals(bd("17"), stockOf(b));
        }

        @Test
        void existingIssueNotFound_treatsAllItemsAsNew() {
            Item item = item();
            givenStock(item, "50");
            when(issueRepository.findById(1L)).thenReturn(Optional.empty());

            issueService.save(existingIssue(1L, ii(item, "15")));

            // No old qty → new issue of 15
            assertEquals(bd("35"), stockOf(item));
        }

        @Test
        void itemRemovedFromIssue_stockRestored() {
            // Item A was in the original issue; updated issue no longer contains it.
            // IssueService only loops over entity.getItems() — same gap as PurchaseService.
            // This test will FAIL if IssueService does not revert the removed item's transaction.
            Item a = item(), b = item();
            givenStock(a, "40"); // 50 stock, 10 issued via item A
            givenStock(b, "30");
            Issue existing = existingIssue(1L, ii(a, "10"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            // Update: item A removed, item B added
            issueService.save(existingIssue(1L, ii(b, "5")));

            assertEquals(bd("50"), stockOf(a), "stock of removed item must be restored");
            assertEquals(bd("25"), stockOf(b), "stock of new item must be reduced");
        }
    }

    // =========================================================================
    // Duplicate item validation
    // =========================================================================

    @Nested
    class DuplicateItemValidation {

        @Test
        void duplicateItemInNewIssue_throwsWarnException() {
            Item item = item();
            givenStock(item, "50");
            assertThrows(WarnException.class,
                    () -> issueService.save(newIssue(ii(item, "10"), ii(item, "5"))));
        }

        @Test
        void duplicateItemInUpdateIssue_throwsWarnException() {
            Item item = item();
            givenStock(item, "40");
            // no findById stub needed — validator fires before the repo is queried
            assertThrows(WarnException.class,
                    () -> issueService.save(existingIssue(1L, ii(item, "5"), ii(item, "3"))));
        }

        @Test
        void duplicateAmongMultipleItems_throwsWarnException() {
            Item a = item(), b = item();
            givenStock(a, "50");
            givenStock(b, "50");
            assertThrows(WarnException.class,
                    () -> issueService.save(newIssue(ii(a, "5"), ii(b, "3"), ii(a, "2"))));
        }

        @Test
        void noDuplicates_saveProceedsNormally() {
            Item a = item(), b = item();
            givenStock(a, "50");
            givenStock(b, "50");
            assertDoesNotThrow(() -> issueService.save(newIssue(ii(a, "5"), ii(b, "3"))));
            assertEquals(bd("45"), stockOf(a));
            assertEquals(bd("47"), stockOf(b));
        }

        @Test
        void duplicateStockNotModified_exceptionBeforeInventoryChange() {
            Item item = item();
            givenStock(item, "50");
            assertThrows(WarnException.class,
                    () -> issueService.save(newIssue(ii(item, "10"), ii(item, "5"))));
            assertEquals(bd("50"), stockOf(item));
            verify(inventoryRepository, never()).save(any());
        }
    }

    // =========================================================================
    // handleTransaction flag
    // =========================================================================

    @Nested
    class HandleTransactionFlag {

        @Test
        void handleTransactionFalse_noInventoryChange() {
            Item item = item();
            givenStock(item, "50");

            issueService.save(newIssue(ii(item, "20")), false);

            assertEquals(bd("50"), stockOf(item));
            verifyNoInteractions(inventoryRepository);
        }

        @Test
        void handleTransactionTrue_inventoryChanges() {
            Item item = item();
            givenStock(item, "50");

            issueService.save(newIssue(ii(item, "20")), true);

            assertEquals(bd("30"), stockOf(item));
        }

        @Test
        void handleTransactionFalse_onUpdate_noInventoryChange() {
            Item item = item();
            givenStock(item, "40");

            // handleTransaction=false means findById is never called (existing is not loaded)
            issueService.save(existingIssue(1L, ii(item, "25")), false);

            // No change despite different qty, because handleTransaction=false
            assertEquals(bd("40"), stockOf(item));
        }
    }

    // =========================================================================
    // Realistic workflows
    // =========================================================================

    @Nested
    class WorkflowScenarios {

        @Test
        void semesterLabConsumption_multipleIssuesAccumulate() {
            // Lab issues consumables across the semester from a single stock of 100
            Item item = item();
            givenStock(item, "100");
            issueService.save(newIssue(ii(item, "20")));  // 80
            issueService.save(newIssue(ii(item, "15")));  // 65
            issueService.save(newIssue(ii(item, "30")));  // 35
            issueService.save(newIssue(ii(item, "10")));  // 25
            assertEquals(bd("25"), stockOf(item));
        }

        @Test
        void issueCorrection_midSemester_stockAdjustsCorrectly() {
            // 80 in stock; issue 20 to class A; then correct: class A only needed 12
            Item item = item();
            givenStock(item, "80");
            issueService.save(newIssue(ii(item, "20")));  // 60

            Issue existing = existingIssue(1L, ii(item, "20"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));
            issueService.save(existingIssue(1L, ii(item, "12")));

            // undo 20 → 80; apply 12 → 68
            assertEquals(bd("68"), stockOf(item));
        }

        @Test
        void multipleIssues_oneUpdated_otherIssuesUnaffected() {
            Item item = item();
            givenStock(item, "100");
            issueService.save(newIssue(ii(item, "30")));  // issue A: 30 consumed → 70
            issueService.save(newIssue(ii(item, "20")));  // issue B: 20 consumed → 50

            // Correct issue A from 30 to 40
            Issue existingA = existingIssue(1L, ii(item, "30"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existingA));
            issueService.save(existingIssue(1L, ii(item, "40")));

            // undo 30 → 80; apply 40 → 40; issue B's 20 already applied
            // Net: 100 - 40 (A corrected) - 20 (B unchanged) = 40
            assertEquals(bd("40"), stockOf(item));
        }
    }
}
