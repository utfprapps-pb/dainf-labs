package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.LoanStatus;
import br.edu.utfpr.dainf.exception.InvalidTransactionException;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.inventory.auditor.TransactionAuditor;
import br.edu.utfpr.dainf.model.*;
import br.edu.utfpr.dainf.repository.InventoryRepository;
import br.edu.utfpr.dainf.repository.LoanRepository;
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
 * Tests for LoanService that verify actual inventory quantity changes.
 * Uses a real InventoryService with a stateful in-memory store.
 */
@ExtendWith(MockitoExtension.class)
class LoanServiceInventoryTest {

    @Mock LoanRepository loanRepository;
    @Mock ReturnRepository returnRepository;
    @Mock InventoryRepository inventoryRepository;
    @Mock ConfigurationService configurationService;
    @Mock TransactionAuditor auditor;
    @Mock UserService userService;
    @Mock LoanMailService loanMailService;

    InventoryService inventoryService;
    LoanService loanService;

    final Map<Long, Inventory> store = new HashMap<>();
    long idSeq = 1;
    User currentUser;

    @BeforeEach
    void setUp() {
        store.clear();
        idSeq = 1;

        inventoryService = new InventoryService(auditor, configurationService);
        ReflectionTestUtils.setField(inventoryService, "repository", inventoryRepository);

        loanService = new LoanService(inventoryService, returnRepository, userService, loanMailService);
        ReflectionTestUtils.setField(loanService, "repository", loanRepository);

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

        currentUser = new User();
        currentUser.setId(99L);
        lenient().when(userService.getCurrentUser()).thenReturn(currentUser);
        lenient().when(userService.hasPrivilegedAcess()).thenReturn(true);

        // loanRepository.save returns the entity as-is (id remains null for new loans → refreshStatus is a no-op)
        lenient().when(loanRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // refreshStatus for update tests: sumReturnableQuantity=0 → auto-completed status
        lenient().when(loanRepository.sumReturnableQuantity(any())).thenReturn(BigDecimal.ZERO);
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

    Loan newLoan(LoanItem... items) {
        Loan loan = new Loan();
        loan.setLoanDate(Instant.now());
        loan.setBorrower(currentUser);
        loan.setItems(new ArrayList<>(List.of(items)));
        return loan;
    }

    Loan existingLoan(Long id, LoanItem... items) {
        Loan loan = newLoan(items);
        loan.setId(id);
        loan.setStatus(LoanStatus.ONGOING);
        return loan;
    }

    LoanItem li(Item item, String qty) {
        return li(item, qty, false);
    }

    LoanItem li(Item item, String qty, boolean shouldReturn) {
        LoanItem li = new LoanItem();
        li.setItem(item);
        li.setQuantity(new BigDecimal(qty));
        li.setShouldReturn(shouldReturn);
        return li;
    }

    static BigDecimal bd(String v) { return new BigDecimal(v); }

    // =========================================================================
    // New loan (id = null)
    // =========================================================================

    @Nested
    class NewLoan {

        @Test
        void singleItem_stockReduced() {
            Item item = item();
            givenStock(item, "50");
            loanService.save(newLoan(li(item, "10")));
            assertEquals(bd("40"), stockOf(item));
        }

        @Test
        void multipleItems_eachStockReducedIndependently() {
            Item a = item(), b = item(), c = item();
            givenStock(a, "30");
            givenStock(b, "20");
            givenStock(c, "10");
            loanService.save(newLoan(li(a, "5"), li(b, "8"), li(c, "3")));
            assertEquals(bd("25"), stockOf(a));
            assertEquals(bd("12"), stockOf(b));
            assertEquals(bd("7"),  stockOf(c));
        }

        @Test
        void exactlyExhaustsStock_stockReachesZero() {
            Item item = item();
            givenStock(item, "15");
            loanService.save(newLoan(li(item, "15")));
            assertEquals(bd("0"), stockOf(item));
        }

        @Test
        void exceedsAvailableStock_throwsException_stockUnchanged() {
            Item item = item();
            givenStock(item, "5");
            assertThrows(InvalidTransactionException.class,
                    () -> loanService.save(newLoan(li(item, "10"))));
            assertEquals(bd("5"), stockOf(item));
        }

        @Test
        void emptyItemsList_noInventoryInteraction() {
            Loan loan = new Loan();
            loan.setLoanDate(Instant.now());
            loan.setBorrower(currentUser);
            loan.setItems(List.of());
            loanService.save(loan);
            verifyNoInteractions(inventoryRepository);
        }

        @Test
        void consecutiveLoansFromSameStock_eachReduces() {
            Item item = item();
            givenStock(item, "30");
            loanService.save(newLoan(li(item, "5")));   // student A: 25
            loanService.save(newLoan(li(item, "8")));   // student B: 17
            loanService.save(newLoan(li(item, "3")));   // student C: 14
            assertEquals(bd("14"), stockOf(item));
        }

        @Test
        void thirdLoanExceedsRemainingStock_throwsException() {
            Item item = item();
            givenStock(item, "15");
            loanService.save(newLoan(li(item, "8")));  // 7 left
            loanService.save(newLoan(li(item, "5")));  // 2 left
            assertThrows(InvalidTransactionException.class,
                    () -> loanService.save(newLoan(li(item, "3"))));
            assertEquals(bd("2"), stockOf(item));
        }
    }

    // =========================================================================
    // Update loan (id != null)
    // =========================================================================

    @Nested
    class UpdateLoan {

        @Test
        void increaseQty_stockGoesLower() {
            Item item = item();
            givenStock(item, "40"); // 50 stock, 10 loaned
            Loan existing = existingLoan(1L, li(item, "10"));
            when(loanRepository.findById(1L)).thenReturn(Optional.of(existing));

            loanService.save(existingLoan(1L, li(item, "15")));

            // undo LOAN(10) → 50; apply LOAN(15) → 35
            assertEquals(bd("35"), stockOf(item));
        }

        @Test
        void decreaseQty_stockGoesHigher() {
            Item item = item();
            givenStock(item, "40"); // 50 stock, 10 loaned
            Loan existing = existingLoan(1L, li(item, "10"));
            when(loanRepository.findById(1L)).thenReturn(Optional.of(existing));

            loanService.save(existingLoan(1L, li(item, "5")));

            // undo LOAN(10) → 50; apply LOAN(5) → 45
            assertEquals(bd("45"), stockOf(item));
        }

        @Test
        void setQtyToZero_loanCancelled_stockFullyRestored() {
            Item item = item();
            givenStock(item, "40");
            Loan existing = existingLoan(1L, li(item, "10"));
            when(loanRepository.findById(1L)).thenReturn(Optional.of(existing));

            loanService.save(existingLoan(1L, li(item, "0")));

            // undo LOAN(10) → 50
            assertEquals(bd("50"), stockOf(item));
        }

        @Test
        void newItemAdded_newItemStockReduced_existingItemUnchanged() {
            Item a = item(), b = item();
            givenStock(a, "40");
            givenStock(b, "20");
            Loan existing = existingLoan(1L, li(a, "10"));
            when(loanRepository.findById(1L)).thenReturn(Optional.of(existing));

            loanService.save(existingLoan(1L, li(a, "10"), li(b, "8")));

            assertEquals(bd("40"), stockOf(a)); // unchanged
            assertEquals(bd("12"), stockOf(b)); // newly loaned
        }

        @Test
        void sameQty_noInventorySave() {
            Item item = item();
            givenStock(item, "40");
            Loan existing = existingLoan(1L, li(item, "10"));
            when(loanRepository.findById(1L)).thenReturn(Optional.of(existing));

            loanService.save(existingLoan(1L, li(item, "10")));

            assertEquals(bd("40"), stockOf(item));
            verify(inventoryRepository, never()).save(any());
        }

        @Test
        void multipleItemsUpdated_eachStockAdjustedIndependently() {
            Item a = item(), b = item();
            givenStock(a, "20"); // 30 stock, 10 loaned
            givenStock(b, "15"); // 20 stock, 5 loaned
            Loan existing = existingLoan(1L, li(a, "10"), li(b, "5"));
            when(loanRepository.findById(1L)).thenReturn(Optional.of(existing));

            loanService.save(existingLoan(1L, li(a, "12"), li(b, "2")));

            // a: undo 10 → 30; apply 12 → 18
            // b: undo 5 → 20; apply 2 → 18
            assertEquals(bd("18"), stockOf(a));
            assertEquals(bd("18"), stockOf(b));
        }

        @Test
        void existingLoanNotFound_treatsAllItemsAsNew() {
            Item item = item();
            givenStock(item, "50");
            when(loanRepository.findById(1L)).thenReturn(Optional.empty());

            loanService.save(existingLoan(1L, li(item, "15")));

            assertEquals(bd("35"), stockOf(item));
        }

        @Test
        void itemRemovedFromLoan_stockRestored() {
            // Item A was in the original loan; updated loan no longer contains it.
            // This test will FAIL if LoanService does not revert the removed item's transaction.
            Item a = item(), b = item();
            givenStock(a, "40"); // 50 stock, 10 loaned via item A
            givenStock(b, "30");
            Loan existing = existingLoan(1L, li(a, "10"));
            when(loanRepository.findById(1L)).thenReturn(Optional.of(existing));

            // Update: item A removed, item B added
            loanService.save(existingLoan(1L, li(b, "5")));

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
        void duplicateItemInNewLoan_throwsWarnException() {
            Item item = item();
            givenStock(item, "50");
            assertThrows(WarnException.class,
                    () -> loanService.save(newLoan(li(item, "5"), li(item, "3"))));
        }

        @Test
        void duplicateItemInUpdateLoan_throwsWarnException() {
            Item item = item();
            givenStock(item, "40");
            // no findById stub needed — validator fires before the repo is queried
            assertThrows(WarnException.class,
                    () -> loanService.save(existingLoan(1L, li(item, "5"), li(item, "3"))));
        }

        @Test
        void duplicateAmongMultipleItems_throwsWarnException() {
            Item a = item(), b = item();
            givenStock(a, "50");
            givenStock(b, "50");
            assertThrows(WarnException.class,
                    () -> loanService.save(newLoan(li(a, "5"), li(b, "3"), li(a, "2"))));
        }

        @Test
        void noDuplicates_saveProceedsNormally() {
            Item a = item(), b = item();
            givenStock(a, "50");
            givenStock(b, "50");
            assertDoesNotThrow(() -> loanService.save(newLoan(li(a, "5"), li(b, "3"))));
            assertEquals(bd("45"), stockOf(a));
            assertEquals(bd("47"), stockOf(b));
        }

        @Test
        void duplicateStockNotModified_exceptionBeforeInventoryChange() {
            Item item = item();
            givenStock(item, "50");
            assertThrows(WarnException.class,
                    () -> loanService.save(newLoan(li(item, "5"), li(item, "3"))));
            assertEquals(bd("50"), stockOf(item));
            verify(inventoryRepository, never()).save(any());
        }
    }

    // =========================================================================
    // Realistic workflow scenarios
    // =========================================================================

    @Nested
    class WorkflowScenarios {

        @Test
        void studentLoansEquipment_adminIncreasesLoanQty() {
            Item item = item();
            givenStock(item, "50");
            // Student initially borrows 3 units
            loanService.save(newLoan(li(item, "3"))); // 47 left

            // Admin corrects loan to 5 units
            Loan existing = existingLoan(1L, li(item, "3"));
            when(loanRepository.findById(1L)).thenReturn(Optional.of(existing));
            loanService.save(existingLoan(1L, li(item, "5")));

            // undo 3 → 50; apply 5 → 45
            assertEquals(bd("45"), stockOf(item));
        }

        @Test
        void multipleStudentsLoanSameItem_stockDrainsCorrectly() {
            Item item = item();
            givenStock(item, "20");
            loanService.save(newLoan(li(item, "4")));   // 16
            loanService.save(newLoan(li(item, "6")));   // 10
            loanService.save(newLoan(li(item, "3")));   // 7
            assertEquals(bd("7"), stockOf(item));
        }

        @Test
        void loanCancelledBeforePickup_stockRecovers() {
            Item item = item();
            givenStock(item, "20");
            loanService.save(newLoan(li(item, "8"))); // 12 left

            // Loan cancelled: qty set to 0
            Loan existing = existingLoan(1L, li(item, "8"));
            when(loanRepository.findById(1L)).thenReturn(Optional.of(existing));
            loanService.save(existingLoan(1L, li(item, "0")));

            // undo 8 → 20
            assertEquals(bd("20"), stockOf(item));
        }

        @Test
        void kitLoan_multipleItemsInSingleLoan() {
            // A lab kit: microscope + slides + cover slips
            Item scope = item(), slides = item(), covers = item();
            givenStock(scope, "5");
            givenStock(slides, "200");
            givenStock(covers, "500");

            loanService.save(newLoan(
                    li(scope,  "1"),
                    li(slides, "50"),
                    li(covers, "100")
            ));

            assertEquals(bd("4"),   stockOf(scope));
            assertEquals(bd("150"), stockOf(slides));
            assertEquals(bd("400"), stockOf(covers));
        }
    }
}
