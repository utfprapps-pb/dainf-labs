package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.LoanDTO;
import br.edu.utfpr.dainf.dto.LoanItemTrackingDTO;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.Loan;
import br.edu.utfpr.dainf.model.LoanItem;
import br.edu.utfpr.dainf.repository.LoanRepository;
import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.service.LoanService;
import br.edu.utfpr.dainf.shared.CrudController;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import org.springframework.data.web.PagedModel;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

import br.edu.utfpr.dainf.dto.LoanItemDTO;
import br.edu.utfpr.dainf.model.Return;
import br.edu.utfpr.dainf.repository.ReturnRepository;
import org.springframework.beans.factory.annotation.Autowired;

@RestController
@RequestMapping("loans")
@RolesAllowed({UserRole.ADMIN, UserRole.LAB_TECHNICIAN})
public class LoanController extends CrudController<Long, Loan, LoanDTO, LoanRepository, LoanService> {

    private final ReturnRepository returnRepository;

    @Autowired
    public LoanController(ReturnRepository returnRepository) {
        super(Loan.class, LoanDTO.class);
        this.returnRepository = returnRepository;
    }

    @Override
    public LoanDTO toDto(Loan entity) {
        LoanDTO dto = super.toDto(entity);
        if (dto.getItems() != null && entity.getId() != null) {
            Return ret = returnRepository.findFirstByLoanIdOrderByIdDesc(entity.getId());
            if (ret != null && ret.getItems() != null) {
                for (LoanItemDTO itemDto : dto.getItems()) {
                    ret.getItems().stream()
                       .filter(ri -> ri.getItem().getId().equals(itemDto.getItem().getId()))
                       .findFirst()
                       .ifPresent(ri -> itemDto.setReturnedQuantity(ri.getQuantityReturned()));
                }
            }
        }
        return dto;
    }


    @Override
    @PostMapping("/search")
    @RolesAllowed({UserRole.ADMIN, UserRole.LAB_TECHNICIAN, UserRole.STUDENT, UserRole.PROFESSOR})
    public ResponseEntity<PagedModel<LoanDTO>> search(@RequestBody SearchRequest request) {
        return super.search(request);
    }

    @GetMapping("/item/{itemId}/active")
    @RolesAllowed({UserRole.ADMIN, UserRole.LAB_TECHNICIAN})
    public ResponseEntity<List<LoanItemTrackingDTO>> getActiveLoansForItem( @PathVariable Long itemId) {

        List<LoanItem> activeLoans = service.getActiveLoansForItem(itemId);

        List<LoanItemTrackingDTO> dtos = activeLoans.stream()
                .map(LoanItemTrackingDTO::new)
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }

    @GetMapping("/item/{itemId}/history")
    @RolesAllowed({UserRole.ADMIN, UserRole.LAB_TECHNICIAN})
    public ResponseEntity<List<LoanItemTrackingDTO>> getLoanHistoryForItem(@PathVariable Long itemId) {

        List<LoanItem> history = service.getHistoryForItem(itemId);

        List<LoanItemTrackingDTO> dtos = history.stream()
                .map(LoanItemTrackingDTO::new)
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtos);
    }
}