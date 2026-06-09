package br.edu.utfpr.dainf.shared;

import br.edu.utfpr.dainf.exception.WarnException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;

public class ItemListValidator {

    private ItemListValidator() {}

    /**
     * Throws {@link WarnException} if two entries in {@code items} map to the same ID.
     * Call this at the start of any service save() that processes a list of items so that
     * a duplicate sent by the frontend is rejected before any inventory transaction runs.
     */
    public static <T> void validateNoDuplicates(List<T> items, Function<T, Long> idExtractor) {
        if (items == null || items.isEmpty()) return;
        Set<Long> seen = new HashSet<>();
        for (T item : items) {
            Long id = idExtractor.apply(item);
            if (!seen.add(id)) {
                throw new WarnException("A lista de itens contém duplicatas.");
            }
        }
    }
}
