package br.edu.utfpr.dainf.audit;

import br.edu.utfpr.dainf.enums.UserRole;
import jakarta.annotation.security.RolesAllowed;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.web.PagedModel;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("audit")
@RolesAllowed({UserRole.ADMIN})
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @PostMapping("/search")
    public ResponseEntity<PagedModel<AuditEntryDTO>> search(@RequestBody AuditSearchRequest request) {
        Page<AuditEntryDTO> page = auditService.search(request);
        return ResponseEntity.ok(new PagedModel<>(new PageImpl<>(page.getContent(), page.getPageable(), page.getTotalElements())));
    }

    @GetMapping("/entities")
    public ResponseEntity<List<AuditEntityOptionDTO>> entities() {
        return ResponseEntity.ok(auditService.listAuditableEntities());
    }

    @GetMapping("/{entityKey}/{entityId}/{revisionId}/changes")
    public ResponseEntity<List<AuditFieldChangeDTO>> changes(
            @PathVariable String entityKey,
            @PathVariable Long entityId,
            @PathVariable Integer revisionId) {
        return ResponseEntity.ok(auditService.getChanges(entityKey, entityId, revisionId));
    }
}
