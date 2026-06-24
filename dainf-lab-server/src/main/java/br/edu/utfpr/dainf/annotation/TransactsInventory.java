package br.edu.utfpr.dainf.annotation;

import br.edu.utfpr.dainf.enums.InventoryTransactionType;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Documents that this save() method produces inventory transactions of the given type.
 * The actual coordination is performed by InventoryDiffService, not an AOP aspect.
 * This annotation serves as living documentation and an extension point for a future aspect.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
public @interface TransactsInventory {
    InventoryTransactionType type();
}
