package br.edu.utfpr.dainf.inventory.auditor;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.inventory.transaction.Transaction;
import br.edu.utfpr.dainf.model.Inventory;
import br.edu.utfpr.dainf.model.InventoryTransaction;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.service.InventoryTransactionService;
import br.edu.utfpr.dainf.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DefaultTransactionAuditorTest {

    @Mock InventoryTransactionService service;
    @Mock UserService userService;
    @Mock Transaction transaction;

    DefaultTransactionAuditor auditor;
    Inventory inventory;
    User currentUser;

    @BeforeEach
    void setUp() {
        auditor = new DefaultTransactionAuditor(service, userService);

        Item item = new Item();
        item.setId(1L);
        inventory = new Inventory(item, BigDecimal.TEN);

        currentUser = new User();
        currentUser.setId(99L);
        when(userService.getCurrentUser()).thenReturn(currentUser);
        when(service.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    InventoryTransaction captureAudit() {
        ArgumentCaptor<InventoryTransaction> captor = ArgumentCaptor.forClass(InventoryTransaction.class);
        verify(service).save(captor.capture());
        return captor.getValue();
    }

    @Nested
    class AuditWithReferenceId {

        @Test
        void setsReferenceIdOnSavedTransaction() {
            auditor.audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.ISSUE, 42L);

            assertEquals(42L, captureAudit().getReferenceId());
        }

        @Test
        void setsNullReferenceIdWhenNullPassed() {
            auditor.audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.ISSUE, null);

            assertNull(captureAudit().getReferenceId());
        }

        @Test
        void setsInventoryOnSavedTransaction() {
            auditor.audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.LOAN, 7L);

            assertSame(inventory, captureAudit().getInventory());
        }

        @Test
        void setsQuantityOnSavedTransaction() {
            auditor.audit(inventory, new BigDecimal("25"), transaction, InventoryTransactionType.ISSUE, 3L);

            assertEquals(new BigDecimal("25"), captureAudit().getQuantity());
        }

        @Test
        void setsTypeOnSavedTransaction() {
            auditor.audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.PURCHASE, 1L);

            assertEquals(InventoryTransactionType.PURCHASE, captureAudit().getType());
        }

        @Test
        void setsCurrentUserOnSavedTransaction() {
            auditor.audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.LOAN, 5L);

            assertSame(currentUser, captureAudit().getUser());
        }

        @Test
        void setsDateOnSavedTransaction() {
            auditor.audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.RETURN, 2L);

            assertNotNull(captureAudit().getDate());
        }

        @Test
        void setsQuantityAfterTransactionFromInventory() {
            // inventory.getQuantity() == 10; auditor reads it after transaction.apply() has run
            auditor.audit(inventory, BigDecimal.ONE, transaction, InventoryTransactionType.ISSUE, 1L);

            assertEquals(BigDecimal.TEN, captureAudit().getQuantityAfterTransaction());
        }

        @Test
        void quantityAfterTransaction_reflectsInventoryStateAtAuditTime() {
            inventory.setQuantity(new BigDecimal("42"));
            auditor.audit(inventory, new BigDecimal("8"), transaction, InventoryTransactionType.PURCHASE, 2L);

            assertEquals(new BigDecimal("42"), captureAudit().getQuantityAfterTransaction());
        }
    }

    @Nested
    class AuditWithoutReferenceId {

        @Test
        void savesTransactionWithNullReferenceId() {
            auditor.audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.PURCHASE);

            assertNull(captureAudit().getReferenceId());
        }

        @Test
        void setsQuantityAfterTransactionCorrectly() {
            auditor.audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.PURCHASE);

            assertEquals(BigDecimal.TEN, captureAudit().getQuantityAfterTransaction());
        }

        @Test
        void setsInventoryCorrectly() {
            auditor.audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.RETURN);

            assertSame(inventory, captureAudit().getInventory());
        }

        @Test
        void setsTypeCorrectly() {
            auditor.audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.ISSUE);

            assertEquals(InventoryTransactionType.ISSUE, captureAudit().getType());
        }

        @Test
        void setsCurrentUserCorrectly() {
            auditor.audit(inventory, BigDecimal.TEN, transaction, InventoryTransactionType.LOAN);

            assertSame(currentUser, captureAudit().getUser());
        }
    }
}
