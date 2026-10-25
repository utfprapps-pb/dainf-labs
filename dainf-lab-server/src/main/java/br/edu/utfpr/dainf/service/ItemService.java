package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Group;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.ItemRepository;
import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.search.request.filter.SearchFilter;
import br.edu.utfpr.dainf.shared.CrudService;
import br.edu.utfpr.dainf.spec.ItemSpecifications;
import br.edu.utfpr.dainf.storage.StorageService;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

@Service
public class ItemService extends CrudService<Long, Item, ItemRepository> {

    private final StorageService storageService;
    private final UserService userService;

    public ItemService(StorageService storageService, UserService userService) {
        this.storageService = storageService;
        this.userService = userService;
    }

    @Override
    public JpaSpecificationExecutor<Item> getSpecExecutor() {
        return repository;
    }

    @Override
    public Item save(Item entity) {
        Optional.ofNullable(entity.getAssets()).ifPresent(assets ->
                assets.forEach(asset -> asset.setItem(entity))
        );

        Optional.ofNullable(entity.getImages()).ifPresent(images ->
                images.forEach(image -> image.setItem(entity))
        );

        super.save(entity);

        if (entity.getImages() != null && moveTempImages(entity)) {
            super.save(entity);
        }

        return entity;
    }

    @Override
    public Page<Item> search(SearchRequest request) {
        if (!userService.hasPrivilegedAcess()) {
            List<SearchFilter> filters = request.getFilters() == null
                    ? new ArrayList<>()
                    : new ArrayList<>(request.getFilters());
            filters.add(new SearchFilter("restricted", false, SearchFilter.Type.EQUALS));
            request.setFilters(filters);
        }
        return super.search(request);
    }

    @Override
    protected Specification<Item> extraSpecification() {
        if (userService.hasPrivilegedAcess()) return null;

        User currentUser = userService.getCurrentUser();
        Set<Long> userGroupIds = currentUser == null || currentUser.getGroups() == null
                ? Set.of()
                : currentUser.getGroups().stream()
                .map(Group::getId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());

        if (userGroupIds.isEmpty()) {
            return (root, query, cb) -> cb.isEmpty(root.get("groups"));
        }

        return (root, query, cb) -> {
            Subquery<Long> userGroup = query.subquery(Long.class);
            Root<Item> correlatedItem = userGroup.correlate(root);
            Join<Item, Group> group = correlatedItem.join("groups");
            userGroup.select(group.get("id"))
                    .where(group.get("id").in(userGroupIds), cb.isTrue(group.get("active")));
            return cb.or(cb.isEmpty(root.get("groups")), cb.exists(userGroup));
        };
    }

    @Override
    protected Specification<Item> customSpecification(SearchFilter filter) {
        if (!"groups".equals(filter.getField()) || filter.getValue() == null) return null;
        Long groupId = filter.getValue() instanceof Number number
                ? number.longValue()
                : Long.valueOf(filter.getValue().toString());
        return ItemSpecifications.belongsToGroup(groupId);
    }

    public boolean isVisibleTo(Item item, User user) {
        if (item == null) return false;
        if (user != null && List.of(UserRole.ROLE_ADMIN, UserRole.ROLE_LAB_TECHNICIAN).contains(user.getRole())) {
            return true;
        }
        if (item.isRestricted()) return false;
        if (item.getGroups() == null || item.getGroups().isEmpty()) return true;
        if (user == null || user.getGroups() == null || user.getGroups().isEmpty()) return false;

        Set<Long> activeUserGroupIds = user.getGroups().stream()
                .filter(Group::isActive)
                .map(Group::getId)
                .collect(Collectors.toSet());
        return item.getGroups().stream()
                .filter(Group::isActive)
                .map(Group::getId)
                .anyMatch(activeUserGroupIds::contains);
    }

    public void validateVisible(Collection<Item> items) {
        if (items == null) return;
        User currentUser = userService.getCurrentUser();
        if (items.stream().anyMatch(item -> !isVisibleTo(item, currentUser))) {
            throw new WarnException("Item não encontrado");
        }
    }

    private boolean moveTempImages(Item entity) {
        AtomicBoolean changed = new AtomicBoolean(false);

        entity.getImages().forEach(image -> {
            if (image.getName().contains("temp/")) {
                String newName = image.getName().replace("temp/", entity.getId() + "/");
                storageService.moveToPermanentFolder("item", image.getName(), newName);
                image.setName(newName);
                changed.set(true);
            }
        });

        return changed.get();
    }
}
