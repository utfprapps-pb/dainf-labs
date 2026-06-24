package br.edu.utfpr.dainf.service;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.enums.LoanStatus;
import br.edu.utfpr.dainf.inventory.auditor.DefaultTransactionAuditor;
import br.edu.utfpr.dainf.model.*;
import br.edu.utfpr.dainf.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * End-to-end tests for the inventory transaction pipeline.
 *
 * Unlike unit tests that mock TransactionAuditor, these wire a REAL
 * DefaultTransactionAuditor so every InventoryTransaction record produced by
 * purchase, issue, loan, and return operations is captured and verified:
 * type, quantity, referenceId, inventory linkage, user, and timestamp.
 *
 * These tests also cover cross-service workflows that no unit test exercises.
 */
@ExtendWith(MockitoExtension.class)
class InventoryOperationsE2ETest {

    // --- Repository mocks ---
    @Mock InventoryRepository inventoryRepository;
    @Mock InventoryTransactionRepository inventoryTransactionRepository;
    @Mock ConfigurationService configurationService;
    @Mock UserService userService;
    @Mock IssueRepository issueRepository;
    @Mock LoanRepository loanRepository;
    @Mock PurchaseRepository purchaseRepository;
    @Mock ReturnRepository returnRepository;
    @Mock ReturnRepository loanReturnRepository; // injected into LoanService
    @Mock LoanMailService loanMailService;

    // --- Real service chain ---
    InventoryTransactionService inventoryTransactionService;
    DefaultTransactionAuditor auditor;
    InventoryService inventoryService;
    InventoryDiffService inventoryDiffService;
    IssueService issueService;
    LoanService loanService;
    PurchaseService purchaseService;

    // --- In-memory stores ---
    final Map<Long, Inventory> inventoryStore = new HashMap<>();
    final Map<Long, Loan> loanStore = new HashMap<>();
    final List<InventoryTransaction> transactionLog = new ArrayList<>();

    User currentUser;
    long itemIdSeq = 1;
    long txIdSeq = 1;

