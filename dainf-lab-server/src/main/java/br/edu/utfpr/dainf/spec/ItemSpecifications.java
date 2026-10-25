package br.edu.utfpr.dainf.spec;

import br.edu.utfpr.dainf.model.Group;
import br.edu.utfpr.dainf.model.Item;
import jakarta.persistence.criteria.Join;
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
}
