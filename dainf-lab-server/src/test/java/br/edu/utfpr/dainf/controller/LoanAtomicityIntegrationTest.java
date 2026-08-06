package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.CategoryDTO;
import br.edu.utfpr.dainf.dto.FornecedorDTO;
import br.edu.utfpr.dainf.dto.ItemDTO;
import br.edu.utfpr.dainf.dto.LoanDTO;
import br.edu.utfpr.dainf.dto.LoanItemDTO;
import br.edu.utfpr.dainf.dto.PurchaseDTO;
import br.edu.utfpr.dainf.dto.PurchaseItemDTO;
import br.edu.utfpr.dainf.dto.SimpleUserDTO;
import br.edu.utfpr.dainf.enums.ItemType;
import br.edu.utfpr.dainf.enums.UnidadeFederativa;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.InventoryRepository;
import br.edu.utfpr.dainf.repository.InventoryTransactionRepository;
import br.edu.utfpr.dainf.repository.ItemRepository;
import br.edu.utfpr.dainf.repository.LoanRepository;
import br.edu.utfpr.dainf.repository.UserRepository;
import br.edu.utfpr.dainf.shared.ApplicationTest;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Reproduces the reported "duplicate loan" incident: a multi-item loan where one item is
 * out of stock used to leave a phantom Loan + partially-audited inventory behind after the
 * request failed, prompting users to retry and create real duplicate Loan rows. LoanService,
 * ReturnService and PurchaseService are now wrapped in @Transactional so a failure partway
 * through the per-item inventory diff rolls back the whole save.
 */
