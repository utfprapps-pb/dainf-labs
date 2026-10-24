package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.repository.ItemRepository;
import br.edu.utfpr.dainf.search.SearchHandler;
import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.spec.ItemSpecifications;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import br.edu.utfpr.dainf.shared.CrudService;
import br.edu.utfpr.dainf.storage.StorageService;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class ItemService extends CrudService<Long, Item, ItemRepository> {

    private static final String STOCK_STATUS_FILTER = "stockStatus";

    private final StorageService storageService;
    private final ItemLifecycleService lifecycle;

    public ItemService(StorageService storageService, ItemLifecycleService lifecycle) {
        this.storageService = storageService;
        this.lifecycle = lifecycle;
    }

    @Override
    public JpaSpecificationExecutor<Item> getSpecExecutor() {
        return repository;
    }

    @Override
    @Transactional
    public Item save(Item entity) {
        entity.setActive(entity.getId() == null || lifecycle.lock(entity.getId()).isActive());
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
    public void deleteById(Long id) {
        lifecycle.delete(id);
    }

    @Override
    public Page<Item> search(SearchRequest request) {
        return search(request, true);
    }

    public Page<Item> searchAll(SearchRequest request) {
        return search(request, false);
    }

    public Item changeActive(Long id, boolean active) {
        return lifecycle.changeActive(id, active);
    }

    private Page<Item> search(SearchRequest request, boolean activeOnly) {
        return new SearchHandler<Long, Item>(repository).handle(
                request,
                activeOnly ? ItemSpecifications.active() : null,
                Map.of(STOCK_STATUS_FILTER, ItemSpecifications::stockStatus)
        );
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
