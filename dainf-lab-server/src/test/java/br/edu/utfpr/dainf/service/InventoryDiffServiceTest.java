package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.inventory.InventoryLineItem;
import br.edu.utfpr.dainf.model.Item;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InventoryDiffServiceTest {

    @Mock InventoryService inventoryService;

    InventoryDiffService service;

    long itemIdSeq = 1;

    @BeforeEach
    void setUp() {
        service = new InventoryDiffService(inventoryService);
    }

    // --- helpers ---

    Item item() {
        Item i = new Item();
        i.setId(itemIdSeq++);
        return i;
    }

    InventoryLineItem lineItem(Item item, String qty) {
        return new InventoryLineItem() {
            @Override public Item getItem() { return item; }
            @Override public BigDecimal inventoryQuantity() { return new BigDecimal(qty); }
        };
    }

    static BigDecimal bd(String v) { return new BigDecimal(v); }

    // =========================================================================
    // New items (not in old list)
    // =========================================================================

    @Nested
    class NewItems {

        @Test
        void singleNewItem_callsUpdateTransactionWithZeroOldQty() {
            Item item = item();
            service.applyDiff(1L, List.of(), List.of(lineItem(item, "10")), InventoryTransactionType.ISSUE);

            verify(inventoryService).updateTransaction(item, bd("0"), InventoryTransactionType.ISSUE, bd("10"), 1L);
        }

        @Test
        void multipleNewItems_eachCalledIndependently() {
            Item a = item(), b = item();
            service.applyDiff(1L, List.of(), List.of(lineItem(a, "5"), lineItem(b, "8")), InventoryTransactionType.LOAN);

            verify(inventoryService).updateTransaction(a, bd("0"), InventoryTransactionType.LOAN, bd("5"), 1L);
            verify(inventoryService).updateTransaction(b, bd("0"), InventoryTransactionType.LOAN, bd("8"), 1L);
        }

        @Test
        void referenceIdPropagatedToEachCall() {
            Item item = item();
            service.applyDiff(42L, List.of(), List.of(lineItem(item, "3")), InventoryTransactionType.PURCHASE);

            verify(inventoryService).updateTransaction(item, bd("0"), InventoryTransactionType.PURCHASE, bd("3"), 42L);
        }

        @Test
        void nullEntityId_propagatedAsNull() {
            Item item = item();
            service.applyDiff(null, List.of(), List.of(lineItem(item, "7")), InventoryTransactionType.ISSUE);

            verify(inventoryService).updateTransaction(item, bd("0"), InventoryTransactionType.ISSUE, bd("7"), null);
        }
    }

    // =========================================================================
    // Removed items (in old list but not in new)
    // =========================================================================

    @Nested
    class RemovedItems {

        @Test
        void singleRemovedItem_callsUpdateTransactionWithZeroNewQty() {
            Item item = item();
            service.applyDiff(1L, List.of(lineItem(item, "10")), List.of(), InventoryTransactionType.ISSUE);

            verify(inventoryService).updateTransaction(item, bd("10"), InventoryTransactionType.ISSUE, bd("0"), null);
        }

        @Test
        void removedItemPassesNoReferenceId() {
            Item item = item();
            service.applyDiff(5L, List.of(lineItem(item, "10")), List.of(), InventoryTransactionType.PURCHASE);

            // Removed items undo with no referenceId (4-arg call → null referenceId via 5-arg)
            verify(inventoryService).updateTransaction(item, bd("10"), InventoryTransactionType.PURCHASE, bd("0"), null);
        }

        @Test
        void multipleRemovedItems_eachUndoneIndependently() {
            Item a = item(), b = item();
            service.applyDiff(1L,
                    List.of(lineItem(a, "5"), lineItem(b, "8")),
                    List.of(),
                    InventoryTransactionType.LOAN);

            verify(inventoryService).updateTransaction(a, bd("5"), InventoryTransactionType.LOAN, bd("0"), null);
            verify(inventoryService).updateTransaction(b, bd("8"), InventoryTransactionType.LOAN, bd("0"), null);
        }

        @Test
        void partialRemoval_removedItemUndone_remainingItemUpdated() {
            Item a = item(), b = item();
            service.applyDiff(1L,
                    List.of(lineItem(a, "5"), lineItem(b, "3")),
                    List.of(lineItem(a, "5")),  // b removed
                    InventoryTransactionType.ISSUE);

            verify(inventoryService).updateTransaction(a, bd("5"), InventoryTransactionType.ISSUE, bd("5"), 1L);
            verify(inventoryService).updateTransaction(b, bd("3"), InventoryTransactionType.ISSUE, bd("0"), null);
        }
    }

    // =========================================================================
    // Updated items (in both old and new list, different qty)
    // =========================================================================

    @Nested
    class UpdatedItems {

        @Test
        void increasedQty_callsUpdateTransactionWithOldAndNewQty() {
            Item item = item();
            service.applyDiff(1L,
                    List.of(lineItem(item, "5")),
                    List.of(lineItem(item, "10")),
                    InventoryTransactionType.ISSUE);

            verify(inventoryService).updateTransaction(item, bd("5"), InventoryTransactionType.ISSUE, bd("10"), 1L);
        }

        @Test
        void decreasedQty_callsUpdateTransactionWithOldAndNewQty() {
            Item item = item();
            service.applyDiff(2L,
                    List.of(lineItem(item, "10")),
                    List.of(lineItem(item, "3")),
                    InventoryTransactionType.LOAN);

            verify(inventoryService).updateTransaction(item, bd("10"), InventoryTransactionType.LOAN, bd("3"), 2L);
        }

        @Test
        void sameQty_callsUpdateTransactionWithSameOldAndNewQty() {
            Item item = item();
            service.applyDiff(1L,
                    List.of(lineItem(item, "7")),
                    List.of(lineItem(item, "7")),
                    InventoryTransactionType.PURCHASE);

            // InventoryService.updateTransaction handles case 4 (both same → no-op internally)
            verify(inventoryService).updateTransaction(item, bd("7"), InventoryTransactionType.PURCHASE, bd("7"), 1L);
        }
    }

    // =========================================================================
    // Empty lists
    // =========================================================================

    @Nested
    class EmptyLists {

        @Test
        void bothEmpty_noInteractionWithInventoryService() {
            service.applyDiff(1L, List.of(), List.of(), InventoryTransactionType.ISSUE);

            verifyNoInteractions(inventoryService);
        }

        @Test
        void emptyOldItems_newItemsTreatedAsNew() {
            Item item = item();
            service.applyDiff(1L, List.of(), List.of(lineItem(item, "5")), InventoryTransactionType.LOAN);

            verify(inventoryService).updateTransaction(item, bd("0"), InventoryTransactionType.LOAN, bd("5"), 1L);
            verifyNoMoreInteractions(inventoryService);
        }

        @Test
        void emptyNewItems_oldItemsTreatedAsRemoved() {
            Item item = item();
            service.applyDiff(1L, List.of(lineItem(item, "5")), List.of(), InventoryTransactionType.ISSUE);

            verify(inventoryService).updateTransaction(item, bd("5"), InventoryTransactionType.ISSUE, bd("0"), null);
            verifyNoMoreInteractions(inventoryService);
        }
    }

    // =========================================================================
    // Mixed scenarios (new + updated + removed in one call)
    // =========================================================================

    @Nested
    class MixedScenarios {

        @Test
        void addedUpdatedAndRemoved_allHandledCorrectly() {
            Item existing = item(), updated = item(), removed = item();

            service.applyDiff(10L,
                    List.of(lineItem(updated, "5"), lineItem(removed, "3")),
                    List.of(lineItem(existing, "8"), lineItem(updated, "12")),
                    InventoryTransactionType.ISSUE);

            // 'existing' is new (not in old list) → zero old qty
            verify(inventoryService).updateTransaction(existing, bd("0"), InventoryTransactionType.ISSUE, bd("8"), 10L);
            // 'updated' changed qty
            verify(inventoryService).updateTransaction(updated, bd("5"), InventoryTransactionType.ISSUE, bd("12"), 10L);
            // 'removed' not in new list → zero new qty
            verify(inventoryService).updateTransaction(removed, bd("3"), InventoryTransactionType.ISSUE, bd("0"), null);
            verifyNoMoreInteractions(inventoryService);
        }

        @Test
        void transactionTypeForwardedCorrectly_return() {
            Item item = item();
            service.applyDiff(1L, List.of(), List.of(lineItem(item, "4")), InventoryTransactionType.RETURN);

            verify(inventoryService).updateTransaction(item, bd("0"), InventoryTransactionType.RETURN, bd("4"), 1L);
        }

        @Test
        void transactionTypeForwardedCorrectly_purchase() {
            Item item = item();
            service.applyDiff(1L, List.of(), List.of(lineItem(item, "100")), InventoryTransactionType.PURCHASE);

            verify(inventoryService).updateTransaction(item, bd("0"), InventoryTransactionType.PURCHASE, bd("100"), 1L);
        }
    }
}
