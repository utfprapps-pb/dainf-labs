package br.edu.utfpr.dainf.inventory.auditor;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.inventory.transaction.Transaction;
import br.edu.utfpr.dainf.model.Inventory;

import java.math.BigDecimal;

public interface TransactionAuditor {
    void audit(Inventory inventory, BigDecimal quantity, Transaction transaction, InventoryTransactionType type);

    default void audit(Inventory inventory, BigDecimal quantity, Transaction transaction, InventoryTransactionType type, Long referenceId) {
        audit(inventory, quantity, transaction, type);
    }
}
