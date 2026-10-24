package br.edu.utfpr.dainf.spec;

import br.edu.utfpr.dainf.enums.StockStatus;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Inventory;
import br.edu.utfpr.dainf.model.Item;
import br.edu.utfpr.dainf.search.request.filter.SearchFilter;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;

public final class ItemSpecifications {

    private ItemSpecifications() {
    }

    public static Specification<Item> active() {
        return (root, query, criteriaBuilder) -> criteriaBuilder.isTrue(root.get("active"));
    }

    public static Specification<Item> stockStatus(SearchFilter filter) {
        StockStatus status;
        try {
            status = StockStatus.valueOf(String.valueOf(filter.getValue()));
        } catch (IllegalArgumentException exception) {
            throw new WarnException("Filtro de saldo inválido.");
        }

        return (root, query, criteriaBuilder) -> {
            var subquery = query.subquery(Long.class);
            var inventory = subquery.from(Inventory.class);
            var quantity = inventory.<BigDecimal>get("quantity");
            var sameItem = criteriaBuilder.equal(inventory.get("item"), root);

            subquery.select(criteriaBuilder.literal(1L));
            if (status == StockStatus.ZERO) {
                var nonZeroQuantity = criteriaBuilder.notEqual(
                        criteriaBuilder.coalesce(quantity, BigDecimal.ZERO), BigDecimal.ZERO);
                subquery.where(sameItem, nonZeroQuantity);
                return criteriaBuilder.not(criteriaBuilder.exists(subquery));
            }

            subquery.where(sameItem, criteriaBuilder.greaterThan(quantity, BigDecimal.ZERO));
            return criteriaBuilder.exists(subquery);
        };
    }
}
