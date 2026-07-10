package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.annotation.TransactsInventory;
import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.model.Purchase;
import br.edu.utfpr.dainf.model.PurchaseItem;
import br.edu.utfpr.dainf.repository.PurchaseRepository;
import br.edu.utfpr.dainf.shared.CrudService;
import br.edu.utfpr.dainf.shared.ItemListValidator;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class PurchaseService extends CrudService<Long, Purchase, PurchaseRepository> {

    private final InventoryDiffService inventoryDiffService;
    private final UserService userService;

    public PurchaseService(InventoryDiffService inventoryDiffService, UserService userService) {
        this.inventoryDiffService = inventoryDiffService;
        this.userService = userService;
    }

    @Override
    public JpaSpecificationExecutor<Purchase> getSpecExecutor() {
        return repository;
    }

    @Override
    @TransactsInventory(type = InventoryTransactionType.PURCHASE)
    public Purchase save(Purchase entity) {
        ItemListValidator.validateNoDuplicates(entity.getItems(), i -> i.getItem().getId());
        if (entity.getId() == null) {
            entity.setUser(userService.getCurrentUser());
        }

        Purchase existing = entity.getId() != null ? repository.findById(entity.getId()).orElse(null) : null;
        List<PurchaseItem> oldItems = existing != null ? new ArrayList<>(existing.getItems()) : List.of();

        for (PurchaseItem item : entity.getItems()) {
            item.setPurchase(entity);
        }

        Purchase saved = super.save(entity);

        inventoryDiffService.applyDiff(saved.getId(), oldItems, saved.getItems(), InventoryTransactionType.PURCHASE);

        return saved;
    }
}
