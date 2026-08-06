package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.CategoryDTO;
import br.edu.utfpr.dainf.dto.FornecedorDTO;
import br.edu.utfpr.dainf.dto.ItemDTO;
import br.edu.utfpr.dainf.dto.LoanDTO;
import br.edu.utfpr.dainf.dto.LoanItemDTO;
import br.edu.utfpr.dainf.dto.PurchaseDTO;
import br.edu.utfpr.dainf.dto.PurchaseItemDTO;
import br.edu.utfpr.dainf.dto.ReturnDTO;
import br.edu.utfpr.dainf.dto.ReturnItemDTO;
import br.edu.utfpr.dainf.dto.SimpleUserDTO;
import br.edu.utfpr.dainf.enums.InventoryTransactionType;
import br.edu.utfpr.dainf.enums.ItemType;
import br.edu.utfpr.dainf.enums.UnidadeFederativa;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.InventoryTransaction;
import br.edu.utfpr.dainf.model.Issue;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.model.Loan;
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.InventoryRepository;
import br.edu.utfpr.dainf.repository.InventoryTransactionRepository;
import br.edu.utfpr.dainf.repository.IssueRepository;
import br.edu.utfpr.dainf.repository.ItemRepository;
import br.edu.utfpr.dainf.repository.LoanRepository;
import br.edu.utfpr.dainf.repository.UserRepository;
import br.edu.utfpr.dainf.shared.ApplicationTest;
import com.fasterxml.jackson.databind.JsonNode;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Reproduces the reported gap where returning a loan with an "issued" (lost/damaged)
 * quantity produced no InventoryTransaction audit row and no traceable Issue reference,
 * because ReturnService.createIssue() always called IssueService.save(issue, false), which
 * skipped the whole validate/apply/audit pipeline instead of just the quantity mutation.
 */
@ApplicationTest
@AutoConfigureMockMvc
class ReturnIssueAuditIntegrationTest {

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
    IssueRepository issueRepository;

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
    private ItemDTO item;
    private Long loanId;

