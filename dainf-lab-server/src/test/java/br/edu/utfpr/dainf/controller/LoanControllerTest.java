package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.ItemDTO;
import br.edu.utfpr.dainf.dto.LoanDTO;
import br.edu.utfpr.dainf.dto.LoanItemDTO;
import br.edu.utfpr.dainf.dto.SimpleUserDTO;
import br.edu.utfpr.dainf.enums.LoanStatus;
import br.edu.utfpr.dainf.shared.CrudControllerTest;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class LoanControllerTest extends CrudControllerTest<LoanDTO> {

    @Override
    protected String getURL() {
        return "/loans";
    }

    @Override
    protected LoanDTO createValidObject() {
        SimpleUserDTO borrower = new SimpleUserDTO();
        borrower.setId(1L);

        ItemDTO item = new ItemDTO();
        item.setId(1L);

        LoanItemDTO loanItem = new LoanItemDTO();
        loanItem.setItem(item);
        loanItem.setShouldReturn(true);
        loanItem.setQuantity(BigDecimal.ONE);

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
    @Order(10)
    void newLoanShouldHaveOngoingStatus() throws Exception {
        Long createdId = createResource();
        assertNotNull(createdId);

        MvcResult result = performFindOne(createdId)
                .andExpect(status().isOk())
                .andReturn();

        String content = result.getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(content);
        String status = node.get("status").asText();
        assertEquals(LoanStatus.ONGOING.name(), status,
                "A newly created loan should have ONGOING status, not COMPLETED");
    }

    @Test
    @Order(11)
    void newLoanWithNonReturnableItemsShouldHaveOngoingStatus() throws Exception {
        SimpleUserDTO borrower = new SimpleUserDTO();
        borrower.setId(1L);

        ItemDTO item = new ItemDTO();
        item.setId(1L);

        LoanItemDTO loanItem = new LoanItemDTO();
        loanItem.setItem(item);
        loanItem.setShouldReturn(false);
        loanItem.setQuantity(BigDecimal.ONE);

        LoanDTO dto = new LoanDTO();
        dto.setBorrower(borrower);
        dto.setLoanDate(Instant.now());
        dto.setDeadline(Instant.now().plus(7, ChronoUnit.DAYS));
        dto.setItems(List.of(loanItem));

        MvcResult createResult = performCreate(dto)
                .andExpect(status().isCreated())
                .andReturn();
        Long createdId = extractId(createResult);

        MvcResult findResult = performFindOne(createdId)
                .andExpect(status().isOk())
                .andReturn();

        String content = findResult.getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(content);
        String status = node.get("status").asText();
        assertEquals(LoanStatus.ONGOING.name(), status,
                "A loan with only non-returnable items should have ONGOING status, not COMPLETED");
    }
}
