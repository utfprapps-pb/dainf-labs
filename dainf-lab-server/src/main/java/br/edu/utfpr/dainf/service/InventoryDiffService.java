package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.inventory.InventoryLineItem;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

/**
 * Encapsulates the "old vs new item diff → inventory update" pattern shared by
 * IssueService, LoanService, PurchaseService, and ReturnService.
 *
 * Callers must: capture old items before save, persist the entity (getting its ID),
 * then call applyDiff with the saved entity's ID.
 */
@Service
public class InventoryDiffService {

    private final InventoryService inventoryService;

    public InventoryDiffService(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    public <I extends InventoryLineItem> void applyDiff(
            Long entityId,
            List<I> oldItems,
            List<I> newItems,
            InventoryTransactionType type) {

        for (I newItem : newItems) {
            BigDecimal oldQty = oldItems.stream()
                    .filter(o -> Objects.equals(o.getItem().getId(), newItem.getItem().getId()))
                    .findFirst()
                    .map(InventoryLineItem::inventoryQuantity)
                    .orElse(BigDecimal.ZERO);

            inventoryService.updateTransaction(
                    newItem.getItem(), oldQty, type,
                    newItem.inventoryQuantity(), entityId);
        }

        for (I oldItem : oldItems) {
            boolean stillPresent = newItems.stream()
                    .anyMatch(n -> Objects.equals(n.getItem().getId(), oldItem.getItem().getId()));
            if (!stillPresent) {
                inventoryService.updateTransaction(
                        oldItem.getItem(), oldItem.inventoryQuantity(),
                        type, BigDecimal.ZERO, null);
            }
        }
    }

    /**
     * Records an audit trail entry per item without validating or mutating the
     * inventory balance. Used for transactions whose quantity effect is already
     * accounted for elsewhere (e.g. an ISSUE derived from a loan return).
     */
    public <I extends InventoryLineItem> void auditOnly(
            Long entityId,
            List<I> items,
            InventoryTransactionType type) {

        for (I item : items) {
            BigDecimal quantity = item.inventoryQuantity();
            if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            inventoryService.auditOnly(item.getItem(), quantity, type, entityId);
        }
    }
}
