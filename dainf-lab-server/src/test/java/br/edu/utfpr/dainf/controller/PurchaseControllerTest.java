package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.FornecedorDTO;
import br.edu.utfpr.dainf.dto.ItemDTO;
import br.edu.utfpr.dainf.dto.PurchaseDTO;
import br.edu.utfpr.dainf.dto.PurchaseItemDTO;
import br.edu.utfpr.dainf.enums.UnidadeFederativa;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PurchaseControllerTest extends CrudControllerTest<PurchaseDTO> {

    private FornecedorDTO fornecedor;

    @Inject
    FornecedorController fornecedorController;

    @BeforeEach
    protected void setUp() {
        this.fornecedor = new FornecedorDTO(null, "Fornecedor Teste", "Razão Social Teste", "35258347000113",
            "Rua Teste", "123", "Bairro Teste", "teste@gmail.com", "46999998888", "Pato Branco", UnidadeFederativa.PR);
        ResponseEntity<Long> id = fornecedorController.create(fornecedor);
        fornecedor.setId(id.getBody());
    }

    @Override
    protected String getURL() {
        return "/purchases";
    }

    @Override
    protected PurchaseDTO createValidObject() {
        return PurchaseDTO.builder()
                .date(Instant.now())
                .items(List.of())
                .fornecedor(fornecedor)
                .build();
    }

    @Override
    protected PurchaseDTO createInvalidObject() {
        return new PurchaseDTO();
    }

    @Override
    protected void onBeforeUpdate(PurchaseDTO dto) {
        dto.setDate(Instant.now());
    }

    @Test
    void createWithNullDate_returns400() throws Exception {
        PurchaseDTO dto = PurchaseDTO.builder()
                .fornecedor(fornecedor)
                .items(List.of())
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullFornecedor_returns400() throws Exception {
        PurchaseDTO dto = PurchaseDTO.builder()
                .date(Instant.now())
                .items(List.of())
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithNullItems_returns400() throws Exception {
        PurchaseDTO dto = PurchaseDTO.builder()
                .date(Instant.now())
                .fornecedor(fornecedor)
                .items(null)
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithItemHavingNullQuantity_returns400() throws Exception {
        PurchaseItemDTO invalidItem = PurchaseItemDTO.builder()
                .item(ItemDTO.builder().id(1L).build())
                .quantity(null)
                .price(BigDecimal.ONE)
                .build();
        PurchaseDTO dto = PurchaseDTO.builder()
                .date(Instant.now())
                .fornecedor(fornecedor)
                .items(List.of(invalidItem))
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithItemHavingNullPrice_returns400() throws Exception {
        PurchaseItemDTO invalidItem = PurchaseItemDTO.builder()
                .item(ItemDTO.builder().id(1L).build())
                .quantity(BigDecimal.ONE)
                .price(null)
                .build();
        PurchaseDTO dto = PurchaseDTO.builder()
                .date(Instant.now())
                .fornecedor(fornecedor)
                .items(List.of(invalidItem))
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }

    @Test
    void createWithItemHavingNullItem_returns400() throws Exception {
        PurchaseItemDTO invalidItem = PurchaseItemDTO.builder()
                .item(null)
                .quantity(BigDecimal.ONE)
                .price(BigDecimal.ONE)
                .build();
        PurchaseDTO dto = PurchaseDTO.builder()
                .date(Instant.now())
                .fornecedor(fornecedor)
                .items(List.of(invalidItem))
                .build();
        performCreate(dto).andExpect(status().isBadRequest());
    }
}
