package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.enums.LoanStatus;
import br.edu.utfpr.dainf.model.Loan;
import br.edu.utfpr.dainf.model.LoanItem;
import br.edu.utfpr.dainf.model.Solicitation;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.LoanRepository;
import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.search.request.filter.SearchFilter;
import br.edu.utfpr.dainf.repository.ReturnRepository;
import br.edu.utfpr.dainf.shared.CrudService;
import br.edu.utfpr.dainf.shared.ItemListValidator;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Objects;

@Service
public class LoanService extends CrudService<Long, Loan, LoanRepository> {

    private static final ZoneId LOAN_ZONE = ZoneId.of("America/Sao_Paulo");

    private final InventoryService inventoryService;
    private final UserService userService;
    private final ReturnRepository returnRepository;
    private final LoanMailService loanMailService;
    private final NotificationService notificationService;

    public LoanService(InventoryService inventoryService, ReturnRepository returnRepository, UserService userService, LoanMailService loanMailService, NotificationService notificationService) {
        this.inventoryService = inventoryService;
        this.returnRepository = returnRepository;
        this.userService = userService;
        this.loanMailService = loanMailService;
        this.notificationService = notificationService;
    }

    @Override
    public JpaSpecificationExecutor<Loan> getSpecExecutor() {
        return repository;
    }

    @Override
    public Page<Loan> search(SearchRequest request) {
        User currentUser = userService.getCurrentUser();

        boolean isRestricted = !currentUser.getRole().name().equals(UserRole.ADMIN) &&
                !currentUser.getRole().name().equals(UserRole.LAB_TECHNICIAN);

        if (isRestricted) {
            if (request.getFilters() == null) request.setFilters(new ArrayList<>());
            request.getFilters().add(
                    new SearchFilter("borrower.id", currentUser.getId(), SearchFilter.Type.EQUALS)
            );
        }

        return super.search(request);
    }

    @Override
    public Loan save(Loan entity) {
        ItemListValidator.validateNoDuplicates(entity.getItems(), i -> i.getItem().getId());
        validateAccess(entity);
        if (entity.getId() == null) {
            userService.validateEnabled(entity.getBorrower());
        }
        boolean isNew = entity.getId() == null;
        if (entity.getLoanDate() == null) {
            entity.setLoanDate(Instant.now());
        }
        Loan existing = null;
        if (entity.getId() != null) {
            existing = repository.findById(entity.getId()).orElse(null);
            if (existing != null && entity.getStatus() == null) {
                entity.setStatus(existing.getStatus());
            }
        }
        if (entity.getStatus() == null) {
            entity.setStatus(LoanStatus.ONGOING);
        }

        if (entity.getItems() != null) {
            for (LoanItem item : entity.getItems()) {
                item.setLoan(entity);
                if (item.getId() == null) {
                    inventoryService.handleTransaction(item.getItem(), item.getQuantity(), InventoryTransactionType.LOAN);
                } else {
                    LoanItem oldItem = findOldItem(existing, item);
                    if (oldItem != null && oldItem.getQuantity().compareTo(item.getQuantity()) != 0) {
                        inventoryService.updateTransaction(
                                item.getItem(),
                                oldItem.getQuantity(),
                                InventoryTransactionType.LOAN,
                                item.getQuantity()
                        );
                    }
                }
            }
            
            if (existing != null && existing.getItems() != null) {
                for (LoanItem oldItem : existing.getItems()) {
                    boolean stillExists = entity.getItems().stream()
                            .anyMatch(i -> Objects.equals(i.getItem().getId(), oldItem.getItem().getId()));
                    if (!stillExists) {
                        inventoryService.undoTransaction(oldItem.getItem(), oldItem.getQuantity(), InventoryTransactionType.LOAN);
                    }
                }
            }
        }

        Loan saved = super.save(entity);
        if (isNew) {
            loanMailService.sendLoanCreated(saved.getId());
            notificationService.sendNotification(saved.getBorrower(), "Novo Empréstimo", "Um novo empréstimo foi registrado para você.", "/loan?id=" + saved.getId());
        }
        return refreshStatus(saved);
    }

