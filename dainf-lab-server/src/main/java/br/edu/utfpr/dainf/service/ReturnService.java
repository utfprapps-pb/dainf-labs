package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.annotation.TransactsInventory;
import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.*;
import br.edu.utfpr.dainf.repository.IssueRepository;
import br.edu.utfpr.dainf.repository.ReturnRepository;
import br.edu.utfpr.dainf.shared.CrudService;
import br.edu.utfpr.dainf.shared.ItemListValidator;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class ReturnService extends CrudService<Long, Return, ReturnRepository> {

    private final InventoryDiffService inventoryDiffService;
    private final IssueRepository issueRepository;
    private final IssueService issueService;
    private final UserService userService;
    private final LoanService loanService;

    public ReturnService(InventoryDiffService inventoryDiffService, IssueRepository issueRepository, IssueService issueService, UserService userService, LoanService loanService) {
        this.inventoryDiffService = inventoryDiffService;
        this.issueRepository = issueRepository;
        this.issueService = issueService;
        this.userService = userService;
        this.loanService = loanService;
    }

    @Override
    public JpaSpecificationExecutor<Return> getSpecExecutor() {
        return repository;
    }

    @Override
    @TransactsInventory(type = InventoryTransactionType.RETURN)
    public Return save(Return entity) {
        ItemListValidator.validateNoDuplicates(entity.getItems(), i -> i.getItem().getId());

        Return existing = entity.getId() != null ? repository.findById(entity.getId()).orElse(null) : null;
        List<ReturnItem> oldItems = existing != null ? new ArrayList<>(existing.getItems()) : List.of();

        Loan loan = resolveLoan(entity);
        entity.setLoan(loan);
        validateReturnQuantities(entity, loan);

        if (entity.getItems() != null) {
            for (ReturnItem item : entity.getItems()) {
                item.setAReturn(entity);
            }
        }

        Return saved = super.save(entity);

        if (saved.getItems() != null) {
            inventoryDiffService.applyDiff(saved.getId(), oldItems, saved.getItems(), InventoryTransactionType.RETURN);
            createIssue(saved);
        }

        if (saved.getLoan() != null) {
            loanService.refreshStatus(saved.getLoan());
        }
        return saved;
    }

    public Return findByLoanId(Long loanId) {
        return repository.findByLoanId(loanId);
    }

    private void createIssue(Return entity) {
        Issue issue = findIssue(entity);
        issue.setLoan(entity.getLoan());
        issue.setDate(Instant.now());
        issue.setUser(userService.getCurrentUser());
        issue.setObservation("Registo criado a partir do empréstimo ID: " + entity.getLoan().getId());

        List<IssueItem> items = issue.getItems();
        if (items == null) {
            items = new ArrayList<>();
            issue.setItems(items);
        } else {
            items.clear();
        }

        for (ReturnItem item : entity.getItems()) {
            if (item.getQuantityIssued().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            IssueItem issueItem = new IssueItem();
            issueItem.setItem(item.getItem());
            issueItem.setQuantity(item.getQuantityIssued());
            items.add(issueItem);
        }

        issue.setItems(items);
        issueService.save(issue, false);
    }

    private Issue findIssue(Return entity) {
        return Optional.ofNullable(entity.getLoan())
                .flatMap(issueRepository::findByLoan)
                .orElse(new Issue());
    }

    private void validateReturnQuantities(Return entity, Loan loan) {
        if (entity.getItems() == null || loan.getItems() == null) return;

        for (ReturnItem returnItem : entity.getItems()) {
            if (returnItem.getItem() == null) continue;

            LoanItem loanItem = loan.getItems().stream()
                    .filter(li -> li.getItem() != null && li.getItem().getId().equals(returnItem.getItem().getId()))
                    .findFirst()
                    .orElse(null);
            if (loanItem == null) continue;

            BigDecimal returned = returnItem.getQuantityReturned() != null ? returnItem.getQuantityReturned() : BigDecimal.ZERO;
            BigDecimal issued = returnItem.getQuantityIssued() != null ? returnItem.getQuantityIssued() : BigDecimal.ZERO;
            BigDecimal total = returned.add(issued);

            if (total.compareTo(loanItem.getQuantity()) > 0) {
                throw new WarnException(String.format(
                        "A quantidade devolvida/emitida do item '%s' excede a quantidade emprestada (%s).",
                        loanItem.getItem().getName(), loanItem.getQuantity()));
            }
        }
    }

    private Loan resolveLoan(Return entity) {
        Loan loan = Optional.ofNullable(entity.getLoan())
                .orElseThrow(() -> new WarnException("É necessário informar um empréstimo."));

        if (loan.getId() == null) {
            throw new WarnException("É necessário informar um empréstimo.");
        }

        return loanService.findById(loan.getId())
                .orElseThrow(() -> new WarnException("Empréstimo não encontrado."));
    }
}
