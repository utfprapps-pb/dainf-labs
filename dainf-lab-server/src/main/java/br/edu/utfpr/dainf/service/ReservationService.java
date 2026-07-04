package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.Loan;
import br.edu.utfpr.dainf.model.Purchase;
import br.edu.utfpr.dainf.model.Reservation;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.PurchaseRepository;
import br.edu.utfpr.dainf.repository.ReservationRepository;
import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.search.request.filter.SearchFilter;
import br.edu.utfpr.dainf.shared.CrudService;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Inventory;
import br.edu.utfpr.dainf.model.ReservationItem;

import java.util.ArrayList;
import java.util.Objects;
import java.util.List;
import br.edu.utfpr.dainf.service.NotificationService;
import br.edu.utfpr.dainf.repository.UserRepository;
import br.edu.utfpr.dainf.repository.LoanRepository;
import br.edu.utfpr.dainf.enums.LoanStatus;

@Service
public class ReservationService extends CrudService<Long, Reservation, ReservationRepository> {

    private final UserService userService;
    private final InventoryService inventoryService;
    private final br.edu.utfpr.dainf.mail.MailService mailService;
    private final ConfigurationService configurationService;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final LoanRepository loanRepository;

    public ReservationService(UserService userService, InventoryService inventoryService, br.edu.utfpr.dainf.mail.MailService mailService, ConfigurationService configurationService, NotificationService notificationService, UserRepository userRepository, LoanRepository loanRepository) {
        this.userService = userService;
        this.inventoryService = inventoryService;
        this.mailService = mailService;
        this.configurationService = configurationService;
        this.notificationService = notificationService;
        this.userRepository = userRepository;
        this.loanRepository = loanRepository;
    }

    @Override
    public JpaSpecificationExecutor<Reservation> getSpecExecutor() {
        return repository;
    }

    @Override
    public Page<Reservation> search(SearchRequest request) {
        if (!userService.hasPrivilegedAcess()) {
            if (request.getFilters() == null) request.setFilters(new ArrayList<>());
            request.getFilters().add(new SearchFilter("user.id", userService.getCurrentUser().getId(), SearchFilter.Type.EQUALS));
        }

        return super.search(request);
    }

    @Override
    public Reservation save(Reservation entity) {
        validateAccess(entity);
        if (entity.getId() == null) {
            entity.setStatus("PENDENTE");
            if (entity.getUser() == null || !userService.hasPrivilegedAcess()) {
                entity.setUser(userService.getCurrentUser());
            }

            // Verify if user already has an active loan
            List<Loan> activeLoans = loanRepository.findByBorrowerAndStatusIn(
                entity.getUser(), 
                List.of(LoanStatus.ONGOING, LoanStatus.OVERDUE)
            );
            
            if (activeLoans != null && !activeLoans.isEmpty()) {
                throw new WarnException("Não é possível realizar a reserva, pois o usuário já possui um empréstimo ativo.");
            }

            // Verify if user already has an active reservation
            List<Reservation> activeReservations = repository.findByUserAndStatusIn(
                entity.getUser(),
                List.of("PENDENTE", "EM_SEPARACAO", "PRONTO_RETIRADA")
            );

            if (activeReservations != null && !activeReservations.isEmpty()) {
                throw new WarnException("Não é possível realizar a reserva, pois o usuário já possui uma reserva ativa.");
            }
        }
        
        if (entity.getItems() != null) {
            for (ReservationItem item : entity.getItems()) {
                item.setReservation(entity);
                if (item.getItem() != null) {
                    Inventory inv = inventoryService.findByItem(item.getItem());
                    if (inv == null || inv.getQuantity().compareTo(item.getQuantity()) < 0) {
                        throw new WarnException("Estoque insuficiente para o item: " + item.getItem().getName());
                    }
                }
            }
        }
        boolean isNew = entity.getId() == null;
        String oldStatus = null;
        if (!isNew) {
            Reservation dbEntity = repository.findById(entity.getId()).orElse(null);
            if (dbEntity != null) {
                oldStatus = dbEntity.getStatus();
            }
        }

        Reservation saved = super.save(entity);
        
        if (isNew) {
            // Send email
            String to = configurationService.get().getClearanceEmailRecipient();
            if (to != null && !to.isBlank()) {
                try {
                    mailService.send(br.edu.utfpr.dainf.mail.Mail.builder()
                            .to(java.util.List.of(to))
                            .subject("Nova Reserva Solicitada")
                            .content("Uma nova reserva foi solicitada por " + saved.getUser().getNome() + ". Acesse o sistema para revisar.")
                            .build());
                } catch (Exception e) {
                    // Ignore mail error to not block reservation
                }
            }
            
            // Site notification for TAs and Admins
            if (!userService.hasPrivilegedAcess()) {
                List<User> notificationTargets = userRepository.findByRoleIn(List.of(UserRole.ROLE_ADMIN, UserRole.ROLE_LAB_TECHNICIAN, UserRole.ROLE_PROFESSOR));
                for (User target : notificationTargets) {
                    notificationService.sendNotification(target, "Nova Reserva", "Uma nova reserva foi solicitada por " + saved.getUser().getNome(), "/reservation?id=" + saved.getId());
                }
            }
        } else {
            // Site notification for Student when status changes
            if (oldStatus != null && !oldStatus.equals(saved.getStatus())) {
                notificationService.sendNotification(saved.getUser(), "Reserva Atualizada", "O status da sua reserva mudou para: " + getDisplayStatus(saved.getStatus()), "/reservation?id=" + saved.getId());
            }
        }
        return saved;
    }
    
    private String getDisplayStatus(String status) {
        if (status == null) return "Desconhecido";
        switch (status) {
            case "PENDENTE": return "Pendente";
            case "EM_SEPARACAO": return "Em separação";
            case "PRONTO_RETIRADA": return "Pronto para Retirada";
            default: return status;
        }
    }

    @Override
    public void deleteById(Long id) {
        var optEntity = findById(id);
        if (optEntity.isPresent()) {
            validateAccess(optEntity.get());
            super.deleteById(optEntity.get().getId());
        }
    }

    private void validateAccess(Reservation entity) {
        if (entity.getId() == null) return;

        var dbEntity = repository.findById(entity.getId()).orElse(null);
        if (dbEntity == null) return;

        if (!Objects.equals(dbEntity.getUser().getId(), userService.getCurrentUser().getId()) && !userService.hasPrivilegedAcess()) {
            throw new AccessDeniedException("Você não tem acesso para este registro");
        }
    }
}
