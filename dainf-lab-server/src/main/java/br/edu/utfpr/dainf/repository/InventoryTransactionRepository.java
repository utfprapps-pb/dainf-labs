package br.edu.utfpr.dainf.repository;

import br.edu.utfpr.dainf.dto.InventoryOperationDTO;
import br.edu.utfpr.dainf.model.InventoryTransaction;
import br.edu.utfpr.dainf.shared.CrudRepository;
import br.edu.utfpr.dainf.spec.InventoryTransactionSpecExecutor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface InventoryTransactionRepository extends CrudRepository<Long, InventoryTransaction>, InventoryTransactionSpecExecutor {
    @Query("""
            SELECT new br.edu.utfpr.dainf.dto.InventoryOperationDTO(
                it.id,
                item.name,
                it.type,
                it.quantity,
                it.date,
                COALESCE(usr.nome, '')
            )
            FROM InventoryTransaction it
            JOIN it.inventory inv
            JOIN inv.item item
            LEFT JOIN it.user usr
            ORDER BY it.date DESC
            """)
    List<InventoryOperationDTO> findRecentOperations(Pageable pageable);
}