    @Override
    public void deleteById(Long id) {
        var optEntity = findById(id);
        if (optEntity.isPresent()) {
            validateAccess(optEntity.get());
            super.deleteById(optEntity.get().getId());
        }
    }

    private void validateAccess(Loan entity) {
        if (entity.getId() == null) return;

        var dbEntity = repository.findById(entity.getId()).orElse(null);
        if (dbEntity == null) return;

        if (!Objects.equals(dbEntity.getBorrower().getId(), userService.getCurrentUser().getId()) && !userService.hasPrivilegedAcess()) {
            throw new AccessDeniedException("Você não tem acesso para este registro");
        }
    }

    private LoanItem findOldItem(Loan existing, LoanItem current) {
        if (existing == null || existing.getItems() == null) return null;
        return existing.getItems().stream()
                .filter(i -> Objects.equals(i.getItem().getId(), current.getItem().getId()))
                .findFirst()
                .orElse(null);
    }

    public List<LoanItem> getActiveLoansForItem(Long itemId) {
        return repository.findActiveByItem(itemId);
    }

    public List<LoanItem> getHistoryForItem(Long itemId) {
        return repository.findHistoryByItem(itemId);
    }

    public BigDecimal getLoanedQuantityForItem(Long itemId) {
        BigDecimal loaned = repository.sumActiveLoanQuantityByItem(itemId);
        BigDecimal returned = returnRepository.sumActiveReturnQuantityByItem(itemId);
        loaned = loaned != null ? loaned : BigDecimal.ZERO;
        returned = returned != null ? returned : BigDecimal.ZERO;
        return loaned.subtract(returned);
    }

    public Loan refreshStatus(Loan loan) {
        if (loan == null || loan.getId() == null) {
            return loan;
        }

        Loan persistedLoan = repository.findById(loan.getId()).orElse(null);
        if (persistedLoan == null) {
            return loan;
        }

        LoanStatus previousStatus = persistedLoan.getStatus();
        LoanStatus newStatus = resolveStatus(persistedLoan);
        if (newStatus != previousStatus) {
            persistedLoan.setStatus(newStatus);
            Loan updated = repository.save(persistedLoan);
            if (newStatus == LoanStatus.COMPLETED) {
                loanMailService.sendLoanCompleted(updated.getId());
                notificationService.sendNotification(updated.getBorrower(), "Devolução Confirmada", "A devolução do seu empréstimo foi confirmada com sucesso.", "/loan?id=" + updated.getId());
            } else if (newStatus == LoanStatus.OVERDUE) {
                loanMailService.sendLoanOverdue(updated.getId());
            }
            return updated;
        }
        return persistedLoan;
    }

    private LoanStatus resolveStatus(Loan loan) {
        BigDecimal expectedReturn = defaultZero(repository.sumReturnableQuantity(loan.getId()));

        // Nothing to return → auto-completed
        if (expectedReturn.compareTo(BigDecimal.ZERO) == 0) {
            return LoanStatus.COMPLETED;
        }

        BigDecimal returned = defaultZero(returnRepository.sumQuantityReturnedByLoan(loan.getId()));
        BigDecimal issued = defaultZero(returnRepository.sumQuantityIssuedByLoan(loan.getId()));
        BigDecimal settled = returned.add(issued);

        if (settled.compareTo(expectedReturn) >= 0) {
            return LoanStatus.COMPLETED;
        }

        Instant deadline = loan.getDeadline();
        if (deadline != null) {
            LocalDate deadlineDate = deadline.atZone(LOAN_ZONE).toLocalDate();
            LocalDate today = LocalDate.now(LOAN_ZONE);
            if (today.isAfter(deadlineDate)) {
                return LoanStatus.OVERDUE;
            }
        }
        return LoanStatus.ONGOING;
    }

    private BigDecimal defaultZero(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }
}
