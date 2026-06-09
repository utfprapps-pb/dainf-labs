package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.model.Issue;
import br.edu.utfpr.dainf.model.IssueItem;
import br.edu.utfpr.dainf.repository.IssueRepository;
import br.edu.utfpr.dainf.shared.CrudService;
import br.edu.utfpr.dainf.shared.ItemListValidator;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;

@Service
public class IssueService extends CrudService<Long, Issue, IssueRepository> {

    private final InventoryService inventoryService;
    private final UserService userService;

    public IssueService(InventoryService inventoryService, UserService userService) {
        this.inventoryService = inventoryService;
        this.userService = userService;
    }

    @Override
    public JpaSpecificationExecutor<Issue> getSpecExecutor() {
        return repository;
    }

    @Override
    public Issue save(Issue entity) {
        return save(entity, true);
    }

    public Issue save(Issue entity, boolean handleTransaction) {
        ItemListValidator.validateNoDuplicates(entity.getItems(), i -> i.getItem().getId());
        if (entity.getId() == null) {
            entity.setUser(userService.getCurrentUser());
        }
        Issue existing = (entity.getId() != null && handleTransaction)
                ? repository.findById(entity.getId()).orElse(null)
                : null;
        List<IssueItem> newItems = entity.getItems() != null ? entity.getItems() : List.of();
        for (IssueItem item : newItems) {
            item.setIssue(entity);
            if (handleTransaction) {
                IssueItem oldItem = findOldItem(existing, item);
                inventoryService.updateTransaction(
                        item.getItem(),
                        oldItem != null ? oldItem.getQuantity() : BigDecimal.ZERO,
                        InventoryTransactionType.ISSUE,
                        item.getQuantity()
                );
            }
        }
        // Undo inventory for items removed from the issue entirely (not just set to 0)
        if (handleTransaction && existing != null && existing.getItems() != null) {
            for (IssueItem oldItem : existing.getItems()) {
                boolean stillPresent = newItems.stream()
                        .anyMatch(i -> Objects.equals(i.getItem().getId(), oldItem.getItem().getId()));
                if (!stillPresent) {
                    inventoryService.updateTransaction(
                            oldItem.getItem(),
                            oldItem.getQuantity(),
                            InventoryTransactionType.ISSUE,
                            BigDecimal.ZERO
                    );
                }
            }
        }
        return super.save(entity);
    }

    private IssueItem findOldItem(Issue existing, IssueItem current) {
        if (existing == null || existing.getItems() == null) return null;
        return existing.getItems().stream()
                .filter(i -> Objects.equals(i.getItem().getId(), current.getItem().getId()))
                .findFirst()
                .orElse(null);
    }
}
