package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.exception.InvalidTransactionException;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.inventory.auditor.TransactionAuditor;
import br.edu.utfpr.dainf.model.*;
import br.edu.utfpr.dainf.repository.InventoryRepository;
import br.edu.utfpr.dainf.repository.PurchaseRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests for PurchaseService that verify actual inventory quantity changes.
 * Uses a real InventoryService wired with a stateful in-memory store so every
 * assertion checks the resulting stock — not just which method was called.
 */
@ExtendWith(MockitoExtension.class)
class PurchaseServiceInventoryTest {

    @Mock PurchaseRepository purchaseRepository;
    @Mock InventoryRepository inventoryRepository;
    @Mock ConfigurationService configurationService;
    @Mock TransactionAuditor auditor;
    @Mock UserService userService;
    @Mock ItemService itemService;

    InventoryService inventoryService;
    @InjectMocks PurchaseService purchaseService;

    final Map<Long, Inventory> store = new HashMap<>();
    long idSeq = 1;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        store.clear();
        idSeq = 1;

        inventoryService = new InventoryService(auditor, configurationService);
        ReflectionTestUtils.setField(inventoryService, "repository", inventoryRepository);

        purchaseService = new PurchaseService(inventoryService, userService, itemService);
        ReflectionTestUtils.setField(purchaseService, "repository", purchaseRepository);

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
        lenient().when(purchaseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
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

    Purchase newPurchase(PurchaseItem... items) {
        Purchase p = new Purchase();
        p.setDate(Instant.now());
        p.setItems(new ArrayList<>(List.of(items)));
        return p;
    }

    Purchase existingPurchase(Long id, PurchaseItem... items) {
        Purchase p = newPurchase(items);
        p.setId(id);
        return p;
    }

    PurchaseItem pi(Item item, String qty) {
        PurchaseItem pi = new PurchaseItem();
        pi.setItem(item);
        pi.setQuantity(new BigDecimal(qty));
        pi.setPrice(BigDecimal.ONE);
        return pi;
    }

    static BigDecimal bd(String v) { return new BigDecimal(v); }

    // =========================================================================
    // New purchase (id = null)
    // =========================================================================

    @Nested
    class NewPurchase {

        @Test
        void singleItem_stockCreated() {
            Item item = item();
            purchaseService.save(newPurchase(pi(item, "50")));
            assertEquals(bd("50"), stockOf(item));
        }

        @Test
        void multipleItems_eachItemStockCreatedIndependently() {
            Item a = item(), b = item(), c = item();
            purchaseService.save(newPurchase(pi(a, "10"), pi(b, "25"), pi(c, "5")));
            assertEquals(bd("10"), stockOf(a));
            assertEquals(bd("25"), stockOf(b));
            assertEquals(bd("5"),  stockOf(c));
        }

        @Test
        void addsOnTopOfExistingStock() {
            Item item = item();
            givenStock(item, "30");
            purchaseService.save(newPurchase(pi(item, "20")));
            assertEquals(bd("50"), stockOf(item));
        }

        @Test
        void emptyItemsList_noInventoryInteraction() {
            Purchase p = new Purchase();
            p.setDate(Instant.now());
            p.setItems(List.of());
            purchaseService.save(p);
            verifyNoInteractions(inventoryRepository);
        }

        @Test
        void twoPurchasesOfSameItem_stockAccumulates() {
            Item item = item();
            purchaseService.save(newPurchase(pi(item, "30")));
            purchaseService.save(newPurchase(pi(item, "20")));
            assertEquals(bd("50"), stockOf(item));
        }

        @Test
        void twoPurchasesOfDifferentItems_stockTrackedSeparately() {
            Item a = item(), b = item();
            purchaseService.save(newPurchase(pi(a, "40")));
            purchaseService.save(newPurchase(pi(b, "15")));
            assertEquals(bd("40"), stockOf(a));
            assertEquals(bd("15"), stockOf(b));
        }
    }

    // =========================================================================
    // Update purchase (id != null) — quantity adjustments
    // =========================================================================

    @Nested
    class UpdatePurchase {

        @Test
        void increaseQty_stockAdjustsUp() {
            Item item = item();
            givenStock(item, "30");
            Purchase existing = existingPurchase(1L, pi(item, "30"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(existing));

            purchaseService.save(existingPurchase(1L, pi(item, "50")));

            assertEquals(bd("50"), stockOf(item));
        }

        @Test
        void decreaseQty_stockAdjustsDown() {
            Item item = item();
            givenStock(item, "30");
            Purchase existing = existingPurchase(1L, pi(item, "30"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(existing));

            purchaseService.save(existingPurchase(1L, pi(item, "20")));

            assertEquals(bd("20"), stockOf(item));
        }

        @Test
        void setQtyToZero_stockReverts() {
            Item item = item();
            givenStock(item, "30");
            Purchase existing = existingPurchase(1L, pi(item, "30"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(existing));

            purchaseService.save(existingPurchase(1L, pi(item, "0")));

            assertEquals(bd("0"), stockOf(item));
        }

        @Test
        void newItemAdded_newItemStockCreated_existingItemUnchanged() {
            Item a = item(), b = item();
            givenStock(a, "30");
            Purchase existing = existingPurchase(1L, pi(a, "30"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(existing));

            purchaseService.save(existingPurchase(1L, pi(a, "30"), pi(b, "15")));

            assertEquals(bd("30"), stockOf(a));
            assertEquals(bd("15"), stockOf(b));
        }

        @Test
        void sameQty_noInventorySave() {
            Item item = item();
            givenStock(item, "30");
            Purchase existing = existingPurchase(1L, pi(item, "30"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(existing));

            purchaseService.save(existingPurchase(1L, pi(item, "30")));

            assertEquals(bd("30"), stockOf(item));
            verify(inventoryRepository, never()).save(any());
        }

        @Test
        void multipleItemsUpdated_eachStockAdjustedIndependently() {
            Item a = item(), b = item();
            givenStock(a, "20");
            givenStock(b, "10");
            Purchase existing = existingPurchase(1L, pi(a, "20"), pi(b, "10"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(existing));

            purchaseService.save(existingPurchase(1L, pi(a, "35"), pi(b, "5")));

            assertEquals(bd("35"), stockOf(a));
            assertEquals(bd("5"),  stockOf(b));
        }

        @Test
        void existingPurchaseNotFound_treatsAllItemsAsNew() {
            Item item = item();
            when(purchaseRepository.findById(1L)).thenReturn(Optional.empty());

            purchaseService.save(existingPurchase(1L, pi(item, "40")));

            // No old qty found → treated as brand-new → stock = 40
            assertEquals(bd("40"), stockOf(item));
        }

        @Test
        void itemReplaced_oldItemStockReverted_newItemStockCreated() {
            // Replace item A with item B: A's contribution must be undone, B's must be added.
            // PurchaseService only loops over entity.getItems(), so A (no longer present) must
            // be handled correctly. This test will FAIL if PurchaseService has a bug where
            // removed items are not reverted.
            Item a = item(), b = item();
            givenStock(a, "30");
            Purchase existing = existingPurchase(1L, pi(a, "30"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(existing));

            // Update: A removed from list, B added
            purchaseService.save(existingPurchase(1L, pi(b, "20")));

            assertEquals(bd("0"),  stockOf(a), "stock of removed item must be reverted");
            assertEquals(bd("20"), stockOf(b), "stock of new item must be created");
        }
    }

    // =========================================================================
    // Duplicate item validation
    // =========================================================================

    @Nested
    class DuplicateItemValidation {

        @Test
        void duplicateItemInNewPurchase_throwsWarnException() {
            Item item = item();
            givenStock(item, "0");
            assertThrows(WarnException.class,
                    () -> purchaseService.save(newPurchase(pi(item, "10"), pi(item, "5"))));
        }

        @Test
        void duplicateItemInUpdatePurchase_throwsWarnException() {
            Item item = item();
            givenStock(item, "30");
            // no findById stub needed — validator fires before the repo is queried
            assertThrows(WarnException.class,
                    () -> purchaseService.save(existingPurchase(1L, pi(item, "20"), pi(item, "10"))));
        }

        @Test
        void duplicateAmongMultipleItems_throwsWarnException() {
            Item a = item(), b = item();
            givenStock(a, "0");
            givenStock(b, "0");
            assertThrows(WarnException.class,
                    () -> purchaseService.save(newPurchase(pi(a, "10"), pi(b, "5"), pi(a, "3"))));
        }

        @Test
        void noDuplicates_saveProceedsNormally() {
            Item a = item(), b = item();
            assertDoesNotThrow(() -> purchaseService.save(newPurchase(pi(a, "10"), pi(b, "20"))));
            assertEquals(bd("10"), stockOf(a));
            assertEquals(bd("20"), stockOf(b));
        }

        @Test
        void duplicateStockNotModified_exceptionBeforeInventoryChange() {
            Item item = item();
            givenStock(item, "50");
            assertThrows(WarnException.class,
                    () -> purchaseService.save(newPurchase(pi(item, "10"), pi(item, "5"))));
            assertEquals(bd("50"), stockOf(item));
            verify(inventoryRepository, never()).save(any());
        }
    }

    // =========================================================================
    // Realistic correction workflows
    // =========================================================================

    @Nested
    class CorrectionWorkflows {

        @Test
        void correctPurchaseDown_actualDeliveryLessThanOrdered() {
            Item item = item();
            // PO created for 50 units
            purchaseService.save(newPurchase(pi(item, "50")));
            // Only 40 arrived: correct the PO
            Purchase existing = existingPurchase(1L, pi(item, "50"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(existing));

            purchaseService.save(existingPurchase(1L, pi(item, "40")));

            assertEquals(bd("40"), stockOf(item));
        }

        @Test
        void correctPurchaseUp_moreItemsArrivedThanOrdered() {
            Item item = item();
            purchaseService.save(newPurchase(pi(item, "50")));
            Purchase existing = existingPurchase(1L, pi(item, "50"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(existing));

            purchaseService.save(existingPurchase(1L, pi(item, "60")));

            assertEquals(bd("60"), stockOf(item));
        }

        @Test
        void multiplePurchasesCorrected_netStockIsCorrect() {
            Item item = item();
            // PO 1: 30 units
            purchaseService.save(newPurchase(pi(item, "30")));   // stock = 30
            // PO 2: 20 units
            purchaseService.save(newPurchase(pi(item, "20")));   // stock = 50
            // Correct PO 1 down to 25
            Purchase po1 = existingPurchase(1L, pi(item, "30"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(po1));
            purchaseService.save(existingPurchase(1L, pi(item, "25")));
            // stock = 50 - 5 = 45
            assertEquals(bd("45"), stockOf(item));
        }
    }
}