    @BeforeEach
    void setUp() throws Exception {
        adminUser = userRepository.findByEmail("admin@issue-audit-test.com").orElseGet(() -> {
            User user = User.builder()
                    .email("admin@issue-audit-test.com")
                    .password("Admin1")
                    .nome("Admin Issue Audit Test")
                    .telefone("46999999999")
                    .role(UserRole.valueOf(UserRole.ADMIN))
                    .enabled(true)
                    .build();
            return userRepository.save(user);
        });
        borrower = new SimpleUserDTO(adminUser.getId(), adminUser.getEmail(), adminUser.getNome());

        ResponseEntity<Long> categoryResponse = categoryController.create(
                new CategoryDTO(null, "Categoria Issue Audit Teste", "icon", List.of()));
        CategoryDTO category = new CategoryDTO(categoryResponse.getBody(), "Categoria Issue Audit Teste", "icon", List.of());

        ResponseEntity<Long> itemResponse = itemController.create(
                ItemDTO.builder().name("Item Issue Audit Teste").category(category).type(ItemType.CONSUMABLE).build());
        item = ItemDTO.builder().id(itemResponse.getBody()).build();

        FornecedorDTO fornecedor = new FornecedorDTO(null, "Fornecedor Issue Audit Teste", "Razão Social Issue Audit",
                "35258347000113", null, "Rua Teste", null, "issue-audit@gmail.com", "46999990000", "Pato Branco", UnidadeFederativa.PR);
        ResponseEntity<Long> fornecedorResponse = fornecedorController.create(fornecedor);
        fornecedor.setId(fornecedorResponse.getBody());

        PurchaseItemDTO purchaseItem = PurchaseItemDTO.builder()
                .item(item).quantity(new BigDecimal("10")).price(BigDecimal.ONE).build();
        purchaseController.create(PurchaseDTO.builder()
                .date(Instant.now())
                .fornecedor(fornecedor)
                .items(List.of(purchaseItem))
                .build());

        LoanDTO loanDto = new LoanDTO();
        loanDto.setBorrower(borrower);
        loanDto.setLoanDate(Instant.now());
        loanDto.setDeadline(Instant.now().plus(7, ChronoUnit.DAYS));
        loanDto.setItems(List.of(new LoanItemDTO(null, item, true, new BigDecimal("5"))));

        MvcResult loanResult = mockMvc.perform(post("/loans")
                        .with(auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loanDto)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode node = objectMapper.readTree(loanResult.getResponse().getContentAsString());
        loanId = node.has("id") ? node.get("id").asLong() : node.asLong();
    }

    private RequestPostProcessor auth() {
        return SecurityMockMvcRequestPostProcessors.user(adminUser);
    }

    private BigDecimal stockOfItem() {
        Item entity = itemRepository.findById(item.getId()).orElseThrow();
        return inventoryRepository.findByItem(entity).map(inv -> inv.getQuantity()).orElse(BigDecimal.ZERO);
    }

    private static void assertStockEquals(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual),
                () -> "expected stock " + expected + " but was " + actual);
    }

    private List<InventoryTransaction> issueAuditRowsForLoan() {
        Loan loan = loanRepository.findById(loanId).orElseThrow();
        Issue issue = issueRepository.findByLoan(loan).orElseThrow();
        return inventoryTransactionRepository.findAll().stream()
                .filter(tx -> tx.getType() == InventoryTransactionType.ISSUE)
                .filter(tx -> issue.getId().equals(tx.getReferenceId()))
                .toList();
    }

    @Test
    void returnWithIssuedQuantity_recordsAuditRow_stockUnchangedByIssue() throws Exception {
        ReturnDTO returnDto = ReturnDTO.builder()
                .returnDate(Instant.now())
                .loan(new LoanDTO(loanId))
                .items(List.of(ReturnItemDTO.builder()
                        .item(item)
                        .quantityReturned(BigDecimal.ZERO)
                        .quantityIssued(new BigDecimal("2"))
                        .build()))
                .build();

        mockMvc.perform(post("/returns")
                        .with(auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(returnDto)))
                .andExpect(status().isCreated());

        // LOAN already removed the 5 units; ISSUE must not remove them a second time.
        assertStockEquals("5", stockOfItem());

        List<InventoryTransaction> issueAudits = issueAuditRowsForLoan();
        assertEquals(1, issueAudits.size(), "exactly one ISSUE audit row should be recorded for the auto-generated Issue");
        assertEquals(0, new BigDecimal("2").compareTo(issueAudits.get(0).getQuantity()));
    }

    @Test
    void returnUpdatedWithHigherIssuedQuantity_recordsSecondAuditRow() throws Exception {
        Long returnId = createInitialReturn(new BigDecimal("2"));

        ReturnDTO update = ReturnDTO.builder()
                .id(returnId)
                .returnDate(Instant.now())
                .loan(new LoanDTO(loanId))
                .items(List.of(ReturnItemDTO.builder()
                        .item(item)
                        .quantityReturned(BigDecimal.ZERO)
                        .quantityIssued(new BigDecimal("5"))
                        .build()))
                .build();

        mockMvc.perform(put("/returns/" + returnId)
                        .with(auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk());

        assertStockEquals("5", stockOfItem());

        List<InventoryTransaction> issueAudits = issueAuditRowsForLoan();
        assertEquals(2, issueAudits.size(), "each return event should append its own ISSUE audit row");
        assertTrue(issueAudits.stream().anyMatch(tx -> new BigDecimal("2").compareTo(tx.getQuantity()) == 0));
        assertTrue(issueAudits.stream().anyMatch(tx -> new BigDecimal("5").compareTo(tx.getQuantity()) == 0));
    }

    private Long createInitialReturn(BigDecimal quantityIssued) throws Exception {
        ReturnDTO returnDto = ReturnDTO.builder()
                .returnDate(Instant.now())
                .loan(new LoanDTO(loanId))
                .items(List.of(ReturnItemDTO.builder()
                        .item(item)
                        .quantityReturned(BigDecimal.ZERO)
                        .quantityIssued(quantityIssued)
                        .build()))
                .build();

        MvcResult result = mockMvc.perform(post("/returns")
                        .with(auth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(returnDto)))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
        return node.has("id") ? node.get("id").asLong() : node.asLong();
    }
}
