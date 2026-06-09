package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.Purchase;
import br.edu.utfpr.dainf.model.PurchaseItem;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.PurchaseRepository;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PurchaseServiceTest {

    @Mock PurchaseRepository repository;
    @Mock InventoryService inventoryService;
    @Mock UserService userService;
    @InjectMocks PurchaseService purchaseService;

    @BeforeEach
    void injectRepository() {
        ReflectionTestUtils.setField(purchaseService, "repository", repository);
    }

    @Test
    void save_newPurchase_callsUpdateTransactionWithZeroOldQty() {
        Item item = item(1L);
        BigDecimal qty = new BigDecimal("10");
        Purchase entity = purchase(null, item, qty);

        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        purchaseService.save(entity);

        verify(inventoryService).updateTransaction(item, BigDecimal.ZERO, InventoryTransactionType.PURCHASE, qty);
    }

    @Test
    void save_updatePurchase_callsUpdateTransactionWithOldQty() {
        Item item = item(1L);
        BigDecimal oldQty = new BigDecimal("10");
        BigDecimal newQty = new BigDecimal("15");
        Purchase existing = purchase(1L, item, oldQty);
        Purchase entity = purchase(1L, item, newQty);

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenReturn(entity);

        purchaseService.save(entity);

        verify(inventoryService).updateTransaction(item, oldQty, InventoryTransactionType.PURCHASE, newQty);
    }

    @Test
    void save_updatePurchase_itemNotInExisting_callsUpdateTransactionWithZeroOldQty() {
        Item newItem = item(2L);
        BigDecimal qty = new BigDecimal("8");
        Purchase existing = purchase(1L, item(1L), new BigDecimal("10"));
        Purchase entity = purchase(1L, newItem, qty);

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenReturn(entity);

        purchaseService.save(entity);

        verify(inventoryService).updateTransaction(newItem, BigDecimal.ZERO, InventoryTransactionType.PURCHASE, qty);
    }

    @Test
    void save_noItems_noInventoryInteraction() {
        Purchase entity = new Purchase();
        entity.setDate(Instant.now());
        entity.setItems(List.of());

        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        purchaseService.save(entity);

        verifyNoInteractions(inventoryService);
    }

    // --- helpers ---

    private Item item(Long id) {
        Item item = new Item();
        item.setId(id);
        return item;
    }

    private PurchaseItem purchaseItem(Item item, BigDecimal qty) {
        PurchaseItem i = new PurchaseItem();
        i.setItem(item);
        i.setQuantity(qty);
        i.setPrice(BigDecimal.ONE);
        return i;
    }

    private Purchase purchase(Long id, Item item, BigDecimal qty) {
        Purchase purchase = new Purchase();
        purchase.setId(id);
        purchase.setDate(Instant.now());
        purchase.setItems(List.of(purchaseItem(item, qty)));
        return purchase;
    }
}
