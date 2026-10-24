package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.enums.ItemType;
import br.edu.utfpr.dainf.enums.LoanStatus;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.*;
import br.edu.utfpr.dainf.repository.InventoryRepository;
import br.edu.utfpr.dainf.repository.ItemRepository;
import br.edu.utfpr.dainf.service.InventoryService;
import br.edu.utfpr.dainf.service.ItemLifecycleService;
import br.edu.utfpr.dainf.shared.ApplicationTest;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ApplicationTest
@AutoConfigureMockMvc
class ItemLifecycleIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired EntityManager em;
    @Autowired ItemRepository items;
    @Autowired InventoryRepository inventories;
    @Autowired ItemLifecycleService lifecycle;
    @Autowired InventoryService inventory;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired javax.sql.DataSource dataSource;

    private TransactionTemplate tx() { return new TransactionTemplate(transactionManager); }

    private Item item() {
        return tx().execute(status -> {
            Category category = new Category();
            category.setDescription("Lifecycle " + UUID.randomUUID());
            em.persist(category);
            Item item = new Item();
            item.setName("Lifecycle " + UUID.randomUUID());
            item.setCategory(category);
            item.setType(ItemType.DURABLE);
            em.persist(item);
            return item;
        });
    }

    @Test
    void deactivateReactivateAndKeepHistoricalLookup() throws Exception {
        Item item = item();
        mvc.perform(put("/items/{id}/active", item.getId()).with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        String search = "{\"filters\":[{\"field\":\"id\",\"type\":\"EQUALS\",\"value\":" + item.getId() + "}]}";
        mvc.perform(post("/items/search").with(user("student").roles("STUDENT"))
                .contentType(MediaType.APPLICATION_JSON).content(search))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
        mvc.perform(post("/items/search/all").with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(search))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].id").value(item.getId()));
        mvc.perform(get("/items/{id}", item.getId()).with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        mvc.perform(put("/items/{id}/active", item.getId()).with(user("tech").roles("LAB_TECHNICIAN"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"active\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(true));
        Long revisions = tx().execute(s -> ((Number) em.createNativeQuery(
                "select count(*) from item_aud where id = :id and active = false")
                .setParameter("id", item.getId()).getSingleResult()).longValue());
        assertTrue(revisions > 0);
    }

    @Test
    void studentsCannotChangeStatusOrSearchInactiveItems() throws Exception {
        Item item = item();
        mvc.perform(put("/items/{id}/active", item.getId()).with(user("student").roles("STUDENT"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/items/search/all").with(user("student").roles("STUDENT"))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void ordinaryUpdateCannotReactivateAnItem() throws Exception {
        Item item = item();
        lifecycle.changeActive(item.getId(), false);
        String body = "{\"name\":\"Edited\",\"type\":\"DURABLE\",\"active\":true,\"category\":{\"id\":" + item.getCategory().getId() + "}}";
        mvc.perform(put("/items/{id}", item.getId()).with(user("admin").roles("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        assertFalse(items.findById(item.getId()).orElseThrow().isActive());
    }

    @Test
    void nonzeroBalancePreventsDeactivation() {
        Item item = item();
        inventories.save(new Inventory(item, BigDecimal.ONE));
        assertThrows(WarnException.class, () -> lifecycle.changeActive(item.getId(), false));
        assertTrue(items.findById(item.getId()).orElseThrow().isActive());
    }

    @Test
    void stockFilterUsesTheWholeDatabaseAndTreatsMissingInventoryAsZero() throws Exception {
        Item withoutInventory = item();
        Item zeroBalance = item();
        Item positiveBalance = item();
        inventories.save(new Inventory(zeroBalance, BigDecimal.ZERO));
        inventories.save(new Inventory(positiveBalance, new BigDecimal("3.5")));

        String itemIds = "[" + withoutInventory.getId() + "," + zeroBalance.getId()
                + "," + positiveBalance.getId() + "]";
        String zeroSearch = "{\"rows\":1,\"filters\":["
                + "{\"field\":\"id\",\"type\":\"IN\",\"value\":" + itemIds + "},"
                + "{\"field\":\"stockStatus\",\"type\":\"EQUALS\",\"value\":\"ZERO\"}]}";

        mvc.perform(post("/items/search/all").with(user("admin").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON).content(zeroSearch))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.totalElements").value(2))
                .andExpect(jsonPath("$.content.length()").value(1));

        String positiveSearch = "{\"filters\":["
                + "{\"field\":\"id\",\"type\":\"IN\",\"value\":" + itemIds + "},"
                + "{\"field\":\"stockStatus\",\"type\":\"EQUALS\",\"value\":\"POSITIVE\"}]}";
        mvc.perform(post("/items/search/all").with(user("admin").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON).content(positiveSearch))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.totalElements").value(1))
                .andExpect(jsonPath("$.content[*].id",
                        containsInAnyOrder(positiveBalance.getId().intValue())));
    }

    @Test
    void invalidStockFilterIsRejected() throws Exception {
        String search = "{\"filters\":[{\"field\":\"stockStatus\","
                + "\"type\":\"EQUALS\",\"value\":\"UNKNOWN\"}]}";
        mvc.perform(post("/items/search/all").with(user("admin").roles("ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON).content(search))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Filtro de saldo inválido."));
    }

    @Test
    void pendingIsCalculatedPerItemEvenWhenLoanStatusIsStale() {
        Item settled = item();
        Item pending = item();
        Loan loan = loan(settled, pending);
        assertThrows(WarnException.class, () -> lifecycle.changeActive(settled.getId(), false));
        tx().executeWithoutResult(s -> {
            Return ret = new Return();
            ret.setLoan(em.getReference(Loan.class, loan.getId()));
            ret.setReturnDate(Instant.now());
            ReturnItem line = new ReturnItem();
            line.setAReturn(ret);
            line.setItem(em.getReference(Item.class, settled.getId()));
            line.setQuantityReturned(new BigDecimal("0.4"));
            line.setQuantityIssued(new BigDecimal("0.6"));
            ret.setItems(List.of(line));
            em.persist(ret);
        });
        assertFalse(lifecycle.changeActive(settled.getId(), false).isActive());
        assertThrows(WarnException.class, () -> lifecycle.changeActive(pending.getId(), false));
    }

    private Loan loan(Item... material) {
        return tx().execute(s -> {
            Loan loan = new Loan();
            loan.setLoanDate(Instant.now());
            // Intentionally stale: pending item quantities, not status, decide eligibility.
            loan.setStatus(LoanStatus.COMPLETED);
            loan.setItems(java.util.Arrays.stream(material).map(item -> {
                LoanItem line = new LoanItem();
                line.setItem(em.getReference(Item.class, item.getId()));
                line.setLoan(loan);
                line.setQuantity(BigDecimal.ONE);
                line.setShouldReturn(true);
                return line;
            }).toList());
            em.persist(loan);
            return loan;
        });
    }

    @ParameterizedTest
    @EnumSource(InventoryTransactionType.class)
    void legacyAndDeletedMovementLinesPreventDeletion(InventoryTransactionType type) {
        Item item = item();
        Object line = tx().execute(s -> {
            Item ref = em.getReference(Item.class, item.getId());
            Object entity = switch (type) {
                case PURCHASE -> { PurchaseItem l = new PurchaseItem(); l.setItem(ref); l.setQuantity(BigDecimal.ONE); l.setPrice(BigDecimal.ONE); yield l; }
                case ISSUE -> { IssueItem l = new IssueItem(); l.setItem(ref); l.setQuantity(BigDecimal.ONE); yield l; }
                case LOAN -> { LoanItem l = new LoanItem(); l.setItem(ref); l.setQuantity(BigDecimal.ONE); yield l; }
                case RETURN -> { ReturnItem l = new ReturnItem(); l.setItem(ref); l.setQuantityReturned(BigDecimal.ONE); l.setQuantityIssued(BigDecimal.ZERO); yield l; }
            };
            em.persist(entity);
            return entity;
        });
        // Simulate the legacy import: original lines exist, but no ledger or audit rows.
        String auditTable = switch (type) {
            case PURCHASE -> "purchase_item_aud";
            case ISSUE -> "issue_item_aud";
            case LOAN -> "loan_item_aud";
            case RETURN -> "return_item_aud";
        };
        tx().executeWithoutResult(s -> em.createNativeQuery("DELETE FROM " + auditTable + " WHERE item_id = :id")
                .setParameter("id", item.getId()).executeUpdate());
        assertThrows(WarnException.class, () -> lifecycle.delete(item.getId()));
        tx().executeWithoutResult(s -> em.remove(em.merge(line)));
        // Envers retains evidence even after the original operation is removed.
        assertThrows(WarnException.class, () -> lifecycle.delete(item.getId()));
    }

    @Test
    void unusedItemCanBeDeletedIncludingEmptyInventory() throws Exception {
        Item item = item();
        inventories.save(new Inventory(item, BigDecimal.ZERO));
        mvc.perform(delete("/items/{id}", item.getId()).with(user("admin").roles("ADMIN")))
                .andExpect(status().isNoContent());
        assertFalse(items.existsById(item.getId()));
    }

    @ParameterizedTest
    @EnumSource(InventoryTransactionType.class)
    void staleClientCannotMoveInactiveItem(InventoryTransactionType type) {
        Item item = item();
        lifecycle.changeActive(item.getId(), false);
        assertThrows(WarnException.class, () -> inventory.handleTransaction(item, BigDecimal.ONE, type));
        assertTrue(inventories.findByItem(item).isEmpty());
    }

    @Test
    void unchangedHistoricalLinesRemainEditableButQuantityChangesDoNot() {
        Item item = item();
        lifecycle.changeActive(item.getId(), false);
        PurchaseItem oldLine = new PurchaseItem(); oldLine.setItem(item); oldLine.setQuantity(BigDecimal.ONE);
        PurchaseItem newLine = new PurchaseItem(); newLine.setItem(item); newLine.setQuantity(new BigDecimal("1.00"));
        assertDoesNotThrow(() -> lifecycle.validateChanges(List.of(oldLine), List.of(newLine)));
        newLine.setQuantity(BigDecimal.TEN);
        assertThrows(WarnException.class, () -> lifecycle.validateChanges(List.of(oldLine), List.of(newLine)));
        assertThrows(WarnException.class, () -> lifecycle.validateChanges(List.of(oldLine), List.of()));
    }


    @Test
    void nonReturnableLoanDoesNotCreateAPendingReturn() {
        Item item = item();
        Loan loan = loan(item);
        tx().executeWithoutResult(s -> em.find(Loan.class, loan.getId()).getItems().getFirst().setShouldReturn(false));
        assertFalse(lifecycle.changeActive(item.getId(), false).isActive());
        assertThrows(WarnException.class, () -> lifecycle.delete(item.getId()));
    }

    @Test
    void reservationReferencePreventsDeletionWithoutMovement() {
        Item item = item();
        tx().executeWithoutResult(s -> {
            ReservationItem line = new ReservationItem();
            line.setItem(em.getReference(Item.class, item.getId()));
            line.setQuantity(BigDecimal.ONE);
            em.persist(line);
        });
        WarnException error = assertThrows(WarnException.class, () -> lifecycle.delete(item.getId()));
        assertTrue(error.getMessage().contains("reservas"));
    }

    @Test
    void migrationBackfillsOldItemsAndPreservesInactiveValuesOnRerun() throws Exception {
        // A separate schema isolates the pre-upgrade shape from Hibernate's test schema.
        String schema = "lifecycle_upgrade_" + UUID.randomUUID().toString().replace("-", "");
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE SCHEMA " + schema);
            try {
                statement.execute("SET search_path TO " + schema);
                statement.execute("CREATE TABLE item (id bigint PRIMARY KEY)");
                statement.execute("CREATE TABLE item_aud (id bigint, rev integer)");
                statement.execute("INSERT INTO item VALUES (1), (2)");
                statement.execute("INSERT INTO item_aud VALUES (1, 1)");
                String sql = java.nio.file.Files.readString(java.nio.file.Path.of("docs/item-lifecycle.sql"));
                statement.execute(sql);
                try (var result = statement.executeQuery("SELECT bool_and(active) FROM item")) {
                    assertTrue(result.next()); assertTrue(result.getBoolean(1));
                }
                statement.execute("UPDATE item SET active = false WHERE id = 2");
                statement.execute(sql);
                try (var result = statement.executeQuery("SELECT active FROM item WHERE id = 2")) {
                    assertTrue(result.next()); assertFalse(result.getBoolean(1));
                }
                try (var result = statement.executeQuery("SELECT active, active_mod FROM item_aud")) {
                    assertTrue(result.next()); assertTrue(result.getBoolean(1)); assertFalse(result.getBoolean(2));
                }
            } finally {
                statement.execute("SET search_path TO public");
                statement.execute("DROP SCHEMA " + schema + " CASCADE");
            }
        }
    }

    @Test
    void inactivationAndMovementSerializeOnTheItem() throws Exception {
        Item item = item();
        CountDownLatch locked = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        try (ExecutorService threads = Executors.newFixedThreadPool(2)) {
            Future<?> deactivate = threads.submit(() -> tx().executeWithoutResult(s -> {
                lifecycle.changeActive(item.getId(), false);
                locked.countDown();
                try { assertTrue(release.await(10, TimeUnit.SECONDS)); }
                catch (InterruptedException e) { throw new RuntimeException(e); }
            }));
            assertTrue(locked.await(10, TimeUnit.SECONDS));
            Future<?> move = threads.submit(() -> inventory.handleTransaction(item, BigDecimal.ONE, InventoryTransactionType.PURCHASE));
            try {
                assertThrows(TimeoutException.class, () -> move.get(200, TimeUnit.MILLISECONDS));
            } finally {
                release.countDown();
            }
            deactivate.get(10, TimeUnit.SECONDS);
            ExecutionException failure = assertThrows(ExecutionException.class, () -> move.get(10, TimeUnit.SECONDS));
            assertInstanceOf(WarnException.class, failure.getCause());
        } finally {
            release.countDown();
        }
    }
}