    @BeforeEach
    void setUp() {
        inventoryStore.clear();
        loanStore.clear();
        transactionLog.clear();
        itemIdSeq = 1;
        txIdSeq = 1;

        // Wire the real service chain
        inventoryTransactionService = new InventoryTransactionService();
        ReflectionTestUtils.setField(inventoryTransactionService, "repository", inventoryTransactionRepository);

        auditor = new DefaultTransactionAuditor(inventoryTransactionService, userService);

        inventoryService = new InventoryService(auditor, configurationService);
        ReflectionTestUtils.setField(inventoryService, "repository", inventoryRepository);

        inventoryDiffService = new InventoryDiffService(inventoryService);

        issueService = new IssueService(inventoryDiffService, userService);
        ReflectionTestUtils.setField(issueService, "repository", issueRepository);

        loanService = new LoanService(inventoryDiffService, loanReturnRepository, userService, loanMailService);
        ReflectionTestUtils.setField(loanService, "repository", loanRepository);

        purchaseService = new PurchaseService(inventoryDiffService, userService);
        ReflectionTestUtils.setField(purchaseService, "repository", purchaseRepository);

        // Current user
        currentUser = new User();
        currentUser.setId(1L);
        currentUser.setNome("Test User");
        lenient().when(userService.getCurrentUser()).thenReturn(currentUser);
        lenient().when(userService.hasPrivilegedAcess()).thenReturn(true);
        lenient().when(configurationService.get()).thenReturn(new Configuration());

        // Inventory: stateful in-memory store
        lenient().when(inventoryRepository.findByItem(any())).thenAnswer(inv -> {
            Item item = inv.getArgument(0);
            return Optional.ofNullable(inventoryStore.get(item.getId()));
        });
        lenient().when(inventoryRepository.save(any())).thenAnswer(inv -> {
            Inventory saved = inv.getArgument(0);
            inventoryStore.put(saved.getItem().getId(), saved);
            return saved;
        });

        // InventoryTransaction: capture every saved record
        lenient().when(inventoryTransactionRepository.save(any())).thenAnswer(inv -> {
            InventoryTransaction tx = inv.getArgument(0);
            tx.setId(txIdSeq++);
            transactionLog.add(tx);
            return tx;
        });

        // Entity repositories: save returns entity as-is; findById returns empty by default
        lenient().when(issueRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(purchaseRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(returnRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Loan store: saves go in, findById reads back (needed by ReturnService.resolveLoan)
        lenient().when(loanRepository.save(any())).thenAnswer(inv -> {
            Loan loan = inv.getArgument(0);
            if (loan.getId() != null) loanStore.put(loan.getId(), loan);
            return loan;
        });
        lenient().when(loanRepository.findById(any())).thenAnswer(inv -> {
            Long id = inv.getArgument(0);
            return Optional.ofNullable(loanStore.get(id));
        });
        // sumReturnableQuantity = 0 → refreshStatus auto-completes loans (avoids further stubbing)
        lenient().when(loanRepository.sumReturnableQuantity(any())).thenReturn(BigDecimal.ZERO);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    Item item() {
        Item i = new Item();
        i.setId(itemIdSeq++);
        i.setName("Item-" + i.getId());
        return i;
    }

    void givenStock(Item item, String qty) {
        inventoryStore.put(item.getId(), new Inventory(item, new BigDecimal(qty)));
    }

    BigDecimal stockOf(Item item) {
        return Optional.ofNullable(inventoryStore.get(item.getId()))
                .map(Inventory::getQuantity)
                .orElse(BigDecimal.ZERO);
    }

    List<InventoryTransaction> txsFor(Item item) {
        return transactionLog.stream()
                .filter(tx -> tx.getInventory() != null
                        && tx.getInventory().getItem() != null
                        && Objects.equals(tx.getInventory().getItem().getId(), item.getId()))
                .toList();
    }

    InventoryTransaction lastTx(Item item) {
        List<InventoryTransaction> txs = txsFor(item);
        assertFalse(txs.isEmpty(), "Expected at least one transaction for item " + item.getId());
        return txs.get(txs.size() - 1);
    }

    static BigDecimal bd(String v) { return new BigDecimal(v); }

    // Entity builders

    Issue issue(Long id, IssueItem... items) {
        Issue e = new Issue();
        e.setId(id);
        e.setDate(Instant.now());
        e.setItems(new ArrayList<>(List.of(items)));
        return e;
    }

    IssueItem ii(Item item, String qty) {
        IssueItem i = new IssueItem();
        i.setItem(item);
        i.setQuantity(bd(qty));
        return i;
    }

    Loan loan(Long id, LoanItem... items) {
        Loan e = new Loan();
        e.setId(id);
        e.setLoanDate(Instant.now());
        e.setBorrower(currentUser);
        e.setStatus(LoanStatus.ONGOING);
        e.setItems(new ArrayList<>(List.of(items)));
        return e;
    }

    LoanItem li(Item item, String qty) {
        LoanItem i = new LoanItem();
        i.setItem(item);
        i.setQuantity(bd(qty));
        i.setShouldReturn(false);
        return i;
    }

    Purchase purchase(Long id, PurchaseItem... items) {
        Purchase e = new Purchase();
        e.setId(id);
        e.setDate(Instant.now());
        e.setItems(new ArrayList<>(List.of(items)));
        return e;
    }

    PurchaseItem pi(Item item, String qty) {
        PurchaseItem i = new PurchaseItem();
        i.setItem(item);
        i.setQuantity(bd(qty));
        i.setPrice(BigDecimal.ONE);
        return i;
    }

    ReturnService buildReturnService() {
        IssueService mockIssueService = mock(IssueService.class);
        lenient().when(mockIssueService.save(any(), eq(false))).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(issueRepository.findByLoan(any())).thenReturn(Optional.empty());

        ReturnService rs = new ReturnService(inventoryDiffService, issueRepository, mockIssueService, userService, loanService);
        ReflectionTestUtils.setField(rs, "repository", returnRepository);
        return rs;
    }

    Return ret(Long id, Loan loan, Item item, String quantityReturned) {
        ReturnItem ri = new ReturnItem();
        ri.setItem(item);
        ri.setQuantityReturned(bd(quantityReturned));
        ri.setQuantityIssued(BigDecimal.ZERO);

        Return r = new Return();
        r.setId(id);
        r.setReturnDate(Instant.now());
        r.setLoan(loan);
        r.setItems(new ArrayList<>(List.of(ri)));
        return r;
    }

    // =========================================================================
    // Audit record creation — each operation produces the right record
    // =========================================================================

    @Nested
    class AuditRecordCreation {

        @Test
        void purchase_createsExactlyOneTransaction() {
            Item item = item();
            purchaseService.save(purchase(1L, pi(item, "50")));

            assertEquals(1, txsFor(item).size());
        }

        @Test
        void purchase_transactionHasCorrectTypeQuantityAndInventoryLink() {
            Item item = item();
            purchaseService.save(purchase(1L, pi(item, "50")));

            InventoryTransaction tx = lastTx(item);
            assertAll(
                () -> assertEquals(InventoryTransactionType.PURCHASE, tx.getType()),
                () -> assertEquals(bd("50"), tx.getQuantity()),
                () -> assertEquals(item.getId(), tx.getInventory().getItem().getId())
            );
        }

        @Test
        void issue_createsExactlyOneTransaction() {
            Item item = item();
            givenStock(item, "100");
            issueService.save(issue(1L, ii(item, "30")));

            assertEquals(1, txsFor(item).size());
        }

        @Test
        void issue_transactionHasCorrectTypeAndQuantity() {
            Item item = item();
            givenStock(item, "100");
            issueService.save(issue(1L, ii(item, "30")));

            InventoryTransaction tx = lastTx(item);
            assertEquals(InventoryTransactionType.ISSUE, tx.getType());
            assertEquals(bd("30"), tx.getQuantity());
        }

        @Test
        void loan_createsExactlyOneTransaction() {
            Item item = item();
            givenStock(item, "20");
            loanService.save(loan(1L, li(item, "5")));

            assertEquals(1, txsFor(item).size());
        }

        @Test
        void loan_transactionHasCorrectTypeAndQuantity() {
            Item item = item();
            givenStock(item, "20");
            loanService.save(loan(1L, li(item, "5")));

            InventoryTransaction tx = lastTx(item);
            assertEquals(InventoryTransactionType.LOAN, tx.getType());
            assertEquals(bd("5"), tx.getQuantity());
        }

        @Test
        void return_createsExactlyOneTransaction() {
            ReturnService returnService = buildReturnService();
            Item item = item();
            givenStock(item, "40"); // Stock after a loan of 10

            Loan savedLoan = loan(1L, li(item, "10"));
            loanStore.put(1L, savedLoan);

            returnService.save(ret(1L, savedLoan, item, "10"));

            assertEquals(1, txsFor(item).size());
        }

        @Test
        void return_transactionHasCorrectTypeAndQuantity() {
            ReturnService returnService = buildReturnService();
            Item item = item();
            givenStock(item, "40");
            Loan savedLoan = loan(1L, li(item, "10"));
            loanStore.put(1L, savedLoan);

            returnService.save(ret(2L, savedLoan, item, "7"));

            InventoryTransaction tx = lastTx(item);
            assertEquals(InventoryTransactionType.RETURN, tx.getType());
            assertEquals(bd("7"), tx.getQuantity());
        }

        @Test
        void transaction_hasTimestampWithinTestExecution() {
            Item item = item();
            Instant before = Instant.now();
            purchaseService.save(purchase(1L, pi(item, "10")));
            Instant after = Instant.now();

            InventoryTransaction tx = lastTx(item);
            assertNotNull(tx.getDate());
            assertFalse(tx.getDate().isBefore(before), "Transaction date must not be before test start");
            assertFalse(tx.getDate().isAfter(after), "Transaction date must not be after test end");
        }

        @Test
        void transaction_recordsCurrentUser() {
            Item item = item();
            purchaseService.save(purchase(1L, pi(item, "10")));

            assertSame(currentUser, lastTx(item).getUser());
        }

        @Test
        void purchase_quantityAfterTransactionMatchesNewStock() {
            Item item = item();
            purchaseService.save(purchase(1L, pi(item, "50")));

            assertEquals(bd("50"), lastTx(item).getQuantityAfterTransaction());
        }

        @Test
        void issue_quantityAfterTransactionMatchesReducedStock() {
            Item item = item();
            givenStock(item, "100");
            issueService.save(issue(1L, ii(item, "30")));

            assertEquals(bd("70"), lastTx(item).getQuantityAfterTransaction());
        }

        @Test
        void loan_quantityAfterTransactionMatchesReducedStock() {
            Item item = item();
            givenStock(item, "20");
            loanService.save(loan(1L, li(item, "5")));

            assertEquals(bd("15"), lastTx(item).getQuantityAfterTransaction());
        }

        @Test
        void sequentialOperations_quantityAfterTransactionTracksRunningBalance() {
            Item item = item();
            purchaseService.save(purchase(1L, pi(item, "100"))); // 100
            issueService.save(issue(2L, ii(item, "30")));         //  70
            loanService.save(loan(3L, li(item, "15")));           //  55

            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(bd("100"), txs.get(0).getQuantityAfterTransaction());
            assertEquals(bd("70"),  txs.get(1).getQuantityAfterTransaction());
            assertEquals(bd("55"),  txs.get(2).getQuantityAfterTransaction());
        }

        @Test
        void transaction_linksToCorrectInventoryRecord() {
            Item a = item(), b = item();
            purchaseService.save(purchase(1L, pi(a, "10"), pi(b, "20")));

            assertEquals(a.getId(), txsFor(a).get(0).getInventory().getItem().getId());
            assertEquals(b.getId(), txsFor(b).get(0).getInventory().getItem().getId());
        }

        @Test
        void multipleItemsInOnePurchase_eachGetsOwnTransaction() {
            Item a = item(), b = item(), c = item();
            purchaseService.save(purchase(1L, pi(a, "10"), pi(b, "20"), pi(c, "30")));

            assertEquals(1, txsFor(a).size());
            assertEquals(1, txsFor(b).size());
            assertEquals(1, txsFor(c).size());
            assertEquals(3, transactionLog.size());
        }
    }

    // =========================================================================
    // referenceId — every transaction is linked back to its source entity
    // =========================================================================

    @Nested
    class ReferenceIdLinking {

        @Test
        void purchase_transactionCarriesPurchaseId() {
            Item item = item();
            purchaseService.save(purchase(42L, pi(item, "10")));

            assertEquals(42L, lastTx(item).getReferenceId());
        }

        @Test
        void issue_transactionCarriesIssueId() {
            Item item = item();
            givenStock(item, "100");
            issueService.save(issue(7L, ii(item, "15")));

            assertEquals(7L, lastTx(item).getReferenceId());
        }

        @Test
        void loan_transactionCarriesLoanId() {
            Item item = item();
            givenStock(item, "50");
            loanService.save(loan(99L, li(item, "8")));

            assertEquals(99L, lastTx(item).getReferenceId());
        }

        @Test
        void return_transactionCarriesReturnId() {
            ReturnService returnService = buildReturnService();
            Item item = item();
            givenStock(item, "40");
            Loan savedLoan = loan(1L, li(item, "10"));
            loanStore.put(1L, savedLoan);

            returnService.save(ret(55L, savedLoan, item, "10"));

            assertEquals(55L, lastTx(item).getReferenceId());
        }

        @Test
        void multipleItemsInOneIssue_allTransactionsShareSameIssueId() {
            Item a = item(), b = item();
            givenStock(a, "100");
            givenStock(b, "100");
            issueService.save(issue(12L, ii(a, "5"), ii(b, "8")));

            assertEquals(12L, lastTx(a).getReferenceId());
            assertEquals(12L, lastTx(b).getReferenceId());
        }

        @Test
        void multipleItemsInOneLoan_allTransactionsShareSameLoanId() {
            Item a = item(), b = item();
            givenStock(a, "50");
            givenStock(b, "50");
            loanService.save(loan(77L, li(a, "3"), li(b, "7")));

            assertEquals(77L, lastTx(a).getReferenceId());
            assertEquals(77L, lastTx(b).getReferenceId());
        }

        @Test
        void updateQty_undoTransactionHasNullReferenceId_applyHasEntityId() {
            // When qty changes, InventoryService does: undoTransaction (null referenceId) + handleTransaction (entity referenceId)
            Item item = item();
            givenStock(item, "100");

            Issue existing = issue(1L, ii(item, "10"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(issue(1L, ii(item, "20")));

            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(2, txs.size());
            assertNull(txs.get(0).getReferenceId(), "Undo transaction must have null referenceId");
            assertEquals(1L, txs.get(1).getReferenceId(), "Apply transaction must carry entity referenceId");
        }

        @Test
        void removedItemFromIssue_undoTransactionHasNullReferenceId() {
            Item a = item(), b = item();
            givenStock(a, "100");
            givenStock(b, "100");

            Issue existing = issue(1L, ii(a, "10"), ii(b, "5"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(issue(1L, ii(a, "10"))); // B removed

            assertNull(lastTx(b).getReferenceId(), "Undo for removed item must have null referenceId");
        }
    }

    // =========================================================================
    // Update operations — correct number and type of audit records
    // =========================================================================

    @Nested
    class UpdateOperations {

        @Test
        void increaseIssueQty_createsUndoThenApplyTransactions() {
            Item item = item();
            givenStock(item, "100");

            Issue existing = issue(1L, ii(item, "10"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(issue(1L, ii(item, "25")));

            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(2, txs.size(), "Qty change must produce exactly 2 transactions: undo + apply");
            // Undo ISSUE via RETURN (reversal)
            assertEquals(InventoryTransactionType.RETURN, txs.get(0).getType());
            assertEquals(bd("10"), txs.get(0).getQuantity());
            // Apply new ISSUE
            assertEquals(InventoryTransactionType.ISSUE, txs.get(1).getType());
            assertEquals(bd("25"), txs.get(1).getQuantity());
        }

        @Test
        void decreaseIssueQty_createsUndoThenApplyTransactions() {
            Item item = item();
            givenStock(item, "100");

            Issue existing = issue(1L, ii(item, "20"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(issue(1L, ii(item, "5")));

            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(2, txs.size());
            assertEquals(InventoryTransactionType.RETURN, txs.get(0).getType());
            assertEquals(bd("20"), txs.get(0).getQuantity());
            assertEquals(InventoryTransactionType.ISSUE, txs.get(1).getType());
            assertEquals(bd("5"), txs.get(1).getQuantity());
        }

        @Test
        void sameQty_noTransactionCreated() {
            Item item = item();
            givenStock(item, "100");

            Issue existing = issue(1L, ii(item, "10"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(issue(1L, ii(item, "10")));

            assertEquals(0, txsFor(item).size(), "Same qty must produce no transactions");
        }

        @Test
        void removeItemFromIssue_createsOneUndoTransaction_otherItemUnaffected() {
            Item a = item(), b = item();
            givenStock(a, "100");
            givenStock(b, "100");

            Issue existing = issue(1L, ii(a, "10"), ii(b, "5"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(issue(1L, ii(a, "10"))); // b removed

            // a: same qty → no transaction
            assertEquals(0, txsFor(a).size());
            // b: removed → RETURN (reversal of ISSUE)
            List<InventoryTransaction> bTxs = txsFor(b);
            assertEquals(1, bTxs.size());
            assertEquals(InventoryTransactionType.RETURN, bTxs.get(0).getType());
            assertEquals(bd("5"), bTxs.get(0).getQuantity());
        }

        @Test
        void increasePurchaseQty_undoViaIssue_thenNewPurchase() {
            Item item = item();
            givenStock(item, "50"); // reflects prior purchase of 50

            Purchase existing = purchase(1L, pi(item, "50"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(existing));

            purchaseService.save(purchase(1L, pi(item, "80")));

            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(2, txs.size());
            // Undo PURCHASE = ISSUE (removes the previously added stock)
            assertEquals(InventoryTransactionType.ISSUE, txs.get(0).getType());
            assertEquals(bd("50"), txs.get(0).getQuantity());
            assertEquals(InventoryTransactionType.PURCHASE, txs.get(1).getType());
            assertEquals(bd("80"), txs.get(1).getQuantity());
        }

        @Test
        void increaseLoanQty_undoViaReturn_thenNewLoan() {
            Item item = item();
            givenStock(item, "20"); // stock after first loan

            Loan existing = loan(1L, li(item, "10"));
            loanStore.put(1L, existing);

            loanService.save(loan(1L, li(item, "15")));

            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(2, txs.size());
            // Undo LOAN = RETURN
            assertEquals(InventoryTransactionType.RETURN, txs.get(0).getType());
            assertEquals(bd("10"), txs.get(0).getQuantity());
            assertEquals(InventoryTransactionType.LOAN, txs.get(1).getType());
            assertEquals(bd("15"), txs.get(1).getQuantity());
        }

        @Test
        void addNewItemToExistingIssue_createsTransactionOnlyForNewItem() {
            Item a = item(), b = item();
            givenStock(a, "90"); // a already issued 10
            givenStock(b, "100");

            Issue existing = issue(1L, ii(a, "10"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(issue(1L, ii(a, "10"), ii(b, "8"))); // b newly added

            assertEquals(0, txsFor(a).size(), "Unchanged item must produce no transactions");
            assertEquals(1, txsFor(b).size(), "Newly added item must produce one transaction");
            assertEquals(InventoryTransactionType.ISSUE, lastTx(b).getType());
            assertEquals(bd("8"), lastTx(b).getQuantity());
        }
    }

    // =========================================================================
    // Isolation — operations on one item must not touch others
    // =========================================================================

    @Nested
    class Isolation {

        @Test
        void purchaseOneItem_otherItemHasZeroTransactionsAndUnchangedStock() {
            Item a = item(), b = item();
            givenStock(b, "30");

            purchaseService.save(purchase(1L, pi(a, "50")));

            assertEquals(0, txsFor(b).size());
            assertEquals(bd("30"), stockOf(b));
        }

        @Test
        void issueFromTwoItems_thirdItemCompletelyUnaffected() {
            Item a = item(), b = item(), c = item();
            givenStock(a, "100");
            givenStock(b, "100");
            givenStock(c, "50");

            issueService.save(issue(1L, ii(a, "10"), ii(b, "20")));

            assertEquals(1, txsFor(a).size());
            assertEquals(1, txsFor(b).size());
            assertEquals(0, txsFor(c).size(), "Uninvolved item must have no transactions");
            assertEquals(bd("50"), stockOf(c), "Uninvolved item stock must be unchanged");
        }

        @Test
        void twoSeparatePurchases_transactionLogsAreIndependent() {
            Item a = item(), b = item();

            purchaseService.save(purchase(1L, pi(a, "30")));
            purchaseService.save(purchase(2L, pi(b, "40")));

            assertEquals(1, txsFor(a).size());
            assertEquals(1, txsFor(b).size());
            assertEquals(1L, lastTx(a).getReferenceId());
            assertEquals(2L, lastTx(b).getReferenceId());
        }
    }

    // =========================================================================
    // Cross-service workflows
    // =========================================================================

    @Nested
    class CrossServiceWorkflows {

        @Test
        void purchaseThenIssue_stockCorrectAndBothTransactionsPresent() {
            Item item = item();

            purchaseService.save(purchase(1L, pi(item, "100")));
            issueService.save(issue(2L, ii(item, "30")));

            assertEquals(bd("70"), stockOf(item));
            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(2, txs.size());
            assertEquals(InventoryTransactionType.PURCHASE, txs.get(0).getType());
            assertEquals(bd("100"), txs.get(0).getQuantity());
            assertEquals(1L, txs.get(0).getReferenceId());
            assertEquals(InventoryTransactionType.ISSUE, txs.get(1).getType());
            assertEquals(bd("30"), txs.get(1).getQuantity());
            assertEquals(2L, txs.get(1).getReferenceId());
        }

        @Test
        void purchaseThenLoan_stockCorrectAndBothTransactionsPresent() {
            Item item = item();

            purchaseService.save(purchase(1L, pi(item, "50")));
            loanService.save(loan(2L, li(item, "15")));

            assertEquals(bd("35"), stockOf(item));
            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(2, txs.size());
            assertEquals(InventoryTransactionType.PURCHASE, txs.get(0).getType());
            assertEquals(InventoryTransactionType.LOAN, txs.get(1).getType());
            assertEquals(1L, txs.get(0).getReferenceId());
            assertEquals(2L, txs.get(1).getReferenceId());
        }

        @Test
        void purchaseThenLoanThenReturn_stockRestoredAndAuditTrailComplete() {
            ReturnService returnService = buildReturnService();
            Item item = item();

            purchaseService.save(purchase(1L, pi(item, "30")));
            Loan l = loan(2L, li(item, "10"));
            loanService.save(l);
            returnService.save(ret(3L, l, item, "10"));

            assertEquals(bd("30"), stockOf(item), "All loaned items returned → original stock restored");

            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(3, txs.size());
            assertEquals(InventoryTransactionType.PURCHASE, txs.get(0).getType()); // +30
            assertEquals(InventoryTransactionType.LOAN, txs.get(1).getType());     // -10
            assertEquals(InventoryTransactionType.RETURN, txs.get(2).getType());   // +10
            assertEquals(1L, txs.get(0).getReferenceId());
            assertEquals(2L, txs.get(1).getReferenceId());
            assertEquals(3L, txs.get(2).getReferenceId());
        }

        @Test
        void purchaseThenLoanThenPartialReturn_stockReflectsNetChange() {
            ReturnService returnService = buildReturnService();
            Item item = item();

            purchaseService.save(purchase(1L, pi(item, "30")));
            Loan l = loan(2L, li(item, "10"));
            loanService.save(l);
            returnService.save(ret(3L, l, item, "7")); // 3 not returned

            // 30 - 10 (loan) + 7 (return) = 27
            assertEquals(bd("27"), stockOf(item));
        }

        @Test
        void issueAndLoanFromSameStock_bothDeductCorrectly_distinctTransactionTypes() {
            Item item = item();
            givenStock(item, "100");

            issueService.save(issue(1L, ii(item, "20")));
            loanService.save(loan(2L, li(item, "15")));

            assertEquals(bd("65"), stockOf(item));
            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(2, txs.size());
            assertEquals(InventoryTransactionType.ISSUE, txs.get(0).getType());
            assertEquals(InventoryTransactionType.LOAN, txs.get(1).getType());
        }

        @Test
        void multiplePurchasesOfSameItem_stockAccumulatesAndEachHasOwnReferenceId() {
            Item item = item();

            purchaseService.save(purchase(1L, pi(item, "50")));
            purchaseService.save(purchase(2L, pi(item, "30")));
            purchaseService.save(purchase(3L, pi(item, "20")));

            assertEquals(bd("100"), stockOf(item));
            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(3, txs.size());
            txs.forEach(tx -> assertEquals(InventoryTransactionType.PURCHASE, tx.getType()));
            assertEquals(1L, txs.get(0).getReferenceId());
            assertEquals(2L, txs.get(1).getReferenceId());
            assertEquals(3L, txs.get(2).getReferenceId());
        }

        @Test
        void fullLabCycle_stockCorrectAndCompleteAuditTrail() {
            ReturnService returnService = buildReturnService();
            Item item = item();

            // Lab receives 100 units
            purchaseService.save(purchase(1L, pi(item, "100")));
            // Lab issues 20 as permanent consumables
            issueService.save(issue(2L, ii(item, "20")));
            // Student borrows 30 units
            Loan l = loan(3L, li(item, "30"));
            loanService.save(l);
            // Student returns 25 (5 consumed/lost)
            returnService.save(ret(4L, l, item, "25"));

            // 100 - 20 (issue) - 30 (loan) + 25 (return) = 75
            assertEquals(bd("75"), stockOf(item));

            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(4, txs.size());

            assertEquals(InventoryTransactionType.PURCHASE, txs.get(0).getType());
            assertEquals(bd("100"), txs.get(0).getQuantity());
            assertEquals(1L, txs.get(0).getReferenceId());

            assertEquals(InventoryTransactionType.ISSUE, txs.get(1).getType());
            assertEquals(bd("20"), txs.get(1).getQuantity());
            assertEquals(2L, txs.get(1).getReferenceId());

            assertEquals(InventoryTransactionType.LOAN, txs.get(2).getType());
            assertEquals(bd("30"), txs.get(2).getQuantity());
            assertEquals(3L, txs.get(2).getReferenceId());

            assertEquals(InventoryTransactionType.RETURN, txs.get(3).getType());
            assertEquals(bd("25"), txs.get(3).getQuantity());
            assertEquals(4L, txs.get(3).getReferenceId());
        }

        @Test
        void multipleItems_crossService_eachItemsAuditTrailIsIndependent() {
            Item microscope = item(), slides = item();
            givenStock(microscope, "10");
            givenStock(slides, "500");

            // Loan: microscope(2) + slides(50)
            loanService.save(loan(1L, li(microscope, "2"), li(slides, "50")));
            // Issue more slides only
            issueService.save(issue(2L, ii(slides, "100")));

            // Microscope: only one LOAN transaction
            List<InventoryTransaction> microscopeTxs = txsFor(microscope);
            assertEquals(1, microscopeTxs.size());
            assertEquals(InventoryTransactionType.LOAN, microscopeTxs.get(0).getType());
            assertEquals(bd("2"), microscopeTxs.get(0).getQuantity());

            // Slides: LOAN + ISSUE
            List<InventoryTransaction> slidesTxs = txsFor(slides);
            assertEquals(2, slidesTxs.size());
            assertEquals(InventoryTransactionType.LOAN, slidesTxs.get(0).getType());
            assertEquals(InventoryTransactionType.ISSUE, slidesTxs.get(1).getType());

            assertEquals(bd("8"), stockOf(microscope));
            assertEquals(bd("350"), stockOf(slides));
        }

        @Test
        void sequentialIssues_auditTrailAndStockBothConsistent() {
            Item item = item();
            givenStock(item, "200");

            issueService.save(issue(1L, ii(item, "30")));
            issueService.save(issue(2L, ii(item, "40")));
            issueService.save(issue(3L, ii(item, "50")));

            assertEquals(bd("80"), stockOf(item));

            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(3, txs.size());
            txs.forEach(tx -> assertEquals(InventoryTransactionType.ISSUE, tx.getType()));
            assertEquals(bd("30"), txs.get(0).getQuantity());
            assertEquals(bd("40"), txs.get(1).getQuantity());
            assertEquals(bd("50"), txs.get(2).getQuantity());
        }

        @Test
        void loanThenReturn_thenAnotherLoan_stockAndAuditCorrectThroughoutCycle() {
            ReturnService returnService = buildReturnService();
            Item item = item();
            givenStock(item, "10");

            // Loan 3 units
            Loan l1 = loan(1L, li(item, "3"));
            loanService.save(l1);
            assertEquals(bd("7"), stockOf(item));

            // Return all 3
            returnService.save(ret(1L, l1, item, "3"));
            assertEquals(bd("10"), stockOf(item));

            // Second loan: 5 units
            loanService.save(loan(2L, li(item, "5")));
            assertEquals(bd("5"), stockOf(item));

            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(3, txs.size());
            assertEquals(InventoryTransactionType.LOAN, txs.get(0).getType());
            assertEquals(InventoryTransactionType.RETURN, txs.get(1).getType());
            assertEquals(InventoryTransactionType.LOAN, txs.get(2).getType());
            assertEquals(1L, txs.get(0).getReferenceId()); // loan 1
            assertEquals(1L, txs.get(1).getReferenceId()); // return 1
            assertEquals(2L, txs.get(2).getReferenceId()); // loan 2
        }
    }

    // =========================================================================
    // Stock integrity after corrections
    // =========================================================================

    @Nested
    class StockIntegrity {

        @Test
        void removePurchaseItem_undoTransactionReducesStockCorrectly() {
            Item item = item();
            givenStock(item, "50");

            Purchase existing = purchase(1L, pi(item, "50"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(existing));

            purchaseService.save(purchase(1L)); // empty items → remove the item entirely

            assertEquals(bd("0"), stockOf(item));
            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(1, txs.size());
            assertEquals(InventoryTransactionType.ISSUE, txs.get(0).getType()); // undo PURCHASE = ISSUE
            assertEquals(bd("50"), txs.get(0).getQuantity());
        }

        @Test
        void purchaseCorrectedDownward_twoTransactionsAndFinalStockCorrect() {
            Item item = item();
            givenStock(item, "100");

            Purchase existing = purchase(1L, pi(item, "100"));
            when(purchaseRepository.findById(1L)).thenReturn(Optional.of(existing));

            purchaseService.save(purchase(1L, pi(item, "75")));

            assertEquals(bd("75"), stockOf(item));
            assertEquals(2, txsFor(item).size(), "Undo + apply = 2 transactions");
        }

        @Test
        void issueCorrectedUpward_stockFurtherReduced() {
            // Stock is 100 (reflects: original 110, minus an existing issue of 10).
            // Updating the issue from 10 → 35 undoes 10 first (→ 110), then applies 35 (→ 75).
            Item item = item();
            givenStock(item, "100");

            Issue existing = issue(1L, ii(item, "10"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));

            issueService.save(issue(1L, ii(item, "35")));

            assertEquals(bd("75"), stockOf(item));
        }

        @Test
        void totalTransactionCount_acrossComplexWorkflow_matchesExpected() {
            Item item = item();

            // 1 purchase
            purchaseService.save(purchase(1L, pi(item, "100")));
            // 1 issue
            issueService.save(issue(2L, ii(item, "20")));
            // 1 loan
            Loan l = loan(3L, li(item, "10"));
            loanService.save(l);
            // update issue qty (2 transactions: undo + apply)
            Issue existingIssue = issue(2L, ii(item, "20"));
            when(issueRepository.findById(2L)).thenReturn(Optional.of(existingIssue));
            issueService.save(issue(2L, ii(item, "25")));

            // Total: PURCHASE(1) + ISSUE(1) + LOAN(1) + RETURN/undo(1) + ISSUE/apply(1) = 5
            assertEquals(5, txsFor(item).size());
        }
    }

    // =========================================================================
    // User attribution
    // =========================================================================

    @Nested
    class UserAttribution {

        @Test
        void multipleOperationsByDifferentUsers_eachTransactionHasItsOwnUser() {
            User alice = new User(); alice.setId(1L); alice.setNome("Alice");
            User bob = new User(); bob.setId(2L); bob.setNome("Bob");

            Item item = item();

            when(userService.getCurrentUser()).thenReturn(alice);
            purchaseService.save(purchase(1L, pi(item, "50")));

            when(userService.getCurrentUser()).thenReturn(bob);
            issueService.save(issue(2L, ii(item, "10")));

            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(2, txs.size());
            assertSame(alice, txs.get(0).getUser(), "First transaction must be attributed to Alice");
            assertSame(bob, txs.get(1).getUser(), "Second transaction must be attributed to Bob");
        }

        @Test
        void updateQty_bothUndoAndApplyTransactionsAttributedToCurrentUser() {
            User operator = new User(); operator.setId(5L); operator.setNome("Operator");
            when(userService.getCurrentUser()).thenReturn(operator);

            Item item = item();
            givenStock(item, "100");

            Issue existing = issue(1L, ii(item, "10"));
            when(issueRepository.findById(1L)).thenReturn(Optional.of(existing));
            issueService.save(issue(1L, ii(item, "20")));

            List<InventoryTransaction> txs = txsFor(item);
            assertEquals(2, txs.size());
            txs.forEach(tx -> assertSame(operator, tx.getUser()));
        }
    }

    // =========================================================================
    // Return-specific: quantityIssued must NOT create inventory transactions
    // =========================================================================

    @Nested
    class ReturnSpecificBehavior {

        @Test
        void quantityIssued_doesNotCreateInventoryTransaction() {
            ReturnService returnService = buildReturnService();
            Item item = item();
            givenStock(item, "40");
            Loan l = loan(1L, li(item, "10"));
            loanStore.put(1L, l);

            // Return 0, issue 10 (all consumed — only quantityReturned affects stock)
            ReturnItem ri = new ReturnItem();
            ri.setItem(item);
            ri.setQuantityReturned(BigDecimal.ZERO);
            ri.setQuantityIssued(bd("10"));

            Return r = new Return();
            r.setId(2L);
            r.setReturnDate(Instant.now());
            r.setLoan(l);
            r.setItems(new ArrayList<>(List.of(ri)));

            returnService.save(r);

            // quantityIssued doesn't touch inventory directly
            assertEquals(0, txsFor(item).size(), "quantityIssued must not create inventory transactions");
            assertEquals(bd("40"), stockOf(item), "Stock must be unchanged when nothing is returned");
        }

        @Test
        void quantityReturned_createsReturnTransaction_quantityIssued_doesNot() {
            ReturnService returnService = buildReturnService();
            Item item = item();
            givenStock(item, "40");
            Loan l = loan(1L, li(item, "10"));
            loanStore.put(1L, l);

            // Return 6, issue 4 (6 physically back, 4 consumed)
            ReturnItem ri = new ReturnItem();
            ri.setItem(item);
            ri.setQuantityReturned(bd("6"));
            ri.setQuantityIssued(bd("4"));

            Return r = new Return();
            r.setId(2L);
            r.setReturnDate(Instant.now());
            r.setLoan(l);
            r.setItems(new ArrayList<>(List.of(ri)));

            returnService.save(r);

            // Only one transaction: the RETURN of 6
            assertEquals(1, txsFor(item).size());
            assertEquals(InventoryTransactionType.RETURN, lastTx(item).getType());
            assertEquals(bd("6"), lastTx(item).getQuantity());
            assertEquals(bd("46"), stockOf(item), "Only quantityReturned (6) affects stock");
        }
    }
}
