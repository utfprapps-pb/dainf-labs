package br.edu.utfpr.dainf.spec;

import br.edu.utfpr.dainf.model.Asset;
import br.edu.utfpr.dainf.model.Group;
import br.edu.utfpr.dainf.model.Item;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import br.edu.utfpr.dainf.enums.StockStatus;
import br.edu.utfpr.dainf.exception.WarnException;
import br.edu.utfpr.dainf.model.Inventory;
import br.edu.utfpr.dainf.search.request.filter.SearchFilter;

import java.math.BigDecimal;

public final class ItemSpecifications {

    private ItemSpecifications() {
    }

    public static Specification<Item> belongsToGroup(Long groupId) {
        return (root, query, cb) -> {
            Subquery<Long> subquery = query.subquery(Long.class);
            Root<Item> correlatedItem = subquery.correlate(root);
            Join<Item, Group> group = correlatedItem.join("groups");
            subquery.select(group.get("id"))
                    .where(cb.equal(group.get("id"), groupId));
            return cb.exists(subquery);
        };
    }

    /**
     * Searches an Item's location regardless of whether it is stored directly on the
     * item (consumables) or on one of its assets (durable items), ignoring whitespace
     * differences between the search term and the stored value (e.g. "A2 - P6" should
     * match a location saved as "A2-P6").
     */
    public static Specification<Item> matchesLocation(String rawValue) {
        String normalizedValue = normalize(rawValue);
        return (root, query, cb) -> {
            if (normalizedValue.isEmpty()) return cb.conjunction();

            Predicate itemLocationMatches = cb.like(
                    normalizedUpper(cb, root.get("location")),
                    "%" + normalizedValue + "%"
            );

            Subquery<Long> subquery = query.subquery(Long.class);
            Root<Item> correlatedItem = subquery.correlate(root);
            Join<Item, Asset> asset = correlatedItem.join("assets");
            subquery.select(asset.get("id"))
                    .where(cb.like(normalizedUpper(cb, asset.get("location")), "%" + normalizedValue + "%"));
            Predicate assetLocationMatches = cb.exists(subquery);

            return cb.or(itemLocationMatches, assetLocationMatches);
        };
    }

    private static Expression<String> normalizedUpper(CriteriaBuilder cb, Expression<String> field) {
        return cb.function("REPLACE", String.class, cb.upper(field), cb.literal(" "), cb.literal(""));
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase().replaceAll("\\s+", "");
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