@ApplicationTest
@AutoConfigureMockMvc
class LoanAtomicityIntegrationTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Inject
    UserRepository userRepository;

    @Inject
    ItemRepository itemRepository;

    @Inject
    InventoryRepository inventoryRepository;

    @Inject
    InventoryTransactionRepository inventoryTransactionRepository;

    @Inject
    LoanRepository loanRepository;

    @Inject
    CategoryController categoryController;

    @Inject
    ItemController itemController;

    @Inject
    FornecedorController fornecedorController;

    @Inject
    PurchaseController purchaseController;

    private User adminUser;
    private SimpleUserDTO borrower;
    private ItemDTO itemInStock;
    private ItemDTO itemOutOfStock;
    private FornecedorDTO fornecedor;

    @BeforeEach
    void setUp() {
        adminUser = userRepository.findByEmail("admin@atomicity-test.com").orElseGet(() -> {
            User user = User.builder()
                    .email("admin@atomicity-test.com")
                    .password("Admin1")
                    .nome("Admin Atomicity Test")
                    .telefone("46999999999")
                    .role(UserRole.valueOf(UserRole.ADMIN))
                    .enabled(true)
                    .build();
            return userRepository.save(user);
        });
        borrower = new SimpleUserDTO(adminUser.getId(), adminUser.getEmail(), adminUser.getNome());

        ResponseEntity<Long> categoryResponse = categoryController.create(
                new CategoryDTO(null, "Categoria Atomicity Teste", "icon", List.of()));
        CategoryDTO category = new CategoryDTO(categoryResponse.getBody(), "Categoria Atomicity Teste", "icon", List.of());

        ResponseEntity<Long> itemInStockResponse = itemController.create(
                ItemDTO.builder().name("Item Em Estoque").category(category).type(ItemType.CONSUMABLE).build());
        itemInStock = ItemDTO.builder().id(itemInStockResponse.getBody()).build();

        ResponseEntity<Long> itemOutOfStockResponse = itemController.create(
                ItemDTO.builder().name("Item Sem Estoque").category(category).type(ItemType.CONSUMABLE).build());
        itemOutOfStock = ItemDTO.builder().id(itemOutOfStockResponse.getBody()).build();

        fornecedor = new FornecedorDTO(null, "Fornecedor Atomicity Teste", "Razão Social Atomicity",
                "35258347000113", null, "Rua Teste", null, "atomicity@gmail.com", "46999990000", "Pato Branco", UnidadeFederativa.PR);
        ResponseEntity<Long> fornecedorResponse = fornecedorController.create(fornecedor);
        fornecedor.setId(fornecedorResponse.getBody());

        // Only itemInStock receives stock; itemOutOfStock is deliberately left at zero,
        // mirroring "Filamento PETG - Preto" in the reported incident.
        PurchaseItemDTO purchaseItem = PurchaseItemDTO.builder()
                .item(itemInStock)
                .quantity(new BigDecimal("10"))
                .price(BigDecimal.ONE)
                .build();
        purchaseController.create(PurchaseDTO.builder()
                .date(Instant.now())
                .fornecedor(fornecedor)
                .items(List.of(purchaseItem))
                .build());
    }

    private RequestPostProcessor auth() {
        return SecurityMockMvcRequestPostProcessors.user(adminUser);
    }

    private BigDecimal stockOf(ItemDTO itemDto) {
        Item item = itemRepository.findById(itemDto.getId()).orElseThrow();
        return inventoryRepository.findByItem(item).map(inv -> inv.getQuantity()).orElse(BigDecimal.ZERO);
    }

    private static void assertStockEquals(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual),
                () -> "expected stock " + expected + " but was " + actual);
    }

    private LoanDTO loanWithBothItems() {
        LoanDTO dto = new LoanDTO();
        dto.setBorrower(borrower);
        dto.setLoanDate(Instant.now());
        dto.setDeadline(Instant.now().plus(7, ChronoUnit.DAYS));
        dto.setItems(List.of(
                new LoanItemDTO(null, itemInStock, true, BigDecimal.ONE),
                new LoanItemDTO(null, itemOutOfStock, true, BigDecimal.ONE)
        ));
        return dto;
    }

    @Test
    void multiItemLoan_oneItemOutOfStock_wholeLoanRolledBack() throws Exception {
        long loanCountBefore = loanRepository.count();
        long auditCountBefore = inventoryTransactionRepository.count();

        mockMvc.perform(post("/loans")
                        .with(auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loanWithBothItems())))
                .andExpect(status().isBadRequest());

        assertEquals(loanCountBefore, loanRepository.count(),
                "a failed loan must not leave a duplicate/phantom Loan row behind");
        assertEquals(auditCountBefore, inventoryTransactionRepository.count(),
                "a failed loan must not leave a partial inventory audit trail for the item that did succeed");
        assertStockEquals("10", stockOf(itemInStock));
        assertStockEquals("0", stockOf(itemOutOfStock));
    }

    @Test
    void multiItemLoan_afterToppingUpStock_succeedsWithExactlyOneLoanAndAuditPerItem() throws Exception {
        // First attempt fails (out of stock) and is fully rolled back.
        mockMvc.perform(post("/loans")
                        .with(auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loanWithBothItems())))
                .andExpect(status().isBadRequest());

        long loanCountBefore = loanRepository.count();
        long auditCountBefore = inventoryTransactionRepository.count();

        // User tops up stock via a Compra, as in the reported incident.
        purchaseController.create(PurchaseDTO.builder()
                .date(Instant.now())
                .fornecedor(fornecedor)
                .items(List.of(PurchaseItemDTO.builder()
                        .item(itemOutOfStock).quantity(BigDecimal.ONE).price(BigDecimal.ONE).build()))
                .build());

        mockMvc.perform(post("/loans")
                        .with(auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loanWithBothItems())))
                .andExpect(status().isCreated());

        assertEquals(loanCountBefore + 1, loanRepository.count(),
                "exactly one Loan row should be created on the successful retry");
        // Purchase(1) + Loan(2 items) = 3 new audit rows
        assertEquals(auditCountBefore + 3, inventoryTransactionRepository.count());
        assertStockEquals("9", stockOf(itemInStock));
        assertStockEquals("0", stockOf(itemOutOfStock));
    }
}
