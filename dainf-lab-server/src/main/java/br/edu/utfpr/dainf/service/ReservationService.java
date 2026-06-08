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

@Service
public class ReservationService extends CrudService<Long, Reservation, ReservationRepository> {

    private final UserService userService;
    private final InventoryService inventoryService;
    private final br.edu.utfpr.dainf.mail.MailService mailService;
    private final ConfigurationService configurationService;

    public ReservationService(UserService userService, InventoryService inventoryService, br.edu.utfpr.dainf.mail.MailService mailService, ConfigurationService configurationService) {
        this.userService = userService;
        this.inventoryService = inventoryService;
        this.mailService = mailService;
        this.configurationService = configurationService;
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
            if (entity.getUser() == null || !userService.hasPrivilegedAcess()) {
                entity.setUser(userService.getCurrentUser());
            }
            if (userService.isStudentBlocked(entity.getUser())) {
                throw new WarnException("Usuário bloqueado: possui empréstimos em atraso.");
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
        Reservation saved = super.save(entity);
        
        if (isNew) {
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
        }
        return saved;
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
