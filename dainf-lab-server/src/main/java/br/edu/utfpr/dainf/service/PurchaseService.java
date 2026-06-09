package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.model.Purchase;
import br.edu.utfpr.dainf.model.PurchaseItem;
import br.edu.utfpr.dainf.repository.PurchaseRepository;
import br.edu.utfpr.dainf.shared.CrudService;
import br.edu.utfpr.dainf.shared.ItemListValidator;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Service
public class PurchaseService extends CrudService<Long, Purchase, PurchaseRepository> {

    private final InventoryService inventoryService;
    private final UserService userService;

    public PurchaseService(InventoryService inventoryService, UserService userService) {
        this.inventoryService = inventoryService;
        this.userService = userService;
    }

    @Override
    public JpaSpecificationExecutor<Purchase> getSpecExecutor() {
        return repository;
    }

    @Override
    public Purchase save(Purchase entity) {
        ItemListValidator.validateNoDuplicates(entity.getItems(), i -> i.getItem().getId());
        if (entity.getId() == null) {
            entity.setUser(userService.getCurrentUser());
        }
        Purchase existing = entity.getId() != null ? repository.findById(entity.getId()).orElse(null) : null;
        List<PurchaseItem> newItems = entity.getItems() != null ? entity.getItems() : List.of();
        for (PurchaseItem item : newItems) {
            item.setPurchase(entity);
            PurchaseItem oldItem = findOldItem(existing, item);
            inventoryService.updateTransaction(
                    item.getItem(),
                    oldItem != null ? oldItem.getQuantity() : BigDecimal.ZERO,
                    InventoryTransactionType.PURCHASE,
                    item.getQuantity()
            );
        }
        // Undo inventory for items removed from the purchase entirely (not just set to 0)
        if (existing != null && existing.getItems() != null) {
            for (PurchaseItem oldItem : existing.getItems()) {
                boolean stillPresent = newItems.stream()
                        .anyMatch(i -> Objects.equals(i.getItem().getId(), oldItem.getItem().getId()));
                if (!stillPresent) {
                    inventoryService.updateTransaction(
                            oldItem.getItem(),
                            oldItem.getQuantity(),
                            InventoryTransactionType.PURCHASE,
                            BigDecimal.ZERO
                    );
                }
            }
        }
        return super.save(entity);
    }

    private PurchaseItem findOldItem(Purchase existing, PurchaseItem current) {
        if (existing == null || existing.getItems() == null) return null;
        return existing.getItems().stream()
                .filter(i -> Objects.equals(i.getItem().getId(), current.getItem().getId()))
                .findFirst()
                .orElse(null);
    }
}
