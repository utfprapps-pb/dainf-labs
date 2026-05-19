package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.inventory.auditor.TransactionAuditor;
import br.edu.utfpr.dainf.model.*;
import br.edu.utfpr.dainf.repository.InventoryRepository;
import br.edu.utfpr.dainf.repository.IssueRepository;
import br.edu.utfpr.dainf.repository.ReturnRepository;
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
 * Tests for ReturnService that verify actual inventory quantity changes.
 *
 * A Return has two inventory effects per item:
 *   - quantityReturned → RETURN transaction (adds to stock)
 *   - quantityIssued   → ISSUE transaction  (subtracts from stock, for consumed/damaged items)
 *
 * Uses a real InventoryService with a stateful in-memory store.
 */
@ExtendWith(MockitoExtension.class)
class ReturnServiceInventoryTest {

    @Mock ReturnRepository returnRepository;
    @Mock IssueRepository issueRepository;
    @Mock InventoryRepository inventoryRepository;
    @Mock ConfigurationService configurationService;
    @Mock TransactionAuditor auditor;
    @Mock UserService userService;
    @Mock IssueService issueService;
    @Mock LoanService loanService;

    InventoryService inventoryService;
    ReturnService returnService;

    final Map<Long, Inventory> store = new HashMap<>();
    long idSeq = 1;
    Loan defaultLoan;

