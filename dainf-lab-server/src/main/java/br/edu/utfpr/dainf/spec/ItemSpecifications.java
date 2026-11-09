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
}
