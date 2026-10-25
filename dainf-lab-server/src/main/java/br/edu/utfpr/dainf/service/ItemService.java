package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.ItemRepository;
import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.search.request.filter.SearchFilter;
import br.edu.utfpr.dainf.shared.CrudService;
import br.edu.utfpr.dainf.storage.StorageService;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

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

    public boolean isVisibleTo(Item item, User user) {
        if (item == null) return false;
        if (user != null && List.of(UserRole.ROLE_ADMIN, UserRole.ROLE_LAB_TECHNICIAN).contains(user.getRole())) {
            return true;
        }
        return !item.isRestricted();
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
