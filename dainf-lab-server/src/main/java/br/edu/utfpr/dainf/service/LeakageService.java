package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.model.Leakage;
import br.edu.utfpr.dainf.model.LeakageItem;
import br.edu.utfpr.dainf.repository.LeakageRepository;
import br.edu.utfpr.dainf.shared.CrudService;
import br.edu.utfpr.dainf.shared.ItemListValidator;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Service
public class LeakageService extends CrudService<Long, Leakage, LeakageRepository> {

    private final InventoryService inventoryService;
    private final UserService userService;
    private final ItemService itemService;
    private final LoanService loanService;

    public LeakageService(InventoryService inventoryService, UserService userService, ItemService itemService, LoanService loanService) {
        this.inventoryService = inventoryService;
        this.userService = userService;
        this.itemService = itemService;
        this.loanService = loanService;
    }

    @Override
    public JpaSpecificationExecutor<Leakage> getSpecExecutor() {
        return repository;
    }

    @Override
    public Leakage save(Leakage entity) {
        return save(entity, true);
    }

    public Leakage save(Leakage entity, boolean handleTransaction) {
        ItemListValidator.validateNoDuplicates(entity.getItems(), i -> i.getItem().getId());
        if (entity.getId() == null) {
            entity.setUser(userService.getCurrentUser());
        }
        Leakage existing = (entity.getId() != null && handleTransaction)
                ? repository.findById(entity.getId()).orElse(null)
                : null;
        List<LeakageItem> newItems = entity.getItems() != null ? entity.getItems() : List.of();
        for (LeakageItem item : newItems) {
            BigDecimal loanedQty = loanService.getLoanedQuantityForItem(item.getItem().getId());
            if (loanedQty != null && item.getQuantity().compareTo(loanedQty) >= 0) {
                throw new IllegalArgumentException("Não é possível registrar extravio: a quantidade (" + item.getQuantity() + ") deve ser menor que a quantidade atualmente emprestada deste item (" + loanedQty + ").");
            }

            item.setLeakage(entity);
            if (handleTransaction) {
                LeakageItem oldItem = findOldItem(existing, item);
                inventoryService.updateTransaction(
                        item.getItem(),
                        oldItem != null ? oldItem.getQuantity() : BigDecimal.ZERO,
                        InventoryTransactionType.LEAKAGE,
                        item.getQuantity()
                );

                br.edu.utfpr.dainf.model.Item i = itemService.findById(item.getItem().getId()).orElseThrow();
                BigDecimal oldQty = oldItem != null ? oldItem.getQuantity() : BigDecimal.ZERO;
                BigDecimal diff = item.getQuantity().subtract(oldQty);
                if (diff.compareTo(BigDecimal.ZERO) != 0) {
                    BigDecimal currentMinStock = i.getMinimumStock() != null ? i.getMinimumStock() : BigDecimal.ZERO;
                    i.setMinimumStock(currentMinStock.subtract(diff)); // Subtract for leakage
                    itemService.save(i);
                }
            }
        }
        // Undo inventory for items removed from the Leakage entirely (not just set to 0)
        if (handleTransaction && existing != null && existing.getItems() != null) {
            for (LeakageItem oldItem : existing.getItems()) {
                boolean stillPresent = newItems.stream()
                        .anyMatch(i -> Objects.equals(i.getItem().getId(), oldItem.getItem().getId()));
                if (!stillPresent) {
                    inventoryService.updateTransaction(
                            oldItem.getItem(),
                            oldItem.getQuantity(),
                            InventoryTransactionType.LEAKAGE,
                            BigDecimal.ZERO
                    );

                    br.edu.utfpr.dainf.model.Item i = itemService.findById(oldItem.getItem().getId()).orElseThrow();
                    BigDecimal currentMinStock = i.getMinimumStock() != null ? i.getMinimumStock() : BigDecimal.ZERO;
                    i.setMinimumStock(currentMinStock.add(oldItem.getQuantity())); // Revert leakage
                    itemService.save(i);
                }
            }
        }
        return super.save(entity);
    }

    private LeakageItem findOldItem(Leakage existing, LeakageItem current) {
        if (existing == null || existing.getItems() == null) return null;
        return existing.getItems().stream()
                .filter(i -> Objects.equals(i.getItem().getId(), current.getItem().getId()))
                .findFirst()
                .orElse(null);
    }
}
