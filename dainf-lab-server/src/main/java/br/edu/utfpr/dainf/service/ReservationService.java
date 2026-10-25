package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.Reservation;
import br.edu.utfpr.dainf.model.ReservationItem;
import br.edu.utfpr.dainf.repository.ReservationRepository;
import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.search.request.filter.SearchFilter;
import br.edu.utfpr.dainf.shared.CrudService;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class ReservationService extends CrudService<Long, Reservation, ReservationRepository> {

    private final UserService userService;
    private final ItemService itemService;

    public ReservationService(UserService userService, ItemService itemService) {
        this.userService = userService;
        this.itemService = itemService;
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
        if (entity.getItems() != null && !userService.hasPrivilegedAcess()) {
            List<Item> items = entity.getItems().stream()
                    .map(ReservationItem::getItem)
                    .map(item -> itemService.findById(item.getId())
                            .orElseThrow(() -> new WarnException("Item não encontrado")))
                    .toList();
            itemService.validateVisible(items);
            for (int index = 0; index < entity.getItems().size(); index++) {
                entity.getItems().get(index).setItem(items.get(index));
            }
        }
        if (entity.getReservationDate() != null && entity.getWithdrawalDate() != null
                && entity.getWithdrawalDate().isBefore(entity.getReservationDate())) {
            throw new WarnException("A data de retirada não pode ser anterior à data da reserva.");
        }
        if (entity.getId() == null) {
            entity.setUser(userService.getCurrentUser());
        }
        if (entity.getItems() != null) {
            entity.getItems().forEach(item -> item.setReservation(entity));
        }
        return super.save(entity);
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
