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

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PurchaseServiceTest {

    @Mock PurchaseRepository repository;
    @Mock InventoryDiffService inventoryDiffService;
    @Mock UserService userService;
    @InjectMocks PurchaseService purchaseService;

    @BeforeEach
    void injectRepository() {
        ReflectionTestUtils.setField(purchaseService, "repository", repository);
    }

    @Test
    void save_newPurchase_callsApplyDiffWithNullEntityId() {
        Item item = item(1L);
        BigDecimal qty = new BigDecimal("10");
        Purchase entity = purchase(null, item, qty);

        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        purchaseService.save(entity);

        verify(inventoryDiffService).applyDiff(isNull(), any(), any(), eq(InventoryTransactionType.PURCHASE));
    }

    @Test
    void save_updatePurchase_callsApplyDiffWithEntityId() {
        Item item = item(1L);
        Purchase existing = purchase(1L, item, new BigDecimal("10"));
        Purchase entity = purchase(1L, item, new BigDecimal("15"));

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenReturn(entity);

        purchaseService.save(entity);

        verify(inventoryDiffService).applyDiff(eq(1L), any(), any(), eq(InventoryTransactionType.PURCHASE));
    }

    @Test
    void save_updatePurchase_itemNotInExisting_callsApplyDiffWithEntityId() {
        Item newItem = item(2L);
        Purchase existing = purchase(1L, item(1L), new BigDecimal("10"));
        Purchase entity = purchase(1L, newItem, new BigDecimal("8"));

        when(repository.findById(1L)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenReturn(entity);

        purchaseService.save(entity);

        verify(inventoryDiffService).applyDiff(eq(1L), any(), any(), eq(InventoryTransactionType.PURCHASE));
    }

    @Test
    void save_noItems_applyDiffCalledWithEmptyNewList() {
        Purchase entity = new Purchase();
        entity.setDate(Instant.now());
        entity.setItems(List.of());

        when(userService.getCurrentUser()).thenReturn(new User());
        when(repository.save(any())).thenReturn(entity);

        purchaseService.save(entity);

        verify(inventoryDiffService).applyDiff(any(), any(), eq(List.of()), eq(InventoryTransactionType.PURCHASE));
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
