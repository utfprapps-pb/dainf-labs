package br.edu.utfpr.dainf.controller;

import br.edu.utfpr.dainf.dto.InventoryTransactionDTO;
import br.edu.utfpr.dainf.enums.UserRole;
import br.edu.utfpr.dainf.model.InventoryTransaction;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.search.SearchHandler;
import br.edu.utfpr.dainf.search.request.SearchRequest;
import br.edu.utfpr.dainf.service.InventoryService;
import br.edu.utfpr.dainf.service.InventoryTransactionService;
import br.edu.utfpr.dainf.shared.BaseController;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.web.PagedModel;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only: inventory transactions are created exclusively as a side effect of other
 * backend operations (purchases, issues, returns, loans), never directly via HTTP.
 */
@RestController
@RequestMapping("inventory-transactions")
@RolesAllowed({UserRole.ADMIN, UserRole.LAB_TECHNICIAN})
public class InventoryTransactionController extends BaseController<Long, InventoryTransaction, InventoryTransactionDTO> {

    @Autowired
    private InventoryTransactionService service;

    private final InventoryService inventoryService;

    public InventoryTransactionController(InventoryService inventoryService) {
        super(InventoryTransaction.class, InventoryTransactionDTO.class);
        this.inventoryService = inventoryService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<InventoryTransactionDTO> findById(@PathVariable Long id) {
        return service.findById(id)
                .map(entity -> ResponseEntity.ok(toDto(entity)))
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/search")
    public ResponseEntity<PagedModel<InventoryTransactionDTO>> search(@RequestBody @Valid SearchRequest request) {
        PagedModel<InventoryTransactionDTO> page = toPageDTO(service.search(request), SearchHandler.getPageable(request));
        return ResponseEntity.ok(page);
    }

    @Override
    public InventoryTransactionDTO toDto(InventoryTransaction entity) {
        Item item = entity.getInventory().getItem();
        return InventoryTransactionDTO.builder()
                .id(entity.getId())
                .itemId(item.getId())
                .itemName(item.getName())
                .type(entity.getType())
                .quantity(entity.getQuantity())
                .userName(entity.getUser() != null ? entity.getUser().getNome() : "Sistema")
                .date(entity.getDate())
                .currentQuantity(inventoryService.getItemQuantity(item))
                .balance(entity.getBalance() != null ? entity.getBalance() : inventoryService.getItemQuantity(item))
                .build();
    }
}
