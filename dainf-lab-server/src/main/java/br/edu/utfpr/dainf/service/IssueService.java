package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.annotation.TransactsInventory;
import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.model.Issue;
import br.edu.utfpr.dainf.model.IssueItem;
import br.edu.utfpr.dainf.repository.IssueRepository;
import br.edu.utfpr.dainf.shared.CrudService;
import br.edu.utfpr.dainf.shared.ItemListValidator;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class IssueService extends CrudService<Long, Issue, IssueRepository> {

    private final InventoryDiffService inventoryDiffService;
    private final UserService userService;

    public IssueService(InventoryDiffService inventoryDiffService, UserService userService) {
        this.inventoryDiffService = inventoryDiffService;
        this.userService = userService;
    }

    @Override
    public JpaSpecificationExecutor<Issue> getSpecExecutor() {
        return repository;
    }

    @Override
    @Transactional
    @TransactsInventory(type = InventoryTransactionType.ISSUE)
    public Issue save(Issue entity) {
        return save(entity, true);
    }

    @Transactional
    public Issue save(Issue entity, boolean handleTransaction) {
        ItemListValidator.validateNoDuplicates(entity.getItems(), i -> i.getItem().getId());
        if (entity.getId() == null) {
            entity.setUser(userService.getCurrentUser());
        }

        Issue existing = (entity.getId() != null && handleTransaction)
                ? repository.findById(entity.getId()).orElse(null)
                : null;
        List<IssueItem> oldItems = existing != null ? new ArrayList<>(existing.getItems()) : List.of();

        for (IssueItem item : entity.getItems()) {
            item.setIssue(entity);
        }

        Issue saved = super.save(entity);

        if (handleTransaction) {
            inventoryDiffService.applyDiff(saved.getId(), oldItems, saved.getItems(), InventoryTransactionType.ISSUE);
        }

        return saved;
    }
}
