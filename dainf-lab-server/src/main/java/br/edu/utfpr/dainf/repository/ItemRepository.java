package br.edu.utfpr.dainf.repository;

import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.shared.CrudRepository;
import br.edu.utfpr.dainf.spec.ItemSpecExecutor;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ItemRepository extends CrudRepository<Long, Item>, ItemSpecExecutor {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<Item> findOneById(Long id);

    @Query(value = """
        SELECT EXISTS (
          SELECT 1 FROM purchase_item WHERE item_id = :id
          UNION ALL SELECT 1 FROM issue_item WHERE item_id = :id
          UNION ALL SELECT 1 FROM loan_item WHERE item_id = :id
          UNION ALL SELECT 1 FROM return_item WHERE item_id = :id
          UNION ALL SELECT 1 FROM purchase_item_aud WHERE item_id = :id
          UNION ALL SELECT 1 FROM issue_item_aud WHERE item_id = :id
          UNION ALL SELECT 1 FROM loan_item_aud WHERE item_id = :id
          UNION ALL SELECT 1 FROM return_item_aud WHERE item_id = :id
          UNION ALL SELECT 1 FROM inventory_transaction t JOIN inventory i ON i.id = t.inventory_id WHERE i.item_id = :id
        )
        """, nativeQuery = true)
    boolean hasMovementHistory(@Param("id") Long id);

    @Query(value = """
        SELECT EXISTS (
          SELECT 1 FROM loan_item li
          WHERE li.item_id = :id AND li."return" = true
            AND li.quantity > COALESCE((
              SELECT SUM(COALESCE(ri.quantity_returned, 0) + COALESCE(ri.quantity_issued, 0))
              FROM return_item ri JOIN return r ON r.id = ri.return_id
              WHERE r.loan_id = li.loan_id AND ri.item_id = li.item_id
            ), 0)
        )
        """, nativeQuery = true)
    boolean hasPendingLoans(@Param("id") Long id);

    @Query(value = """
        SELECT EXISTS (
          SELECT 1 FROM reservation_item WHERE item_id = :id
          UNION ALL SELECT 1 FROM solicitation_item WHERE item_id = :id
          UNION ALL SELECT 1 FROM cart_item WHERE item_id = :id
        )
        """, nativeQuery = true)
    boolean hasOtherReferences(@Param("id") Long id);
}
