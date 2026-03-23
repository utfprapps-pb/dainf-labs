package br.edu.utfpr.dainf.inventory.transaction;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.model.Inventory;

import java.math.BigDecimal;

public class SubtractQuantityTransaction implements Transaction {
    @Override
    public void apply(Inventory inventory, BigDecimal quantity, InventoryTransactionType type) {
        BigDecimal current = inventory.getQuantity() != null ? inventory.getQuantity() : BigDecimal.ZERO;
        inventory.setQuantity(current.subtract(quantity));
    }
}