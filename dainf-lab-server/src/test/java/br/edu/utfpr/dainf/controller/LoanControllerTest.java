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
import br.edu.utfpr.dainf.model.User;
import br.edu.utfpr.dainf.repository.UserRepository;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class LoanControllerTest extends CrudControllerTest<LoanDTO> {

    @Inject
    UserRepository userRepository;

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

    @BeforeEach
    protected void setUp() {
        adminUser = userRepository.findByEmail("admin@loan-test.com").orElseGet(() -> {
            User user = User.builder()
                    .email("admin@loan-test.com")
                    .password("Admin1")
                    .nome("Admin Test")
                    .telefone("46999999999")
                    .role(UserRole.valueOf(UserRole.ADMIN))
                    .enabled(true)
                    .build();
            return userRepository.save(user);
        });
        borrower = new SimpleUserDTO(adminUser.getId(), adminUser.getEmail(), adminUser.getNome(), adminUser.getDocumento());

        ResponseEntity<Long> categoryResponse = categoryController.create(
                new CategoryDTO(null, "Categoria Loan Teste", "icon", List.of(), true));
        CategoryDTO category = new CategoryDTO(categoryResponse.getBody(), "Categoria Loan Teste", "icon", List.of(), true);

        ItemDTO newItem = ItemDTO.builder()
                .name("Item Loan Teste")
                .category(category)
                .type(ItemType.DURABLE)
                .build();
        ResponseEntity<Long> itemResponse = itemController.create(newItem);
        item = ItemDTO.builder().id(itemResponse.getBody()).build();

        FornecedorDTO fornecedor = new FornecedorDTO(null, "Fornecedor Loan Teste", "Razão Social Loan",
                "35258347000113", null, "Rua Teste", null, "loan@gmail.com", "46999990000", "Pato Branco", UnidadeFederativa.PR);
        ResponseEntity<Long> fornecedorResponse = fornecedorController.create(fornecedor);
        fornecedor.setId(fornecedorResponse.getBody());

        PurchaseItemDTO purchaseItem = PurchaseItemDTO.builder()
                .item(item)
                .quantity(new BigDecimal("10"))
                .price(BigDecimal.ONE)
                .build();
        PurchaseDTO purchase = PurchaseDTO.builder()
                .date(Instant.now())
                .fornecedor(fornecedor)
                .items(List.of(purchaseItem))
                .build();
        purchaseController.create(purchase);
    }

    @Override
    protected RequestPostProcessor auth() {
        return SecurityMockMvcRequestPostProcessors.user(adminUser);
    }

    @Override
    protected String getURL() {
        return "/loans";
    }

    @Override
    protected LoanDTO createValidObject() {
        LoanItemDTO loanItem = new LoanItemDTO(null, item, true, BigDecimal.ONE);
        LoanDTO dto = new LoanDTO();
        dto.setBorrower(borrower);
        dto.setLoanDate(Instant.now());
        dto.setDeadline(Instant.now().plus(7, ChronoUnit.DAYS));
        dto.setItems(List.of(loanItem));
        return dto;
    }

    @Override
    protected LoanDTO createInvalidObject() {
        return new LoanDTO();
    }

    @Override
    protected void onBeforeUpdate(LoanDTO dto) {
        dto.setObservation("Observação atualizada");
    }

    @Test
    void createWithNullBorrower_returns400() throws Exception {
        LoanDTO dto = new LoanDTO();
        dto.setLoanDate(Instant.now());
        dto.setDeadline(Instant.now().plus(7, ChronoUnit.DAYS));
        dto.setItems(List.of(new LoanItemDTO(null, item, true, BigDecimal.ONE)));
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullLoanDate_returns400() throws Exception {
        LoanDTO dto = new LoanDTO();
        dto.setBorrower(borrower);
        dto.setDeadline(Instant.now().plus(7, ChronoUnit.DAYS));
        dto.setItems(List.of(new LoanItemDTO(null, item, true, BigDecimal.ONE)));
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullDeadline_returns400() throws Exception {
        LoanDTO dto = new LoanDTO();
        dto.setBorrower(borrower);
        dto.setLoanDate(Instant.now());
        dto.setItems(List.of(new LoanItemDTO(null, item, true, BigDecimal.ONE)));
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullItems_returns400() throws Exception {
        LoanDTO dto = new LoanDTO();
        dto.setBorrower(borrower);
        dto.setLoanDate(Instant.now());
        dto.setDeadline(Instant.now().plus(7, ChronoUnit.DAYS));
        dto.setItems(null);
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithEmptyItems_returns400() throws Exception {
        LoanDTO dto = new LoanDTO();
        dto.setBorrower(borrower);
        dto.setLoanDate(Instant.now());
        dto.setDeadline(Instant.now().plus(7, ChronoUnit.DAYS));
        dto.setItems(List.of());
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithItemHavingNullQuantity_returns400() throws Exception {
        LoanItemDTO invalidItem = new LoanItemDTO(null, item, true, null);
        LoanDTO dto = new LoanDTO();
        dto.setBorrower(borrower);
        dto.setLoanDate(Instant.now());
        dto.setDeadline(Instant.now().plus(7, ChronoUnit.DAYS));
        dto.setItems(List.of(invalidItem));
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithItemHavingZeroQuantity_returns400() throws Exception {
        LoanItemDTO invalidItem = new LoanItemDTO(null, item, true, BigDecimal.ZERO);
        LoanDTO dto = new LoanDTO();
        dto.setBorrower(borrower);
        dto.setLoanDate(Instant.now());
        dto.setDeadline(Instant.now().plus(7, ChronoUnit.DAYS));
        dto.setItems(List.of(invalidItem));
        performCreate(dto).andExpect(status().isBadRequest());
    }
}
