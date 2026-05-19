package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.exception.InvalidTransactionException;
import br.edu.utfpr.dainf.inventory.auditor.TransactionAuditor;
import br.edu.utfpr.dainf.model.Configuration;
import br.edu.utfpr.dainf.model.Inventory;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.repository.InventoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Real-scenario tests for InventoryService that validate actual quantity changes.
 *
 * Infrastructure (repository, auditor, configuration) is mocked.
 * Transaction and validator logic runs against a real, stateful Inventory object,
 * so every assertion checks the actual resulting quantity — not just which method was called.
 */
@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {

    @Mock InventoryRepository repository;
    @Mock ConfigurationService configurationService;
    @Mock TransactionAuditor auditor;
    @InjectMocks InventoryService inventoryService;

    Item item;
    Inventory inventory;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(inventoryService, "repository", repository);

        item = new Item();
        item.setId(1L);
        inventory = new Inventory(item, BigDecimal.ZERO);

        // Stateful mocks: findByItem returns the shared inventory object;
        // save keeps mutations in place. lenient() prevents unused-stub failures
        // in tests that short-circuit (e.g., updateTransaction Case 4).
        lenient().when(repository.findByItem(item)).thenReturn(Optional.of(inventory));
        lenient().when(repository.save(any(Inventory.class))).thenAnswer(inv -> inv.getArgument(0));

        withMinimumStockValidator(false);
    }

    // --- helpers ---

    void givenStock(String qty) {
        inventory.setQuantity(new BigDecimal(qty));
    }

    BigDecimal currentStock() {
        return inventory.getQuantity();
    }

    void withMinimumStockValidator(boolean enabled) {
        Configuration config = new Configuration();
        config.setUseMinimumStockValidator(enabled ? Boolean.TRUE : null);
        lenient().when(configurationService.get()).thenReturn(config);
    }

    void itemWithMinimumStock(String minimum) {
        item.setMinimumStock(new BigDecimal(minimum));
    }

    static BigDecimal bd(String value) {
        return new BigDecimal(value);
    }

    // =========================================================================
    // findByItem
    // =========================================================================

    @Nested
    class FindByItem {

        @Test
        void existingRecord_returnsIt() {
            givenStock("25");
            Inventory result = inventoryService.findByItem(item);
            assertEquals(bd("25"), result.getQuantity());
        }

        @Test
        void noRecord_returnsNewInventoryWithZeroQuantity() {
            when(repository.findByItem(item)).thenReturn(Optional.empty());
            Inventory result = inventoryService.findByItem(item);
            assertEquals(BigDecimal.ZERO, result.getQuantity());
            assertSame(item, result.getItem());
        }
    }

    // =========================================================================
    // handleTransaction — basic single operations
    // =========================================================================

    @Nested
    class HandleTransaction {

        @Test
        void purchase_onEmptyInventory_setsQuantity() {
            inventoryService.handleTransaction(item, bd("50"), InventoryTransactionType.PURCHASE);
            assertEquals(bd("50"), currentStock());
        }

        @Test
        void purchase_onExistingStock_addsQuantity() {
            givenStock("30");
            inventoryService.handleTransaction(item, bd("20"), InventoryTransactionType.PURCHASE);
            assertEquals(bd("50"), currentStock());
        }

        @Test
        void issue_reducesInventory() {
            givenStock("50");
            inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.ISSUE);
            assertEquals(bd("40"), currentStock());
        }

        @Test
        void loan_reducesInventory() {
            givenStock("50");
            inventoryService.handleTransaction(item, bd("15"), InventoryTransactionType.LOAN);
            assertEquals(bd("35"), currentStock());
        }

        @Test
        void returnItem_addsToInventory() {
            givenStock("35");
            inventoryService.handleTransaction(item, bd("5"), InventoryTransactionType.RETURN);
            assertEquals(bd("40"), currentStock());
        }

        @Test
        void purchase_zeroQuantity_throwsException() {
            assertThrows(InvalidTransactionException.class,
                    () -> inventoryService.handleTransaction(item, bd("0"), InventoryTransactionType.PURCHASE));
        }

        @Test
        void issue_zeroQuantity_throwsException() {
            givenStock("20");
            assertThrows(InvalidTransactionException.class,
                    () -> inventoryService.handleTransaction(item, bd("0"), InventoryTransactionType.ISSUE));
        }
    }

    // =========================================================================
    // Sequential real-world scenarios
    // =========================================================================

    @Nested
    class SequentialScenarios {

        @Test
        void labReceivesThenIssuesConsumables() {
            // Lab receives 100 units and issues them to two different experiments
            inventoryService.handleTransaction(item, bd("100"), InventoryTransactionType.PURCHASE); // 100
            inventoryService.handleTransaction(item, bd("20"), InventoryTransactionType.ISSUE);      // 80
            inventoryService.handleTransaction(item, bd("15"), InventoryTransactionType.ISSUE);      // 65
            assertEquals(bd("65"), currentStock());
        }

        @Test
        void labReceivesThenLoansToStudent_studentReturnsAll() {
            // Lab loans 10 units to a student who returns all of them
            inventoryService.handleTransaction(item, bd("50"), InventoryTransactionType.PURCHASE); // 50
            inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.LOAN);     // 40
            inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.RETURN);   // 50
            assertEquals(bd("50"), currentStock());
        }

        @Test
        void labReceivesThenLoansToStudent_studentReturnsPartially() {
            // Lab loans 10 units; student returns 7 (3 are missing — will be marked as issued by ReturnService)
            inventoryService.handleTransaction(item, bd("50"), InventoryTransactionType.PURCHASE); // 50
            inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.LOAN);     // 40
            inventoryService.handleTransaction(item, bd("7"), InventoryTransactionType.RETURN);    // 47
            assertEquals(bd("47"), currentStock());
        }

        @Test
        void fullLoanCycle_withDamagedItemsIssuedOnReturn() {
            // ReturnService triggers a RETURN for items physically returned and
            // an ISSUE for items consumed or lost during the loan
            inventoryService.handleTransaction(item, bd("50"), InventoryTransactionType.PURCHASE); // 50
            inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.LOAN);     // 40
            inventoryService.handleTransaction(item, bd("7"), InventoryTransactionType.RETURN);    // 47
            inventoryService.handleTransaction(item, bd("3"), InventoryTransactionType.ISSUE);     // 44
            assertEquals(bd("44"), currentStock());
        }

        @Test
        void multipleRestockCycles_acrossSemester() {
            // Lab receives three shipments and issues items throughout the semester
            inventoryService.handleTransaction(item, bd("100"), InventoryTransactionType.PURCHASE); // 100
            inventoryService.handleTransaction(item, bd("30"), InventoryTransactionType.ISSUE);      // 70
            inventoryService.handleTransaction(item, bd("50"), InventoryTransactionType.PURCHASE);  // 120
            inventoryService.handleTransaction(item, bd("40"), InventoryTransactionType.ISSUE);      // 80
            inventoryService.handleTransaction(item, bd("20"), InventoryTransactionType.PURCHASE);  // 100
            assertEquals(bd("100"), currentStock());
        }

        @Test
        void concurrentLoans_threeStudents_stockReducesCorrectly() {
            // Three students borrow items simultaneously from the same stock
            inventoryService.handleTransaction(item, bd("30"), InventoryTransactionType.PURCHASE); // 30
            inventoryService.handleTransaction(item, bd("5"), InventoryTransactionType.LOAN);      // 25 — student A
            inventoryService.handleTransaction(item, bd("8"), InventoryTransactionType.LOAN);      // 17 — student B
            inventoryService.handleTransaction(item, bd("3"), InventoryTransactionType.LOAN);      // 14 — student C
            assertEquals(bd("14"), currentStock());
        }

        @Test
        void concurrentLoans_allStudentsReturnCompletely() {
            // All three students return their items; stock recovers fully
            inventoryService.handleTransaction(item, bd("30"), InventoryTransactionType.PURCHASE); // 30
            inventoryService.handleTransaction(item, bd("5"), InventoryTransactionType.LOAN);
            inventoryService.handleTransaction(item, bd("8"), InventoryTransactionType.LOAN);
            inventoryService.handleTransaction(item, bd("3"), InventoryTransactionType.LOAN);      // 14
            inventoryService.handleTransaction(item, bd("5"), InventoryTransactionType.RETURN);
            inventoryService.handleTransaction(item, bd("8"), InventoryTransactionType.RETURN);
            inventoryService.handleTransaction(item, bd("3"), InventoryTransactionType.RETURN);    // 30
            assertEquals(bd("30"), currentStock());
        }

        @Test
        void mixedOperations_issuesAndLoansFromSameStock() {
            // Lab buys 80 units, issues some as consumables and loans others to students
            inventoryService.handleTransaction(item, bd("80"), InventoryTransactionType.PURCHASE); // 80
            inventoryService.handleTransaction(item, bd("20"), InventoryTransactionType.ISSUE);     // 60 — consumed in experiments
            inventoryService.handleTransaction(item, bd("15"), InventoryTransactionType.LOAN);     // 45 — loaned to student A
            inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.ISSUE);     // 35 — consumed in lab class
            inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.RETURN);   // 45 — student A returns 10 of 15
            assertEquals(bd("45"), currentStock());
        }
    }

    // =========================================================================
    // Validation — insufficient stock
    // =========================================================================

    @Nested
    class InsufficientStockValidation {

        @Test
        void issue_exceedsAvailableStock_throwsException() {
            givenStock("5");
            assertThrows(InvalidTransactionException.class,
                    () -> inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.ISSUE));
        }

        @Test
        void loan_exceedsAvailableStock_throwsException() {
            givenStock("3");
            assertThrows(InvalidTransactionException.class,
                    () -> inventoryService.handleTransaction(item, bd("5"), InventoryTransactionType.LOAN));
        }

        @Test
        void issue_exactlyExhaustsStock_succeeds() {
            givenStock("10");
            assertDoesNotThrow(
                    () -> inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.ISSUE));
            assertEquals(bd("0"), currentStock());
        }

        @Test
        void loan_exactlyExhaustsStock_succeeds() {
            givenStock("10");
            assertDoesNotThrow(
                    () -> inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.LOAN));
            assertEquals(bd("0"), currentStock());
        }

        @Test
        void issue_failsAfterPreviousIssuesDrainStock() {
            // Multiple issues bring stock low; one more attempt exceeds remaining stock
            givenStock("15");
            inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.ISSUE); // stock = 5
            assertThrows(InvalidTransactionException.class,
                    () -> inventoryService.handleTransaction(item, bd("6"), InventoryTransactionType.ISSUE));
        }

        @Test
        void issue_onEmptyInventory_throwsException() {
            assertThrows(InvalidTransactionException.class,
                    () -> inventoryService.handleTransaction(item, bd("1"), InventoryTransactionType.ISSUE));
        }

        @Test
        void exceptionDoesNotModifyInventory() {
            givenStock("5");
            assertThrows(InvalidTransactionException.class,
                    () -> inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.ISSUE));
            // Stock must be unchanged after failed transaction
            assertEquals(bd("5"), currentStock());
        }
    }

    // =========================================================================
    // Validation — minimum stock
    // =========================================================================

    @Nested
    class MinimumStockValidation {

        @BeforeEach
        void enableValidator() {
            withMinimumStockValidator(true);
        }

        @Test
        void issue_wouldBreachMinimumStock_throwsException() {
            // Stock=15, minimum=10; issuing 8 would leave 7 < 10
            itemWithMinimumStock("10");
            givenStock("15");
            assertThrows(InvalidTransactionException.class,
                    () -> inventoryService.handleTransaction(item, bd("8"), InventoryTransactionType.ISSUE));
        }

        @Test
        void loan_wouldBreachMinimumStock_throwsException() {
            itemWithMinimumStock("10");
            givenStock("15");
            assertThrows(InvalidTransactionException.class,
                    () -> inventoryService.handleTransaction(item, bd("8"), InventoryTransactionType.LOAN));
        }

        @Test
        void issue_exactlyAtMinimumStock_succeeds() {
            // Stock=20, minimum=10; issuing 10 leaves exactly 10 — boundary case, must be allowed
            itemWithMinimumStock("10");
            givenStock("20");
            assertDoesNotThrow(
                    () -> inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.ISSUE));
            assertEquals(bd("10"), currentStock());
        }

        @Test
        void issue_oneUnitBeyondBoundary_throwsException() {
            // Stock=20, minimum=10; issuing 11 would leave 9 — one unit past the boundary
            itemWithMinimumStock("10");
            givenStock("20");
            assertThrows(InvalidTransactionException.class,
                    () -> inventoryService.handleTransaction(item, bd("11"), InventoryTransactionType.ISSUE));
        }

        @Test
        void issue_noMinimumStockDefined_onlyPositiveInventoryApplies() {
            // Item has no minimum stock; stock can be reduced to zero without violation
            givenStock("5");
            assertDoesNotThrow(
                    () -> inventoryService.handleTransaction(item, bd("5"), InventoryTransactionType.ISSUE));
            assertEquals(bd("0"), currentStock());
        }

        @Test
        void purchase_minimumStockNotChecked_succeeds() {
            // Minimum stock validator only applies to subtracting transactions
            itemWithMinimumStock("50");
            givenStock("0");
            assertDoesNotThrow(
                    () -> inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.PURCHASE));
        }

        @Test
        void minimumStockBreachDoesNotModifyInventory() {
            itemWithMinimumStock("10");
            givenStock("15");
            assertThrows(InvalidTransactionException.class,
                    () -> inventoryService.handleTransaction(item, bd("8"), InventoryTransactionType.ISSUE));
            assertEquals(bd("15"), currentStock());
        }
    }

    @Nested
    class MinimumStockValidatorDisabled {

        @BeforeEach
        void disableValidator() {
            withMinimumStockValidator(false);
        }

        @Test
        void issue_wouldBreachMinimumStock_butValidatorDisabled_succeeds() {
            // Without the validator, only the positive-inventory check applies
            itemWithMinimumStock("10");
            givenStock("15");
            assertDoesNotThrow(
                    () -> inventoryService.handleTransaction(item, bd("8"), InventoryTransactionType.ISSUE));
            assertEquals(bd("7"), currentStock());
        }

        @Test
        void issue_stillFailsWhenStockGoesNegative_evenWithValidatorDisabled() {
            // PositiveInventoryValidator is always active regardless of configuration
            itemWithMinimumStock("10");
            givenStock("5");
            assertThrows(InvalidTransactionException.class,
                    () -> inventoryService.handleTransaction(item, bd("6"), InventoryTransactionType.ISSUE));
        }
    }

    // =========================================================================
    // undoTransaction — reversal logic
    // =========================================================================

    @Nested
    class UndoTransaction {

        @Test
        void undoPurchase_subtractsWhatWasAdded() {
            // Inventory has 50 from a purchase of 50; undo removes it
            givenStock("50");
            inventoryService.undoTransaction(item, bd("50"), InventoryTransactionType.PURCHASE);
            // reverseType(PURCHASE) = ISSUE → stock goes from 50 to 0
            assertEquals(bd("0"), currentStock());
        }

        @Test
        void undoIssue_addsBackWhatWasRemoved() {
            givenStock("40"); // was 50 before issue of 10
            inventoryService.undoTransaction(item, bd("10"), InventoryTransactionType.ISSUE);
            // reverseType(ISSUE) = RETURN → stock goes from 40 to 50
            assertEquals(bd("50"), currentStock());
        }

        @Test
        void undoLoan_addsBackBorrowedQuantity() {
            givenStock("35"); // was 50 before loan of 15
            inventoryService.undoTransaction(item, bd("15"), InventoryTransactionType.LOAN);
            // reverseType(LOAN) = RETURN → stock goes from 35 to 50
            assertEquals(bd("50"), currentStock());
        }

        @Test
        void undoReturn_subtractsWhatWasReturned() {
            givenStock("40"); // was 35 before return of 5
            inventoryService.undoTransaction(item, bd("5"), InventoryTransactionType.RETURN);
            // reverseType(RETURN) = ISSUE → stock goes from 40 to 35
            assertEquals(bd("35"), currentStock());
        }
    }

    // =========================================================================
    // updateTransaction — the four cases
    // =========================================================================

    @Nested
    class UpdateTransaction {

        @Test
        void case1_wasZero_nowPositive_appliesNewTransaction() {
            // New purchase line item: no previous value, quantity just set
            inventoryService.updateTransaction(item, BigDecimal.ZERO, InventoryTransactionType.PURCHASE, bd("30"));
            assertEquals(bd("30"), currentStock());
        }

        @Test
        void case2_wasPositive_nowZero_undoesOldTransaction() {
            givenStock("30"); // reflects a prior purchase of 30
            // Purchase item removed from order
            inventoryService.updateTransaction(item, bd("30"), InventoryTransactionType.PURCHASE, BigDecimal.ZERO);
            assertEquals(bd("0"), currentStock());
        }

        @Test
        void case3_purchaseQtyIncreased_stockAdjustsUp() {
            givenStock("30"); // reflects a prior purchase of 30
            inventoryService.updateTransaction(item, bd("30"), InventoryTransactionType.PURCHASE, bd("50"));
            // undo 30 (→ 0), apply 50 (→ 50)
            assertEquals(bd("50"), currentStock());
        }

        @Test
        void case3_purchaseQtyDecreased_stockAdjustsDown() {
            givenStock("30");
            inventoryService.updateTransaction(item, bd("30"), InventoryTransactionType.PURCHASE, bd("20"));
            // undo 30 (→ 0), apply 20 (→ 20)
            assertEquals(bd("20"), currentStock());
        }

        @Test
        void case3_issueQtyIncreased_stockGoesLower() {
            givenStock("40"); // 50 purchased, 10 issued
            // Issuing 5 more: update issue from 10 to 15
            inventoryService.updateTransaction(item, bd("10"), InventoryTransactionType.ISSUE, bd("15"));
            // undo ISSUE(10) → +10 → 50; apply ISSUE(15) → -15 → 35
            assertEquals(bd("35"), currentStock());
        }

        @Test
        void case3_issueQtyDecreased_stockGoesHigher() {
            givenStock("40"); // 50 purchased, 10 issued
            // Correction: only 5 items were consumed, not 10
            inventoryService.updateTransaction(item, bd("10"), InventoryTransactionType.ISSUE, bd("5"));
            // undo ISSUE(10) → +10 → 50; apply ISSUE(5) → -5 → 45
            assertEquals(bd("45"), currentStock());
        }

        @Test
        void case3_loanQtyIncreased_stockGoesLower() {
            givenStock("35"); // 50 purchased, 15 loaned
            inventoryService.updateTransaction(item, bd("15"), InventoryTransactionType.LOAN, bd("20"));
            // undo LOAN(15) → +15 → 50; apply LOAN(20) → -20 → 30
            assertEquals(bd("30"), currentStock());
        }

        @Test
        void case4_bothZero_noOperation_stockUnchanged() {
            givenStock("50");
            inventoryService.updateTransaction(item, BigDecimal.ZERO, InventoryTransactionType.PURCHASE, BigDecimal.ZERO);
            assertEquals(bd("50"), currentStock());
            verify(repository, never()).save(any());
        }

        @Test
        void sameQty_noOperation_stockUnchanged() {
            // Same quantity old and new: no adjustment needed
            givenStock("30");
            inventoryService.updateTransaction(item, bd("30"), InventoryTransactionType.PURCHASE, bd("30"));
            assertEquals(bd("30"), currentStock());
            verify(repository, never()).save(any());
        }

        @Test
        void nullOldQty_treatedAsZero_appliesNewTransaction() {
            // Null old quantity is defaulted to zero inside updateTransaction
            inventoryService.updateTransaction(item, null, InventoryTransactionType.PURCHASE, bd("40"));
            assertEquals(bd("40"), currentStock());
        }

        @Test
        void nullNewQty_treatedAsZero_undoesOldTransaction() {
            givenStock("40");
            inventoryService.updateTransaction(item, bd("40"), InventoryTransactionType.PURCHASE, null);
            assertEquals(bd("0"), currentStock());
        }
    }

    // =========================================================================
    // updateTransaction — realistic edit scenarios
    // =========================================================================

    @Nested
    class UpdateTransactionRealScenarios {

        @Test
        void editPurchaseOrder_increaseQtyAfterActualDelivery() {
            // PO was created for 50 but actual delivery was 60
            inventoryService.handleTransaction(item, bd("50"), InventoryTransactionType.PURCHASE); // 50
            inventoryService.updateTransaction(item, bd("50"), InventoryTransactionType.PURCHASE, bd("60"));
            assertEquals(bd("60"), currentStock());
        }

        @Test
        void editPurchaseOrder_decreaseQtyAfterPartialDelivery() {
            // PO was for 50 but only 40 units arrived
            inventoryService.handleTransaction(item, bd("50"), InventoryTransactionType.PURCHASE); // 50
            inventoryService.updateTransaction(item, bd("50"), InventoryTransactionType.PURCHASE, bd("40"));
            assertEquals(bd("40"), currentStock());
        }

        @Test
        void editIssue_increaseQty_stockDecreasesCorrectly() {
            // 80 in stock, issued 20 to lab A, then added 5 more to the same issue
            inventoryService.handleTransaction(item, bd("80"), InventoryTransactionType.PURCHASE); // 80
            inventoryService.handleTransaction(item, bd("20"), InventoryTransactionType.ISSUE);    // 60
            inventoryService.updateTransaction(item, bd("20"), InventoryTransactionType.ISSUE, bd("25"));
            // undo ISSUE(20) → 80; apply ISSUE(25) → 55
            assertEquals(bd("55"), currentStock());
        }

        @Test
        void editLoan_removeItem_stockRecovers() {
            // Loan was created for 10 units but then the item was removed from the loan
            inventoryService.handleTransaction(item, bd("30"), InventoryTransactionType.PURCHASE); // 30
            inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.LOAN);     // 20
            inventoryService.updateTransaction(item, bd("10"), InventoryTransactionType.LOAN, BigDecimal.ZERO);
            assertEquals(bd("30"), currentStock());
        }

        @Test
        void editReturn_increaseReturnedQty_stockIncreasesCorrectly() {
            // Initially recorded 7 units returned; corrected to 9
            inventoryService.handleTransaction(item, bd("50"), InventoryTransactionType.PURCHASE); // 50
            inventoryService.handleTransaction(item, bd("10"), InventoryTransactionType.LOAN);     // 40
            inventoryService.handleTransaction(item, bd("7"), InventoryTransactionType.RETURN);    // 47
            inventoryService.updateTransaction(item, bd("7"), InventoryTransactionType.RETURN, bd("9"));
            // undo RETURN(7) → 40; apply RETURN(9) → 49
            assertEquals(bd("49"), currentStock());
        }

        @Test
        void completeWorkflow_purchase_loan_return_editReturn() {
            // Full workflow: purchase → loan → partial return → edit return to full return
            inventoryService.handleTransaction(item, bd("20"), InventoryTransactionType.PURCHASE); // 20
            inventoryService.handleTransaction(item, bd("8"), InventoryTransactionType.LOAN);      // 12
            inventoryService.handleTransaction(item, bd("5"), InventoryTransactionType.RETURN);    // 17
            // Student found the remaining 3 items and now returns all 8
            inventoryService.updateTransaction(item, bd("5"), InventoryTransactionType.RETURN, bd("8"));
            // undo RETURN(5) → 14; apply RETURN(8) → 20
            assertEquals(bd("20"), currentStock());
        }
    }
}