    @BeforeEach
    void setUp() {
        store.clear();
        idSeq = 1;

        inventoryService = new InventoryService(auditor, configurationService);
        ReflectionTestUtils.setField(inventoryService, "repository", inventoryRepository);

        returnService = new ReturnService(inventoryService, issueRepository, issueService, userService, loanService);
        ReflectionTestUtils.setField(returnService, "repository", returnRepository);

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

        // createIssue side effect: mocked so it does not affect inventory
        lenient().when(issueService.save(any(), eq(false))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());

        // loanService.refreshStatus: no-op so test stays focused on inventory
        lenient().when(loanService.refreshStatus(any())).thenAnswer(inv -> inv.getArgument(0));

        // returnRepository.save returns the entity as-is
        lenient().when(returnRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        defaultLoan = new Loan();
        defaultLoan.setId(100L);
        lenient().when(loanService.findById(100L)).thenReturn(Optional.of(defaultLoan));
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

    Return newReturn(ReturnItem... items) {
        Return r = new Return();
        r.setReturnDate(Instant.now());
        r.setLoan(defaultLoan);
        r.setItems(new ArrayList<>(List.of(items)));
        return r;
    }

    Return existingReturn(Long id, ReturnItem... items) {
        Return r = newReturn(items);
        r.setId(id);
        return r;
    }

    ReturnItem ri(Item item, String returned, String issued) {
        ReturnItem ri = new ReturnItem();
        ri.setItem(item);
        ri.setQuantityReturned(new BigDecimal(returned));
        ri.setQuantityIssued(new BigDecimal(issued));
        return ri;
    }

    static BigDecimal bd(String v) { return new BigDecimal(v); }

    // =========================================================================
    // New return (id = null) — quantity effects
    // =========================================================================

    @Nested
    class NewReturn {

        @Test
        void allItemsReturned_stockFullyRestored() {
            // Student borrowed 10 and returns all 10
            Item item = item();
            givenStock(item, "40"); // 50 purchased, 10 loaned
            returnService.save(newReturn(ri(item, "10", "0")));
            assertEquals(bd("50"), stockOf(item));
        }

        @Test
        void allItemsConsumedOrDamaged_noStockReturn() {
            // Student borrowed 10, all were consumed in use (quantityIssued=10)
            Item item = item();
            givenStock(item, "40");
            returnService.save(newReturn(ri(item, "0", "10")));
            // RETURN(0) → no change; ISSUE(10) → 40 - 10 = 30
            assertEquals(bd("30"), stockOf(item));
        }

        @Test
        void partialReturn_restOfItemsConsumed() {
            // Student borrowed 10: returns 7, 3 were consumed
            Item item = item();
            givenStock(item, "40");
            returnService.save(newReturn(ri(item, "7", "3")));
            // RETURN(7) → +7 → 47; ISSUE(3) → -3 → 44
            assertEquals(bd("44"), stockOf(item));
        }

        @Test
        void returnWithZeroBoth_noStockChange() {
            Item item = item();
            givenStock(item, "40");
            returnService.save(newReturn(ri(item, "0", "0")));
            assertEquals(bd("40"), stockOf(item));
            verify(inventoryRepository, never()).save(any());
        }

        @Test
        void multipleItems_eachAppliedIndependently() {
            Item scope = item(), slides = item(), covers = item();
            givenStock(scope,  "4");   // 5 purchased, 1 loaned
            givenStock(slides, "150"); // 200 purchased, 50 loaned
            givenStock(covers, "400"); // 500 purchased, 100 loaned

            returnService.save(newReturn(
                    ri(scope,  "1",  "0"),  // all returned
                    ri(slides, "40", "10"), // 40 returned, 10 consumed
                    ri(covers, "80", "20")  // 80 returned, 20 consumed
            ));

            assertEquals(bd("5"),   stockOf(scope));   // 4 + 1 = 5
            assertEquals(bd("180"), stockOf(slides));  // 150 + 40 - 10 = 180
            assertEquals(bd("460"), stockOf(covers));  // 400 + 80 - 20 = 460
        }

        @Test
        void returnAddsToExistingStock() {
            Item item = item();
            givenStock(item, "10"); // stock before return
            returnService.save(newReturn(ri(item, "5", "0")));
            assertEquals(bd("15"), stockOf(item));
        }

        @Test
        void onlyIssuedQuantity_stockDecreasesCorrectly() {
            // Items were borrowed and all consumed; no physical return
            Item item = item();
            givenStock(item, "40");
            returnService.save(newReturn(ri(item, "0", "8")));
            assertEquals(bd("32"), stockOf(item));
        }
    }

    // =========================================================================
    // Update return (id != null) — re-calculations
    // =========================================================================

    @Nested
    class UpdateReturn {

        @Test
        void increaseReturnedQty_moreStockBack() {
            // Initially recorded 7 returned; corrected to 9
            Item item = item();
            givenStock(item, "47"); // 50 purchased, 10 loaned, 7 returned
            Return existing = existingReturn(1L, ri(item, "7", "0"));
            when(returnRepository.findById(1L)).thenReturn(Optional.of(existing));

            returnService.save(existingReturn(1L, ri(item, "9", "0")));

            // undo RETURN(7) → 40; apply RETURN(9) → 49
            assertEquals(bd("49"), stockOf(item));
        }

        @Test
        void decreaseReturnedQty_lessStockBack() {
            Item item = item();
            givenStock(item, "47");
            Return existing = existingReturn(1L, ri(item, "7", "0"));
            when(returnRepository.findById(1L)).thenReturn(Optional.of(existing));

            returnService.save(existingReturn(1L, ri(item, "5", "0")));

            // undo RETURN(7) → 40; apply RETURN(5) → 45
            assertEquals(bd("45"), stockOf(item));
        }

        @Test
        void increaseIssuedQty_moreConsumed_stockGoesLower() {
            Item item = item();
            givenStock(item, "43"); // 50 purchased, 10 loaned, 3 issued
            Return existing = existingReturn(1L, ri(item, "0", "3"));
            when(returnRepository.findById(1L)).thenReturn(Optional.of(existing));

            returnService.save(existingReturn(1L, ri(item, "0", "5")));

            // undo ISSUE(3) → +3 → 46; apply ISSUE(5) → -5 → 41
            assertEquals(bd("41"), stockOf(item));
        }

        @Test
        void decreaseIssuedQty_lessConsumed_stockGoesHigher() {
            Item item = item();
            givenStock(item, "43");
            Return existing = existingReturn(1L, ri(item, "0", "3"));
            when(returnRepository.findById(1L)).thenReturn(Optional.of(existing));

            returnService.save(existingReturn(1L, ri(item, "0", "1")));

            // undo ISSUE(3) → +3 → 46; apply ISSUE(1) → -1 → 45
            assertEquals(bd("45"), stockOf(item));
        }

        @Test
        void switchReturnedToIssued_stockNetChanges() {
            // First recorded: 10 returned. Corrected: actually 0 returned, 10 consumed.
            Item item = item();
            givenStock(item, "50"); // 40 stock + 10 previously returned
            Return existing = existingReturn(1L, ri(item, "10", "0"));
            when(returnRepository.findById(1L)).thenReturn(Optional.of(existing));

            returnService.save(existingReturn(1L, ri(item, "0", "10")));

            // undo RETURN(10) → -10 → 40; undo ISSUE(0) → no-op; apply RETURN(0) → no-op; apply ISSUE(10) → -10 → 30
            assertEquals(bd("30"), stockOf(item));
        }

        @Test
        void switchIssuedToReturned_stockNetChanges() {
            // First recorded: 10 issued. Corrected: actually 10 returned.
            Item item = item();
            givenStock(item, "30"); // 40 stock - 10 issued
            Return existing = existingReturn(1L, ri(item, "0", "10"));
            when(returnRepository.findById(1L)).thenReturn(Optional.of(existing));

            returnService.save(existingReturn(1L, ri(item, "10", "0")));

            // undo ISSUE(10) → +10 → 40; apply RETURN(10) → +10 → 50
            assertEquals(bd("50"), stockOf(item));
        }

        @Test
        void updateMultipleItems_eachRecalculatedIndependently() {
            Item a = item(), b = item();
            givenStock(a, "47"); // RETURN(7) already applied
            givenStock(b, "43"); // ISSUE(3) already applied
            Return existing = existingReturn(1L, ri(a, "7", "0"), ri(b, "0", "3"));
            when(returnRepository.findById(1L)).thenReturn(Optional.of(existing));

            returnService.save(existingReturn(1L, ri(a, "9", "0"), ri(b, "0", "5")));

            // a: undo RETURN(7) → 40; apply RETURN(9) → 49
            // b: undo ISSUE(3) → 46; apply ISSUE(5) → 41
            assertEquals(bd("49"), stockOf(a));
            assertEquals(bd("41"), stockOf(b));
        }

        @Test
        void setReturnedToZero_stockReverts() {
            Item item = item();
            givenStock(item, "47");
            Return existing = existingReturn(1L, ri(item, "7", "0"));
            when(returnRepository.findById(1L)).thenReturn(Optional.of(existing));

            returnService.save(existingReturn(1L, ri(item, "0", "0")));

            // undo RETURN(7) → 40
            assertEquals(bd("40"), stockOf(item));
        }
    }

    // =========================================================================
    // Duplicate item validation
    // =========================================================================

    @Nested
    class DuplicateItemValidation {

        @Test
        void duplicateItemInNewReturn_throwsWarnException() {
            Item item = item();
            givenStock(item, "40");
            assertThrows(WarnException.class,
                    () -> returnService.save(newReturn(ri(item, "5", "0"), ri(item, "3", "0"))));
        }

        @Test
        void duplicateItemInUpdateReturn_throwsWarnException() {
            Item item = item();
            givenStock(item, "47");
            // no findById stub needed — validator fires before the repo is queried
            assertThrows(WarnException.class,
                    () -> returnService.save(existingReturn(1L, ri(item, "5", "0"), ri(item, "2", "0"))));
        }

        @Test
        void duplicateAmongMultipleItems_throwsWarnException() {
            Item a = item(), b = item();
            givenStock(a, "40");
            givenStock(b, "40");
            assertThrows(WarnException.class,
                    () -> returnService.save(newReturn(ri(a, "5", "0"), ri(b, "3", "0"), ri(a, "2", "0"))));
        }

        @Test
        void noDuplicates_saveProceedsNormally() {
            Item a = item(), b = item();
            givenStock(a, "40");
            givenStock(b, "40");
            assertDoesNotThrow(() -> returnService.save(newReturn(ri(a, "5", "0"), ri(b, "3", "0"))));
            assertEquals(bd("45"), stockOf(a));
            assertEquals(bd("43"), stockOf(b));
        }

        @Test
        void duplicateStockNotModified_exceptionBeforeInventoryChange() {
            Item item = item();
            givenStock(item, "40");
            assertThrows(WarnException.class,
                    () -> returnService.save(newReturn(ri(item, "5", "0"), ri(item, "3", "0"))));
            assertEquals(bd("40"), stockOf(item));
            verify(inventoryRepository, never()).save(any());
        }
    }

    // =========================================================================
    // Realistic workflow scenarios
    // =========================================================================

    @Nested
    class WorkflowScenarios {

        @Test
        void fullLoanCycle_borrowAllReturnAll() {
            // Purchase 50 → Loan 10 → Return all 10 → stock back to 50
            Item item = item();
            givenStock(item, "40"); // 50 purchased, 10 loaned
            returnService.save(newReturn(ri(item, "10", "0")));
            assertEquals(bd("50"), stockOf(item));
        }

        @Test
        void partialLoanCycle_someConsumedSomeLost() {
            // Borrowed 10: 6 returned physically, 2 consumed during use, 2 still missing
            Item item = item();
            givenStock(item, "40"); // 50 stock after loan of 10
            returnService.save(newReturn(ri(item, "6", "2")));
            // RETURN(6) → +6 → 46; ISSUE(2) → -2 → 44
            // The 2 "missing" items are handled by a separate overdue process — not here
            assertEquals(bd("44"), stockOf(item));
        }

        @Test
        void returnUpdatedAfterRealCount() {
            // Initial return entry: 7 returned, 3 consumed
            Item item = item();
            givenStock(item, "47"); // after RETURN(7)
            Return existing = existingReturn(1L, ri(item, "7", "3"));
            when(returnRepository.findById(1L)).thenReturn(Optional.of(existing));

            // Physical recount: actually 8 returned, 2 consumed
            returnService.save(existingReturn(1L, ri(item, "8", "2")));

            // a: undo RETURN(7) → -7 = 40; apply RETURN(8) → +8 = 48
            // b: undo ISSUE(3) → +3 = 51; apply ISSUE(2) → -2 = 49 (Note: undo/apply order is RETURN first, then ISSUE)
            // Let's trace carefully:
            // currentStock = 47
            // updateTransaction(item, old=7, RETURN, new=8): undo RETURN(7) → 47-7=40; apply RETURN(8) → 40+8=48
            // updateTransaction(item, old=3, ISSUE, new=2): undo ISSUE(3) → 48+3=51; apply ISSUE(2) → 51-2=49
            assertEquals(bd("49"), stockOf(item));
        }

        @Test
        void labKitReturn_multipleItemsMixedOutcomes() {
            // Kit borrowed: scope=1, slides=50, covers=100
            // Returned: scope intact, slides=40 returned + 10 consumed, covers=90 returned + 10 missing
            Item scope = item(), slides = item(), covers = item();
            givenStock(scope,  "4");   // 5 purchased, 1 loaned
            givenStock(slides, "150"); // 200 purchased, 50 loaned
            givenStock(covers, "400"); // 500 purchased, 100 loaned

            returnService.save(newReturn(
                    ri(scope,  "1",  "0"),  // all returned
                    ri(slides, "40", "10"), // 40 returned, 10 consumed
                    ri(covers, "90", "0")   // 90 returned, 10 missing (unresolved)
            ));

            assertEquals(bd("5"),   stockOf(scope));   // 4 + 1 = 5
            assertEquals(bd("180"), stockOf(slides));  // 150 + 40 - 10 = 180
            assertEquals(bd("490"), stockOf(covers));  // 400 + 90 = 490
        }
    }
}
