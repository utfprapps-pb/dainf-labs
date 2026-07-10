package br.edu.utfpr.dainf.inventory;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.inventory.auditor.TransactionAuditor;
import br.edu.utfpr.dainf.inventory.transaction.Transaction;
import br.edu.utfpr.dainf.inventory.validator.TransactionValidator;
import br.edu.utfpr.dainf.model.Inventory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TransactionProcessorTest {

    @Mock Transaction transaction;
    @Mock TransactionValidator validator;
    @Mock TransactionAuditor auditor;
    @Mock Inventory inventory;

    TransactionProcessor processor;

    @BeforeEach
    void setUp() {
        processor = new TransactionProcessor(transaction, validator, auditor);
    }

    @Nested
    class ProcessWithoutReferenceId {

        @Test
        void callsAuditWithNullReferenceId() {
            processor.process(inventory, BigDecimal.TEN, InventoryTransactionType.ISSUE);

            verify(auditor).audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.ISSUE, null);
        }

        @Test
        void validationAndTransactionRunBeforeAudit() {
            processor.process(inventory, BigDecimal.TEN, InventoryTransactionType.PURCHASE);

            InOrder order = inOrder(validator, transaction, auditor);
            order.verify(validator).validate(inventory, BigDecimal.TEN, transaction);
            order.verify(transaction).apply(inventory, BigDecimal.TEN, InventoryTransactionType.PURCHASE);
            order.verify(auditor).audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.PURCHASE, null);
        }
    }

    @Nested
    class ProcessWithReferenceId {

        @Test
        void callsAuditWithProvidedReferenceId() {
            processor.process(inventory, BigDecimal.TEN, InventoryTransactionType.ISSUE, 42L);

            verify(auditor).audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.ISSUE, 42L);
        }

        @Test
        void callsAuditWithNullWhenNullReferenceIdPassed() {
            processor.process(inventory, BigDecimal.TEN, InventoryTransactionType.LOAN, null);

            verify(auditor).audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.LOAN, null);
        }

        @Test
        void purchaseType_referenceIdPropagated() {
            processor.process(inventory, BigDecimal.ONE, InventoryTransactionType.PURCHASE, 99L);

            verify(auditor).audit(inventory, BigDecimal.ONE, transaction, InventoryTransactionType.PURCHASE, 99L);
        }

        @Test
        void returnType_referenceIdPropagated() {
            processor.process(inventory, BigDecimal.TEN, InventoryTransactionType.RETURN, 7L);

            verify(auditor).audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.RETURN, 7L);
        }

        @Test
        void validationAndTransactionRunBeforeAudit() {
            processor.process(inventory, BigDecimal.TEN, InventoryTransactionType.ISSUE, 5L);

            InOrder order = inOrder(validator, transaction, auditor);
            order.verify(validator).validate(inventory, BigDecimal.TEN, transaction);
            order.verify(transaction).apply(inventory, BigDecimal.TEN, InventoryTransactionType.ISSUE);
            order.verify(auditor).audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.ISSUE, 5L);
        }
    }
}
