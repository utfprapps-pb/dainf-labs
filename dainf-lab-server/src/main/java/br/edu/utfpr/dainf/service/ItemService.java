package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.repository.ItemRepository;
import br.edu.utfpr.dainf.shared.CrudService;
import br.edu.utfpr.dainf.storage.StorageService;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class ItemService extends CrudService<Long, Item, ItemRepository> {

    private final StorageService storageService;
    private final br.edu.utfpr.dainf.repository.InventoryRepository inventoryRepository;
    private final br.edu.utfpr.dainf.repository.InventoryTransactionRepository inventoryTransactionRepository;
    private final jakarta.persistence.EntityManager entityManager;

    public ItemService(StorageService storageService, br.edu.utfpr.dainf.repository.InventoryRepository inventoryRepository, br.edu.utfpr.dainf.repository.InventoryTransactionRepository inventoryTransactionRepository, jakarta.persistence.EntityManager entityManager) {
        this.storageService = storageService;
        this.inventoryRepository = inventoryRepository;
        this.inventoryTransactionRepository = inventoryTransactionRepository;
        this.entityManager = entityManager;
    }

    @Override
    public JpaSpecificationExecutor<Item> getSpecExecutor() {
        return repository;
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void deleteById(Long id) {
        Item item = repository.findById(id).orElse(null);
        if (item != null) {
            entityManager.createQuery("DELETE FROM CartItem ci WHERE ci.item = :item")
                         .setParameter("item", item)
                         .executeUpdate();
                         
            inventoryRepository.findByItem(item).ifPresent(inventory -> {
                inventoryTransactionRepository.deleteByInventory(inventory);
                inventoryRepository.delete(inventory);
            });
            super.deleteById(id);
        }
    }

    @Override
    public Item save(Item entity) {
        Optional.ofNullable(entity.getAssets()).ifPresent(assets ->
                assets.forEach(asset -> asset.setItem(entity))
        );

        Optional.ofNullable(entity.getImages()).ifPresent(images ->
                images.forEach(image -> image.setItem(entity))
        );

        Item savedEntity = super.save(entity);

        if (savedEntity.getCode() == null || savedEntity.getCode().trim().isEmpty()) {
            savedEntity.setCode(String.valueOf(savedEntity.getId()));
            savedEntity = super.save(savedEntity);
        }

        if (savedEntity.getImages() != null && moveTempImages(savedEntity)) {
            savedEntity = super.save(savedEntity);
        }

        if (savedEntity.getMinimumStock() == null) {
            savedEntity.setMinimumStock(java.math.BigDecimal.ZERO);
            savedEntity = super.save(savedEntity);
        }

        return savedEntity;
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
