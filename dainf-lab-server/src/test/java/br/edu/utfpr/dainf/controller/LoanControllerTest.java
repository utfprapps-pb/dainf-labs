package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.ItemDTO;
import br.edu.utfpr.dainf.dto.LoanDTO;
import br.edu.utfpr.dainf.dto.LoanItemDTO;
import br.edu.utfpr.dainf.dto.SimpleUserDTO;
import br.edu.utfpr.dainf.shared.CrudControllerTest;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

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
}
