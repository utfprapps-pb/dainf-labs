package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.inventory.InventoryLineItem;
import br.edu.utfpr.dainf.model.*;
import br.edu.utfpr.dainf.repository.InventoryRepository;
import br.edu.utfpr.dainf.repository.ItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Stream;

@Service
@Transactional
public class ItemLifecycleService {
    private final ItemRepository items;
    private final InventoryRepository inventories;

    public ItemLifecycleService(ItemRepository items, InventoryRepository inventories) {
        this.items = items;
        this.inventories = inventories;
    }

    public Item lock(Long id) {
        return items.findOneById(id)
                .orElseThrow(() -> new WarnException("Item não encontrado."));
    }

    public void requireActive(Long id) {
        requireActive(lock(id));
    }

    private void requireActive(Item item) {
        if (!item.isActive()) {
            throw new WarnException("O item '" + item.getName() + "' está inativo. Reative-o antes de movimentá-lo.");
        }
    }

    public Item changeActive(Long id, boolean active) {
        Item item = lock(id);
        if (!active) {
            if (balance(item).compareTo(BigDecimal.ZERO) != 0) {
                throw new WarnException("O item só pode ser inativado quando o saldo for zero.");
            }
            if (items.hasPendingLoans(id)) {
                throw new WarnException("O item possui empréstimo pendente e não pode ser inativado.");
            }
        }
        item.setActive(active);
        return items.save(item);
    }

    public void delete(Long id) {
        Item item = lock(id);
        if (items.hasMovementHistory(id)) {
            throw new WarnException("Este item já teve movimentações e não pode ser excluído. Utilize a inativação.");
        }
        if (balance(item).compareTo(BigDecimal.ZERO) != 0) {
            throw new WarnException("Não é possível excluir um item com saldo em estoque.");
        }
        if (items.hasOtherReferences(id)) {
            throw new WarnException("O item está vinculado a reservas, solicitações ou carrinhos e não pode ser excluído.");
        }
        inventories.findByItem(item).ifPresent(inventories::delete);
        items.delete(item);
        items.flush();
    }

    private BigDecimal balance(Item item) {
        return inventories.findByItem(item).map(Inventory::getQuantity).orElse(BigDecimal.ZERO);
    }

    public void validateChanges(List<? extends InventoryLineItem> oldLines, List<? extends InventoryLineItem> newLines) {
        Map<Long, InventoryLineItem> oldById = index(oldLines);
        Map<Long, InventoryLineItem> newById = index(newLines);
        Stream.concat(oldById.keySet().stream(), newById.keySet().stream()).distinct().sorted().forEach(id -> {
            Item item = lock(id);
            InventoryLineItem oldLine = oldById.get(id);
            InventoryLineItem newLine = newById.get(id);
            if (oldLine == null || newLine == null || changed(oldLine, newLine)) {
                requireActive(item);
            }
        });
    }

    private Map<Long, InventoryLineItem> index(List<? extends InventoryLineItem> lines) {
        Map<Long, InventoryLineItem> result = new HashMap<>();
        if (lines != null) lines.forEach(line -> result.put(line.getItem().getId(), line));
        return result;
    }

    private boolean changed(InventoryLineItem oldLine, InventoryLineItem newLine) {
        if (zero(oldLine.inventoryQuantity()).compareTo(zero(newLine.inventoryQuantity())) != 0) return true;
        if (oldLine instanceof ReturnItem oldReturn && newLine instanceof ReturnItem newReturn) {
            return zero(oldReturn.getQuantityIssued()).compareTo(zero(newReturn.getQuantityIssued())) != 0;
        }
        if (oldLine instanceof LoanItem oldLoan && newLine instanceof LoanItem newLoan) {
            return oldLoan.isShouldReturn() != newLoan.isShouldReturn();
        }
        return false;
    }

    private BigDecimal zero(BigDecimal quantity) {
        return quantity == null ? BigDecimal.ZERO : quantity;
    }
}
