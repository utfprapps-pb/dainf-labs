package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.model.Issue;
import br.edu.utfpr.dainf.model.IssueItem;
import br.edu.utfpr.dainf.repository.IssueRepository;
import br.edu.utfpr.dainf.shared.CrudService;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
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
        if (entity.getId() == null) {
            entity.setUser(userService.getCurrentUser());
        }
        Issue existing = (entity.getId() != null && handleTransaction)
                ? repository.findById(entity.getId()).orElse(null)
                : null;
        if (entity.getItems() != null) {
            for (IssueItem item : entity.getItems()) {
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
